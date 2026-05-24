const postsEl = document.getElementById("posts");
const filtersEl = document.getElementById("filters");
const countEl = document.getElementById("postCount");

const markdownCache = new Map();

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: content };
  }

  const meta = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    meta[key] = value.startsWith("[") ? JSON.parse(value) : value;
  }

  return { meta, body: match[2] };
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

async function loadMarkdown(path) {
  if (markdownCache.has(path)) return markdownCache.get(path);
  const response = await fetch(path);
  const content = await response.text();
  markdownCache.set(path, content);
  return content;
}

async function loadPosts() {
  const response = await fetch("/posts/index.json");
  return response.json();
}

function renderFilters(allTags, activeTag, onSelect) {
  filtersEl.innerHTML = allTags
    .map(
      (tag) =>
        `<button class="filter-btn ${tag === activeTag ? "active" : ""}" data-tag="${tag}">${tag}</button>`,
    )
    .join("");

  filtersEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => onSelect(button.dataset.tag));
  });
}

function renderPosts(posts, activeTag) {
  const visiblePosts =
    activeTag === "All"
      ? posts
      : posts.filter((post) => post.tags.includes(activeTag));

  countEl.textContent = `${visiblePosts.length} post${visiblePosts.length === 1 ? "" : "s"} shown`;
  postsEl.innerHTML = visiblePosts
    .map(
      (post) => `
        <article class="post-card">
          <div class="meta">
            <time class="date" datetime="${post.date}">${formatDate(post.date)}</time>
            ${post.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
          </div>
          <h3><a href="/post.html?slug=${post.slug}">${post.title}</a></h3>
          <p>${post.excerpt}</p>
        </article>
      `,
    )
    .join("");
}

async function initHomePage() {
  if (!postsEl || !filtersEl || !countEl) return;
  const posts = await loadPosts();
  const allTags = ["All", ...new Set(posts.flatMap((post) => post.tags))];
  let activeTag = "All";

  const update = () => {
    renderFilters(allTags, activeTag, (tag) => {
      activeTag = tag;
      update();
    });
    renderPosts(posts, activeTag);
  };

  update();
}

async function initPostPage() {
  const container = document.getElementById("post");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const posts = await loadPosts();
  const post = posts.find((entry) => entry.slug === slug);

  if (!post) {
    container.innerHTML = `<p class="not-found">Post not found.</p>`;
    return;
  }

  const markdown = await loadMarkdown(`/posts/${post.slug}.md`);
  const { body } = parseFrontMatter(markdown);
  document.title = `${post.title} | Portfolio`;

  container.innerHTML = `
    <article class="article">
      <a class="back-link" href="/">← Back to home</a>
      <header class="article-head">
        <div class="meta">
          <time class="date" datetime="${post.date}">${formatDate(post.date)}</time>
          ${post.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <h1>${post.title}</h1>
        <p class="intro">${post.excerpt}</p>
      </header>
      <section class="article-body">
        ${markdownToHtml(body)}
      </section>
    </article>
  `;
}

initHomePage();
initPostPage();
