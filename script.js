const postsEl = document.getElementById("posts");
const filtersEl = document.getElementById("filters");
const countEl = document.getElementById("postCount");
const searchEl = document.getElementById("articleSearch");
const clearFiltersEl = document.getElementById("clearFilters");
const themeToggleEl = document.getElementById("themeToggle");

let postsRequest;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(dateString, long = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: long ? "long" : "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateString}T00:00:00Z`));
}

function readStoredTheme() {
  try {
    const theme = window.localStorage.getItem("theme");
    return theme === "light" || theme === "dark" ? theme : null;
  } catch (error) {
    console.warn("Color theme preference could not be read.", error);
    return null;
  }
}

function storeTheme(theme) {
  try {
    window.localStorage.setItem("theme", theme);
  } catch (error) {
    console.warn("Color theme preference could not be saved.", error);
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  if (themeToggleEl) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    const label = `Switch to ${nextTheme} theme`;
    themeToggleEl.setAttribute("aria-label", label);
    themeToggleEl.setAttribute("title", label);
  }
}

function initTheme() {
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let activeTheme = readStoredTheme() || (systemTheme.matches ? "dark" : "light");
  applyTheme(activeTheme);

  themeToggleEl?.addEventListener("click", () => {
    activeTheme = activeTheme === "dark" ? "light" : "dark";
    storeTheme(activeTheme);
    applyTheme(activeTheme);
  });

  systemTheme.addEventListener("change", (event) => {
    if (readStoredTheme()) return;
    activeTheme = event.matches ? "dark" : "light";
    applyTheme(activeTheme);
  });
}

async function loadPosts() {
  if (!postsRequest) {
    postsRequest = fetch("./posts/index.json").then((response) => {
      if (!response.ok) {
        throw new Error(`Article index request failed with ${response.status}`);
      }
      return response.json();
    });
  }

  const posts = await postsRequest;
  if (!Array.isArray(posts)) {
    throw new Error("Article index has an invalid format");
  }
  return posts;
}

function tagButton(tag, activeTag, count) {
  const isActive = tag === activeTag;
  const label = tag || "All";
  return `
    <button
      class="tag-filter${isActive ? " active" : ""}"
      type="button"
      data-tag="${escapeHtml(tag)}"
      aria-pressed="${isActive}"
    >
      ${escapeHtml(label)}
      <span>${count}</span>
    </button>
  `;
}

function renderFilters(posts, tags, activeTag) {
  const buttons = [
    tagButton("", activeTag, posts.length),
    ...tags.map((tag) => {
      const count = posts.filter((post) => post.tags.includes(tag)).length;
      return tagButton(tag, activeTag, count);
    }),
  ];

  filtersEl.innerHTML = buttons.join("");
}

function articleTagButton(tag) {
  return `
    <button class="article-tag" type="button" data-article-tag="${escapeHtml(tag)}">
      ${escapeHtml(tag)}
    </button>
  `;
}

function articleCard(post) {
  const url = `post.html?slug=${encodeURIComponent(post.slug)}`;
  const cover = post.cover
    ? `
      <a class="article-cover" href="${url}" tabindex="-1" aria-hidden="true">
        <img src="${escapeHtml(post.cover)}" alt="" loading="lazy" decoding="async">
      </a>
    `
    : "";

  return `
    <article class="article-card${post.cover ? " has-cover" : ""}">
      ${cover}
      <div class="article-card-body">
        <div class="article-card-meta">
          <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
          <span aria-hidden="true"></span>
          <span>${post.readingMinutes} min read</span>
        </div>
        <div class="article-card-tags">
          ${post.tags.map(articleTagButton).join("")}
        </div>
        <h3><a href="${url}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.excerpt)}</p>
        <a class="article-read-link" href="${url}" aria-label="Read ${escapeHtml(post.title)}">
          Read article
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 10h12M11 5l5 5-5 5"></path>
          </svg>
        </a>
      </div>
    </article>
  `;
}

function syncSearchUrl(state) {
  const url = new URL(window.location.href);

  if (state.query) {
    url.searchParams.set("q", state.query);
  } else {
    url.searchParams.delete("q");
  }

  if (state.activeTag) {
    url.searchParams.set("tag", state.activeTag);
  } else {
    url.searchParams.delete("tag");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function matchingPosts(posts, state) {
  const query = state.query.toLocaleLowerCase();

  return posts.filter((post) => {
    const matchesTag =
      !state.activeTag || post.tags.includes(state.activeTag);
    const searchableText = [post.title, post.excerpt, ...post.tags]
      .join(" ")
      .toLocaleLowerCase();
    return matchesTag && (!query || searchableText.includes(query));
  });
}

function renderPosts(posts, tags, state) {
  const visiblePosts = matchingPosts(posts, state);
  const hasFilters = Boolean(state.query || state.activeTag);

  renderFilters(posts, tags, state.activeTag);
  countEl.textContent = `${visiblePosts.length} article${visiblePosts.length === 1 ? "" : "s"}${hasFilters ? " found" : ""}`;
  clearFiltersEl.hidden = !hasFilters;

  if (!visiblePosts.length) {
    postsEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon" aria-hidden="true">0</span>
        <h3>No articles match those filters.</h3>
        <p>Try another search term or clear the selected tag.</p>
        <button class="button button-secondary" type="button" data-clear-results>
          Show all articles
        </button>
      </div>
    `;
    return;
  }

  postsEl.innerHTML = visiblePosts.map(articleCard).join("");
}

function renderHomeError(error) {
  console.error("Articles could not be loaded.", error);
  countEl.textContent = "Articles unavailable";
  filtersEl.innerHTML = "";
  clearFiltersEl.hidden = true;
  postsEl.innerHTML = `
    <div class="empty-state">
      <span class="empty-state-icon" aria-hidden="true">!</span>
      <h3>The articles could not be loaded.</h3>
      <p>Refresh the page to try again.</p>
    </div>
  `;
}

async function initHomePage() {
  if (!postsEl || !filtersEl || !countEl || !searchEl || !clearFiltersEl) return;

  try {
    const posts = await loadPosts();
    const tags = [...new Set(posts.flatMap((post) => post.tags))].sort((a, b) =>
      a.localeCompare(b),
    );
    const params = new URLSearchParams(window.location.search);
    const requestedTag = params.get("tag") || "";
    const state = {
      query: (params.get("q") || "").trim(),
      activeTag: tags.includes(requestedTag) ? requestedTag : "",
    };

    searchEl.value = state.query;

    const update = (restoreTagFocus = false) => {
      renderPosts(posts, tags, state);
      syncSearchUrl(state);

      if (restoreTagFocus) {
        [...filtersEl.querySelectorAll("[data-tag]")]
          .find((button) => button.dataset.tag === state.activeTag)
          ?.focus();
      }
    };

    filtersEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tag]");
      if (!button) return;
      state.activeTag = button.dataset.tag;
      update(true);
    });

    postsEl.addEventListener("click", (event) => {
      const tag = event.target.closest("[data-article-tag]")?.dataset.articleTag;
      if (tag === undefined) return;
      state.activeTag = tag;
      update(true);
      document.getElementById("articles")?.scrollIntoView({ behavior: "smooth" });
    });

    searchEl.addEventListener("input", () => {
      state.query = searchEl.value.trim();
      update();
    });

    const clear = () => {
      state.query = "";
      state.activeTag = "";
      searchEl.value = "";
      update();
      searchEl.focus();
    };

    clearFiltersEl.addEventListener("click", clear);
    postsEl.addEventListener("click", (event) => {
      if (event.target.closest("[data-clear-results]")) clear();
    });

    update();
  } catch (error) {
    renderHomeError(error);
  }
}

function postTagLink(tag) {
  const href = `./?tag=${encodeURIComponent(tag)}#articles`;
  return `<a class="article-tag" href="${href}">${escapeHtml(tag)}</a>`;
}

function renderPostError(container, title, message) {
  container.innerHTML = `
    <section class="post-message">
      <p class="eyebrow">404 / Article</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a class="button button-primary" href="./#articles">Browse all articles</a>
    </section>
  `;
}

function initReadingProgress() {
  const progress = document.getElementById("readingProgress");
  if (!progress) return;

  const update = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const percentage = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progress.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

async function initPostPage() {
  const container = document.getElementById("post");
  if (!container) return;

  const slug = new URLSearchParams(window.location.search).get("slug");
  if (!slug) {
    renderPostError(
      container,
      "Article not found",
      "The article address is missing a slug.",
    );
    return;
  }

  try {
    const posts = await loadPosts();
    const post = posts.find((entry) => entry.slug === slug);

    if (!post) {
      renderPostError(
        container,
        "Article not found",
        "The article may have moved or is no longer published.",
      );
      return;
    }

    document.title = `${post.title} | Gus Alves`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", post.excerpt);

    const cover = post.cover
      ? `
        <figure class="article-hero-image">
          <img src="${escapeHtml(post.cover)}" alt="" decoding="async">
        </figure>
      `
      : "";

    container.innerHTML = `
      <article class="article">
        <a class="back-link" href="./#articles">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M16 10H4M9 5l-5 5 5 5"></path>
          </svg>
          All articles
        </a>

        <header class="article-head">
          <div class="article-card-tags">
            ${post.tags.map(postTagLink).join("")}
          </div>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="article-deck">${escapeHtml(post.excerpt)}</p>
          <div class="article-byline">
            <img src="profile.jpg" alt="" width="44" height="44">
            <div>
              <strong>Gus Alves</strong>
              <p>
                <time datetime="${escapeHtml(post.date)}">${formatDate(post.date, true)}</time>
                <span aria-hidden="true"></span>
                ${post.readingMinutes} min read
              </p>
            </div>
          </div>
        </header>

        ${cover}

        <section class="article-body">
          ${post.bodyHtml}
        </section>

        <footer class="article-footer">
          <div>
            <p>Filed under</p>
            <div class="article-card-tags">
              ${post.tags.map(postTagLink).join("")}
            </div>
          </div>
          <a class="text-link" href="./#articles">
            More writing
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4"></path>
            </svg>
          </a>
        </footer>
      </article>
    `;

    initReadingProgress();
  } catch (error) {
    console.error("The article could not be loaded.", error);
    renderPostError(
      container,
      "Article unavailable",
      "The article could not be loaded. Refresh the page to try again.",
    );
  }
}

function initFooterYear() {
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
}

initTheme();
initFooterYear();
void initHomePage();
void initPostPage();
