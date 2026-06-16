import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const postsDir = path.resolve("posts");
const outputPath = path.join(postsDir, "index.json");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function markdownToHtml(markdown) {
  const lines = markdown.trim().split("\n");
  const html = [];
  let inList = false;
  let inCode = false;
  let codeLines = [];

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLines = [];
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${parseInlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${parseInlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${parseInlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${parseInlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${parseInlineMarkdown(line)}</p>`);
  }

  closeList();
  return html.join("");
}

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    meta[key] = rawValue.startsWith("[") ? JSON.parse(rawValue) : rawValue;
  }
  return { meta, body: match[2] };
}

const files = (await readdir(postsDir)).filter((file) => file.endsWith(".md"));
const posts = [];

for (const file of files) {
  const content = await readFile(path.join(postsDir, file), "utf8");
  const { meta, body } = parseFrontMatter(content);
  posts.push({
    slug: meta.slug || file.replace(/\.md$/, ""),
    title: meta.title || file.replace(/\.md$/, ""),
    excerpt: meta.excerpt || "",
    date: meta.date || "",
    tags: meta.tags || [],
    bodyHtml: markdownToHtml(body),
  });
}

posts.sort((a, b) => new Date(b.date) - new Date(a.date));
await writeFile(outputPath, `${JSON.stringify(posts, null, 2)}\n`);
