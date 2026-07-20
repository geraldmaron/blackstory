# BlackStory docs site

Next.js App Router static site published to GitHub Pages at
[geraldmaron.github.io/blackstory](https://geraldmaron.github.io/blackstory/).

**Publish source:** repo Settings → Pages → Deploy from a branch → `main` / **`/docs`**.
The static export is synced into repo-root `docs/` (alongside operating markdown).

## Quick start

From the monorepo root:

```bash
pnpm install
pnpm --filter @repo/docs dev
```

Local URL: http://localhost:3050/ (empty `basePath`).

## Publish to GitHub Pages

```bash
pnpm docs:publish
# then commit the updated docs/ tree (index.html, _next/, guides/, brand/, .nojekyll)
# and push to main
```

`pnpm docs:publish` runs `DOCS_BASE_PATH=/blackstory` build and copies the export into
`docs/` without deleting operating docs (`adr/`, `architecture.md`, …).

## Structure

```
apps/docs/
├── content/                 curated public guides (markdown)
├── public/brand/            lockup, symbol, favicons, open-graph
├── src/app/                 App Router pages + layout
├── src/components/          Shell, sidebar, search, theme
├── src/lib/                 Content index + markdown render
└── next.config.mjs          static export + DOCS_BASE_PATH
```

## Adding a page

1. Add `apps/docs/content/<slug>.md` with YAML front matter (`title`, `description`, `nav`, `order`).
2. Link it from the home page or another guide if needed.
3. `pnpm docs:publish` and commit the refreshed `docs/` assets.
