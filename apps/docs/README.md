# BlackStory docs site

Next.js App Router static site published to GitHub Pages at
[geraldmaron.github.io/blackstory](https://geraldmaron.github.io/blackstory/).

**Publish source:** GitHub Actions, using `.github/workflows/pages.yml`.
Only `apps/docs/out` is uploaded. Repository `docs/` contains internal operating records and must never be a Pages source.

## Quick start

From the monorepo root:

```bash
pnpm install
pnpm --filter @repo/docs dev
```

Local URL: http://localhost:3050/ (empty `basePath`).

## Publish to GitHub Pages

```bash
pnpm docs:publish  # build the curated export locally
# After merging to main:
gh workflow run pages.yml --ref main
```

Set the repository's Pages source to GitHub Actions and `PAGES_ENABLED=true`.
Never copy generated assets into repository `docs/` or publish that directory.

## Structure

```
apps/docs/
├── content/                 curated public guides (markdown)
│   ├── about.md             why the project exists (human essay)
│   ├── install.md           bootstrap
│   ├── architecture.md      surfaces and boundaries
│   ├── methodology.md       research posture
│   └── …
├── public/brand/            lockup, symbol, favicons, open-graph
├── src/app/                 App Router pages + layout
├── src/components/          Shell, sidebar, search, theme
├── src/lib/                 Content index + markdown render
└── next.config.mjs          static export + DOCS_BASE_PATH
```

## Adding a page

1. Add `apps/docs/content/<slug>.md` with YAML front matter (`title`, `description`, `nav`, `order`).
2. Link it from the home page or another guide if needed.
3. Build with `pnpm docs:publish`, merge the source, then dispatch the Pages workflow.
