const postsEl = document.getElementById("posts");
const filtersEl = document.getElementById("filters");
const countEl = document.getElementById("postCount");

const contentCache = new Map();

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

async function loadPosts() {
  const response = await fetch("./posts/index.json");
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
          <h3><a href="post.html?slug=${post.slug}">${post.title}</a></h3>
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

async function loadPostContent(slug) {
  if (contentCache.has(slug)) return contentCache.get(slug);
  const response = await fetch("./posts/index.json");
  const posts = await response.json();
  const post = posts.find((entry) => entry.slug === slug);

  if (!post) return null;

  contentCache.set(slug, post);
  return post;
}

function renderPostBody(markdownHtml) {
  return markdownHtml;
}

async function initPostPage() {
  const container = document.getElementById("post");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const post = await loadPostContent(slug);

  if (!post) {
    container.innerHTML = `<p class="not-found">Post not found.</p>`;
    return;
  }

  document.title = `${post.title} | Portfolio`;

  container.innerHTML = `
    <article class="article">
      <a class="back-link" href="./">← Back to home</a>
      <header class="article-head">
        <div class="meta">
          <time class="date" datetime="${post.date}">${formatDate(post.date)}</time>
          ${post.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <h1>${post.title}</h1>
        <p class="intro">${post.excerpt}</p>
      </header>
      <section class="article-body">
        ${post.bodyHtml || ""}
      </section>
    </article>
  `;
}

initHomePage();
initPostPage();
