# @repo/site: Expo web (SDK 58) + Tamagui

The public BlackStory site, replacing `apps/web` (Next.js). Decision and plan:
`docs/ui/expo-tamagui-migration-plan.md` (sections 10 to 12) and epic `repo-v0lfu`.

Like `apps/mobile`, this package is outside the pnpm workspace (`!apps/site` in
`pnpm-workspace.yaml`), owns an npm lockfile, and lints and formats itself.

```bash
cd apps/site
npm install
npm run dev            # Metro dev server on :8081
npm run export         # production build into dist/
npm run serve          # own server entry on :3060 (PORT to change)
npm test               # unit tests (nonce helpers)
npm run test:served    # runs against dist/: SEO head, landmarks, nonce on every tag, isolation
npm run lint && npm run format:check
```

## How it is put together

- **Server entry** `server/entry.cjs` wraps `expo-server/adapter/http` and adds a per-request CSP
  nonce to every script, style and script preload, plus the header. No patch to Expo's compiled
  output: SDK 58 renders the document as one chunk. It is where the `proxy.ts` features move
  (maintenance gate, staff auth gate, crawler deny; `repo-doplj`).
- **Metadata** uses the route's `generateMetadata` (title, description, canonical, Open Graph).
  `expo-router/head` only updates tags after hydration. JSON-LD is a `<script>` in the page tree.
- **Tokens**: `tamagui.config.ts` builds two themes from `brand/tokens/colors.json` with semantic roles
  (`$background`, `$color`, `$colorMuted`, `$borderColor`, `$accent`). Components use roles, never hex.
- **Imports**: slim `@tamagui/stacks` and `@tamagui/text`, not the `tamagui` umbrella (130 KB gz less JS).
  Tamagui is pinned to 2.7.7; 3.0 shipped 2026-10-10 and is still churning. Compiler extraction is
  off (it broke server HTML under SDK 57; revisit on 58).
- **Tamagui 2 uses `render="header"`**, not `tag`. `tag` silently renders a `<div tag=...>`.

## Known issues

- `tsc` reports style-prop errors (alignItems, padding, maxWidth) under Expo's tsconfig even with the
  stock Tamagui config. Tracked in beads; runtime is unaffected.
- `/methodology` imports its copy from `apps/web/src/app/methodology` (watched in `metro.config.js`)
  until the Next app is removed.
