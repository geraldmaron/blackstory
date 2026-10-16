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
npm test               # unit tests: nonce helpers and every edge module
npm run test:served    # runs against dist/: SEO head, nonce, maintenance wall, crawler deny, staff gate, headers
npm run lint && npm run format:check
```

## How it is put together

- **Server entry** `server/entry.cjs` is the replacement for `apps/web/src/proxy.ts`. It runs the edge
  pipeline in the same order (`server/edge/pipeline.cjs`): maintenance wall, AI/SEO-crawler deny on
  expensive paths, staff gate for `/admin` and `/design-system` (Supabase session, `app_role` must be
  a staff role), then passes to `expo-server/adapter/http`. Every response gets the global security
  headers with this request's nonce; HTML gets the nonce on every script, style and script preload;
  cacheable public documents get `Vercel-CDN-Cache-Control`. No patch to Expo's compiled output.
  Static build output under `/_expo/static` skips the gates, as `/_next/static` did.
- **Edge modules** (`server/edge/*.cjs`) are ports of the Next originals, with a drift guard:
  `apps/web/src/lib/site-edge-parity.test.ts` asserts the port equals the original across tables of
  user agents, paths, env settings, CSP options and roles. The one intended difference is the exempt
  static path. Delete that test with `apps/web`. `agent-lists.json` also feeds robots/ai.txt later.
- **Request targets are normalized first** (`server/edge/paths.cjs`): percent-decoding, dot segments and
  slash collapsing, so `/%61dmin`, `/admin/../admin` and `//host/admin` are all `/admin` for every gate;
  Expo's loader data endpoint `/_expo/loaders/<route>` is gated as `<route>`; a malformed target is a 400.
  The staff gate matches case-insensitively. A gate that throws answers 500, never falls through.
- **Nonce rewrite is narrow** (`server/nonce.cjs`): the finished HTML is rewritten, so only what Expo's
  renderer emits is marked (scripts and preloads under `/_expo/static/`, one inline `_R_` bootstrap, one
  inline module flag, styles). Markup an injection added never receives the nonce. JSON-LD goes through
  `src/lib/json-ld.js`, which escapes `<`, `>`, `&` so a value cannot end the script element.
- **Responses**: HTML is buffered (16 MiB cap) for the nonce; everything else streams through.
- **Query canonicalization** (`server/edge/query-normalization.cjs`, `records-query.cjs`): on public routes a
  query that is not canonical (tracking tags, junk keys, untrimmed or out-of-range values, a trailing slash)
  gets a 308 to the canonical URL, so `?x=` cannot fragment the CDN's HTML cache. `_vercel_*` params survive.
  Loader data requests are never canonicalized. The 413 request-size limit uses the same route set.
- **Not ported yet**: `/explore` canonicalization. It needs the Explore URL-state parser (map port,
  `repo-5tjl0`), so `/explore` passes through unchanged and a test asserts that gap.
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
