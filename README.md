# Portfolio Website

A minimal static portfolio with markdown-based blog posts.

## What is included

- a simple landing page with a short bio
- a filtered blog list
- individual blog post pages
- top navigation for resume, LinkedIn, and email

## How to add a post

1. Create a new markdown file in `posts/` named after the post slug, for example `my-new-post.md`.
2. Add front matter at the top with `title`, `date`, `tags`, and `excerpt`.
3. Write the post body in markdown below the front matter.
4. Run `node build-post-index.mjs` to regenerate `posts/index.json`.
5. Refresh the site in your browser to see the new post appear on the homepage.

## How to publish a new post

1. Make sure the markdown file is saved in `posts/`.
2. Confirm the slug in the file name matches the slug in the generated index.
3. Run `node build-post-index.mjs` before publishing.
4. If you are deploying the site manually, upload the updated `posts/` folder, `posts/index.json`, and `script.js` if it changed.
5. Open the post directly at `post.html?slug=your-slug` to verify the page works.

## Local preview

Run a simple server from the project root:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.
