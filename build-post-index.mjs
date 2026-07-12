import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const postsDir = path.resolve("posts");
const outputPath = path.join(postsDir, "index.json");
const wordsPerMinute = 220;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeContentUrl(rawUrl) {
  const url = rawUrl.trim().replace(/^<|>$/g, "");

  if (/^(https?:|mailto:|tel:)/i.test(url) || url.startsWith("#")) {
    return url;
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith("//")) {
    return "#";
  }

  const normalizedPath = path.posix.normalize(
    path.posix.join("posts", url.replace(/^\.\//, "")),
  );

  return normalizedPath.startsWith("../") ? "#" : `./${normalizedPath}`;
}

function renderImage(alt, rawUrl, title = "", inline = false) {
  const src = escapeHtml(normalizeContentUrl(rawUrl));
  const safeAlt = escapeHtml(alt);
  const image = `<img src="${src}" alt="${safeAlt}" loading="lazy" decoding="async">`;

  if (inline) {
    return image;
  }

  const caption = title
    ? `<figcaption>${escapeHtml(title)}</figcaption>`
    : "";
  return `<figure class="article-figure">${image}${caption}</figure>`;
}

function parseMediaSyntax(source, imageOnly = false) {
  const prefix = imageOnly ? "!" : "";
  const expression = new RegExp(
    `^${prefix.replace("!", "\\!")}\\[([^\\]]*)\\]\\(\\s*(<?[^\\s)>]+>?)` +
      `(?:\\s+["']([^"']+)["'])?\\s*\\)$`,
  );
  return source.match(expression);
}

function renderInline(source) {
  const tokens = [];
  const stash = (html) => {
    const index = tokens.push(html) - 1;
    return `\u0000${index}\u0000`;
  };

  let text = source
    .replace(/`([^`\n]+)`/g, (_, code) =>
      stash(`<code>${escapeHtml(code)}</code>`),
    )
    .replace(
      /!\[([^\]]*)\]\(\s*(<?[^\s)>]+>?)(?:\s+["']([^"']+)["'])?\s*\)/g,
      (_, alt, url, title) => stash(renderImage(alt, url, title, true)),
    )
    .replace(
      /\[([^\]]+)\]\(\s*(<?[^\s)>]+>?)(?:\s+["']([^"']+)["'])?\s*\)/g,
      (_, label, rawUrl, title) => {
        const href = normalizeContentUrl(rawUrl);
        const external = /^https?:/i.test(href);
        const titleAttribute = title
          ? ` title="${escapeHtml(title)}"`
          : "";
        const externalAttributes = external
          ? ' target="_blank" rel="noreferrer"'
          : "";

        return stash(
          `<a href="${escapeHtml(href)}"${titleAttribute}${externalAttributes}>${escapeHtml(label)}</a>`,
        );
      },
    );

  text = escapeHtml(text)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");

  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
}

function headingId(source, counts) {
  const base =
    source
      .toLowerCase()
      .replace(/[`*_~[\]]/g, "")
      .replace(/[^a-z\d\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section";
  const count = counts.get(base) || 0;
  counts.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

function markdownToHtml(markdown, fileName) {
  const lines = markdown.replaceAll("\r\n", "\n").trim().split("\n");
  const html = [];
  const headingCounts = new Map();
  let paragraph = [];
  let quote = [];
  let listType = null;
  let inCodeBlock = false;
  let codeLanguage = "";
  let codeLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushQuote = () => {
    if (!quote.length) return;
    html.push(`<blockquote><p>${renderInline(quote.join(" "))}</p></blockquote>`);
    quote = [];
  };

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  const flushBlocks = () => {
    flushParagraph();
    flushQuote();
    closeList();
  };

  for (const line of lines) {
    const fence = line.match(/^```\s*([\w+-]*)\s*$/);

    if (fence) {
      if (inCodeBlock) {
        const languageClass = codeLanguage
          ? ` class="language-${escapeHtml(codeLanguage)}"`
          : "";
        html.push(
          `<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
        inCodeBlock = false;
        codeLanguage = "";
        codeLines = [];
      } else {
        flushBlocks();
        inCodeBlock = true;
        codeLanguage = fence[1].toLowerCase();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushBlocks();
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      closeList();
      quote.push(quoteMatch[1]);
      continue;
    }

    flushQuote();

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const id =
        level > 1
          ? ` id="${escapeHtml(headingId(heading[2], headingCounts))}"`
          : "";
      html.push(`<h${level}${id}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }

    const image = parseMediaSyntax(line.trim(), true);
    if (image) {
      flushParagraph();
      closeList();
      html.push(renderImage(image[1], image[2], image[3]));
      continue;
    }

    const unorderedItem = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedItem = line.match(/^\s*\d+\.\s+(.+)$/);
    const listItem = unorderedItem || orderedItem;

    if (listItem) {
      flushParagraph();
      const nextListType = orderedItem ? "ol" : "ul";
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${renderInline(listItem[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  if (inCodeBlock) {
    throw new Error(`Unclosed code fence in ${fileName}`);
  }

  flushBlocks();
  return html.join("\n");
}

function parseFrontMatterValue(rawValue, fileName, key) {
  if (!rawValue) return "";

  if (rawValue.startsWith("[") || rawValue.startsWith("{")) {
    try {
      return JSON.parse(rawValue);
    } catch {
      throw new Error(`Invalid JSON value for "${key}" in ${fileName}`);
    }
  }

  if (rawValue === "true") return true;
  if (rawValue === "false") return false;

  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

function parseFrontMatter(content, fileName) {
  const normalized = content.replaceAll("\r\n", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);

  if (!match) {
    throw new Error(`Missing front matter in ${fileName}`);
  }

  const meta = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const separator = line.indexOf(":");
    if (separator === -1) {
      throw new Error(`Invalid front matter line in ${fileName}: ${line}`);
    }

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    meta[key] = parseFrontMatterValue(rawValue, fileName, key);
  }

  return { meta, body: match[2] };
}

function validateMeta(meta, fileName) {
  for (const field of ["title", "date", "excerpt", "tags"]) {
    if (!meta[field] || (Array.isArray(meta[field]) && !meta[field].length)) {
      throw new Error(`Missing required "${field}" in ${fileName}`);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
    throw new Error(`Date must use YYYY-MM-DD in ${fileName}`);
  }

  const parsedDate = new Date(`${meta.date}T00:00:00Z`);
  if (
    Number.isNaN(parsedDate.valueOf()) ||
    parsedDate.toISOString().slice(0, 10) !== meta.date
  ) {
    throw new Error(`Date is not valid in ${fileName}`);
  }

  if (
    !Array.isArray(meta.tags) ||
    meta.tags.some((tag) => typeof tag !== "string" || !tag.trim())
  ) {
    throw new Error(`Tags must be a JSON array of strings in ${fileName}`);
  }

  if (
    meta.slug &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(meta.slug))
  ) {
    throw new Error(`Slug must use lowercase kebab-case in ${fileName}`);
  }

  if (meta.cover && typeof meta.cover !== "string") {
    throw new Error(`Cover must be an image path in ${fileName}`);
  }
}

function stripRepeatedTitle(body, title) {
  const lines = body.replaceAll("\r\n", "\n").split("\n");
  const firstContentLine = lines.findIndex((line) => line.trim());

  if (
    firstContentLine !== -1 &&
    lines[firstContentLine].replace(/^#\s+/, "").trim() === title.trim()
  ) {
    lines.splice(firstContentLine, 1);
  }

  return lines.join("\n");
}

function readingMinutes(markdown) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+]\([^)]*\)/g, " ")
    .replace(/[#>*_`~[\]-]/g, " ");
  const words = text.trim().match(/\S+/g)?.length || 0;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

const files = (await readdir(postsDir))
  .filter((file) => file.endsWith(".md"))
  .sort();
const posts = [];
const slugs = new Set();

for (const file of files) {
  const content = await readFile(path.join(postsDir, file), "utf8");
  const { meta, body } = parseFrontMatter(content, file);
  validateMeta(meta, file);

  if (meta.draft === true) continue;

  const articleBody = stripRepeatedTitle(body, meta.title);
  const slug = meta.slug || file.replace(/\.md$/, "");

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`File name or slug must use lowercase kebab-case in ${file}`);
  }

  if (slugs.has(slug)) {
    throw new Error(`Duplicate article slug "${slug}" in ${file}`);
  }
  slugs.add(slug);

  posts.push({
    slug,
    title: String(meta.title),
    excerpt: String(meta.excerpt),
    date: meta.date,
    tags: [...new Set(meta.tags.map((tag) => tag.trim()))],
    readingMinutes: readingMinutes(articleBody),
    cover: meta.cover ? normalizeContentUrl(meta.cover) : "",
    bodyHtml: markdownToHtml(articleBody, file),
  });
}

posts.sort((a, b) => {
  const dateDifference = new Date(b.date) - new Date(a.date);
  return dateDifference || a.title.localeCompare(b.title);
});

await writeFile(outputPath, `${JSON.stringify(posts, null, 2)}\n`);
console.log(`Built ${posts.length} published post${posts.length === 1 ? "" : "s"}.`);
