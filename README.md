# Gus Alves — Portfolio & Blog

A dependency-free portfolio and technical blog built for GitHub Pages. Articles
are written in Markdown, converted into a searchable index at build time, and
rendered by the static site.

## Site structure

- `index.html` — home, introduction, article search, and tag filters
- `projects.html` — selected project portfolio
- `post.html` — individual article template
- `posts/*.md` — Markdown article source
- `posts/images/` — article covers, diagrams, and screenshots
- `posts/index.json` — generated article data used by the website
- `build-post-index.mjs` — Markdown build script

## Write an article

Create a kebab-case Markdown file in `posts/`, such as
`building-a-task-scheduler.md`:

```md
---
title: Building a Task Scheduler
date: 2026-07-12
tags: ["C++", "Embedded Systems", "Projects"]
excerpt: What I learned while designing a small cooperative task scheduler.
cover: images/task-scheduler-cover.jpg
---

Start the article here. The title from the front matter is rendered
automatically, so an additional level-one heading is optional.

## A section heading

Use regular Markdown for **emphasis**, `inline code`, links, ordered and
unordered lists, blockquotes, and fenced code blocks.

![Scheduler timing diagram](images/task-scheduler-timing.png "Timing diagram from the first prototype")
```

Then regenerate the article index:

```bash
node build-post-index.mjs
```

The build validates required metadata and reports malformed front matter,
invalid slugs, or unclosed code fences.

### Front matter

| Field | Required | Format |
| --- | --- | --- |
| `title` | Yes | Article title |
| `date` | Yes | `YYYY-MM-DD` |
| `tags` | Yes | JSON array of one or more tags |
| `excerpt` | Yes | Short summary shown on article cards |
| `slug` | No | Lowercase kebab-case; defaults to the file name |
| `cover` | No | Image path relative to `posts/` |
| `draft` | No | Set to `true` to exclude the article from the index |

Tags automatically become filters on the home page. The search field matches
article titles, excerpts, and tags, and filtered views are reflected in the URL
so they can be shared.

## Add images

Place images in `posts/images/` and reference them relative to the Markdown
file:

```md
![Descriptive alternative text](images/architecture.png)
```

Add a quoted title to display a caption:

```md
![Descriptive alternative text](images/architecture.png "System architecture")
```

For a card and article cover, add the same relative path to the front matter:

```yaml
cover: images/architecture.png
```

Use descriptive alternative text, compress photos before committing them, and
prefer SVG or PNG for diagrams.

## Local preview

The site loads its generated article index with `fetch`, so preview it through a
local server rather than opening the HTML files directly:

```bash
node build-post-index.mjs
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173`. Individual posts use
`post.html?slug=your-article-slug`.

## Publish a new article

1. Create a lowercase kebab-case file such as `posts/my-new-article.md`.
2. Add the required front matter and write the article in Markdown.
3. Place any article images in `posts/images/` and reference them with paths such
   as `images/diagram.png`.
4. Run `node build-post-index.mjs` to regenerate the article index.
5. Start the local server with `python3 -m http.server 4173`.
6. Preview the article at
   `http://127.0.0.1:4173/post.html?slug=my-new-article`.
7. Commit the Markdown file, its images, and the generated `posts/index.json`.
8. Push to the branch configured for GitHub Pages.

Do not edit `posts/index.json` manually. Add `draft: true` to an article's front
matter when it should remain unpublished.

## Modify projects

Projects are defined directly in `projects.html`. Each
`<article class="project-card">` block contains the project's:

- display number
- category
- title and description
- technology tags
- source repository URL

Copy an existing project card to add another project, then update its content:

```html
<article class="project-card">
  <div class="project-index">05</div>

  <div class="project-content">
    <div class="project-topline">
      <p>Embedded systems</p>
    </div>

    <h2>Project Name</h2>

    <p class="project-description">
      A concise explanation of the project and what it demonstrates.
    </p>

    <ul class="project-tags" aria-label="Technologies">
      <li>C</li>
      <li>STM32</li>
      <li>FreeRTOS</li>
    </ul>

    <a
      class="project-link"
      href="https://github.com/your-repository"
      target="_blank"
      rel="noreferrer"
    >
      View source
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M6 14 14 6M7 6h7v7"></path>
      </svg>
    </a>
  </div>
</article>
```

Renumber the `project-index` values after adding, deleting, or reordering
projects. To highlight a card, add `project-featured` to its `class` and add
`<span>Featured</span>` inside `project-topline`. Preview the result at
`http://127.0.0.1:4173/projects.html`.

The website has no runtime dependencies and does not require a framework build
on GitHub Pages.
