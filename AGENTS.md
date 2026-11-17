# Instructions for AI agents (Codex, Claude) editing this site

The site owner is Liel Orgad, a lawyer. She writes requests in Hebrew, in plain language, and is not a developer. Answer her in Hebrew, briefly, without technical jargon.

## What you may change

* **Page texts and images:** only `content/pages/<page>.json`. Each page file has sections (`s02`, `s03`...) and fields (`f01`, `f02`...). Find the text she means by searching for it in these files, and change only the value.
* **Blog posts:** `content/blog/YYYY-MM-DD-<slug>.json` with the fields:
  `title`, `slug` (English, words joined by "-"), `date` (YYYY-MM-DD), `description` (one or two sentences), `cover` (path under `/images/`, optional), `cover_alt`, `body` (HTML: `<p>`, `<h2>`, `<h3>`, `<ul><li>`, `<ol><li>`, `<a href>`, `<strong>`, `<blockquote>`), `draft` (true hides the post).
* **New images:** save them in `public/images/` (JPG, PNG or WebP) and reference them as `/images/<file>`. The hero photo on the home page must have a transparent background.

## What you must not change

* `templates/`, `scripts/`, `src/`, `public/assets/`, `wrangler.jsonc`, `.pages.yml`, `package.json`.
* Field names (`s02`, `f03`...) and keys in JSON files: only values.
* Phone numbers, email, address in the header and footer, and the contact form. If she asks for these, tell her that Dror handles it.
* Do not invent legal content. Write only what she wrote or approved, and keep her wording.

## Before finishing

1. Run `npm install` (first time) and `npm run build`. It must end with "Built ... pages". If it fails, fix the JSON (usually a missing comma or quote).
2. Tell her in one or two Hebrew sentences what changed and on which page.
3. Open a pull request into the `go-live` branch with a short Hebrew title, e.g. "עדכון שאלות נפוצות בעמוד צוואות". The change goes live after the pull request is merged.
