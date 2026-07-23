# @repo/mobile — BlackStory native app (Expo)


## Monorepo isolation

`apps/mobile` is **excluded** from the root pnpm workspace (`!apps/mobile` in
`pnpm-workspace.yaml`) and uses its own npm lockfile. Shared wire types come from
`@repo/public-contracts` via a `file:` dependency + Metro/tsconfig/Jest resolution
(see `metro.config.js`, `jest.config.js`). Do not rename packages to `@black-book/*`
— the brand-agnostic scope is `@repo/*`.

Bare scaffold only (`black-book-mobile-006` / MOB-006): Expo + Expo Router + TypeScript
strict + `expo-dev-client`, dev/preview/prod identity, EAS build profiles. MapLibre Native,
SQLite, and other native modules land via CNG plugins — always run a **dev client** build
(`expo run:ios` / `expo run:android`), never Expo Go. See
`docs/adr/ADR-020-mobile-stack.md` for the framework/version-pinning rationale.

## Version matrix (as actually installed — read from `package.json` / `node_modules`, not guessed)

| Layer | Version | Notes |
|---|---|---|
| Expo SDK | **56.0.16** | Deliberately pinned to the **N-1** SDK line (57 was 19 days old at scaffold time; ADR-020 SS5 says wait for ecosystem/patch maturity before adopting a brand-new SDK). Exact pin, no `^`/`~` range, per ADR-020 SS5. |
| React Native | **0.85.3** | Whatever SDK 56 bundles — never bumped independently of the Expo SDK pin. |
| React | **19.2.3** | Bundled by the SDK. |
| Expo Router | **~56.2.15** | File-based routing, `experiments.typedRoutes: true`. |
| Node | **>=22** (repo root `engines`) | This worktree's Node is v25.9 — satisfies the floor. Inherited from the monorepo root; apps/mobile declares no conflicting `engines` (ADR-020 SS5). |
| pnpm | **9.12.3** (root `packageManager`) | apps/mobile does **not** use pnpm for its own deps — see "pnpm workspace resolution" below. |
| iOS floor | **16.4** | Raised from ADR-020's proposed 16.0 — see "OS floor re-verification" below. |
| Android floor | **API 26 (Android 8.0)** | Matches ADR-020 SS7's proposed floor; enforced via `expo-build-properties`' `android.minSdkVersion`. |

## Fresh-clone runbook

```bash
# From the repo root:
pnpm install                 # installs everything EXCEPT apps/mobile (see below)

cd apps/mobile
npm install                  # apps/mobile manages its own isolated node_modules (npm)

# iOS — always use the custom native binary (dev client), never Expo Go
npx expo prebuild --platform ios     # generates ios/ (gitignored, CNG — see ADR-020 SS6)
cd ios && pod install && cd ..
npx expo run:ios                     # builds + launches BlackStory (Dev) in the Simulator

# Android
npx expo prebuild --platform android # generates android/ (gitignored, CNG)
npx expo run:android                 # requires Android SDK + a working `java`
```

`ios/` and `android/` are **not committed** (ADR-020 SS6): they are pure `expo prebuild`
build output from `app.config.ts` + config plugins. Delete and regenerate them any time; a
stale native directory is never a source of truth.

### MapLibre / native modules — do not use Expo Go

`@maplibre/maplibre-react-native` (and other custom native code) is **not** in Expo Go.
Opening the Metro bundle in Expo Go surfaces:

`TurboModuleRegistry.getEnforcing(...): 'MLRNCameraModule' could not be found`

Config is already correct when present in this tree:

- dependency `@maplibre/maplibre-react-native`
- config plugin `@maplibre/maplibre-react-native` in `app.config.ts`
- `expo-build-properties` → `ios.useFrameworks: 'static'` (MapLibre iOS linkage)
- `expo-dev-client` so `expo start` targets the custom binary

After any native-affecting change (MapLibre, `expo-dev-client`, plugins, Podfile), rebuild:

```bash
cd apps/mobile
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
npx expo run:ios
# then, in a second terminal if you want Metro alone:
npx expo start --dev-client
```

Launch **BlackStory (Dev)** (`app.blackbook.mobile.dev`) from the Simulator home screen or
Xcode — not Expo Go. RN Firebase / App Check is not in this app; `USE_FRAMEWORKS=static`
is only for MapLibre.

## CI (black-book-mobile-019)

`.github/workflows/ci.yml` runs two dedicated npm-based jobs on every PR/push to `main`,
alongside the root pnpm-based jobs (which cannot see `apps/mobile` — see below):

- **Mobile Typecheck**: `npm ci` (isolated `apps/mobile/package-lock.json`), regenerates the
  gitignored `expo-env.d.ts` type-reference shim (Expo normally writes this on first
  `expo start`/`expo prebuild`; CI must recreate it since nothing under `apps/mobile` is
  committed for it), then `npm run typecheck` (`tsc -p tsconfig.json` +
  `tsc -p tsconfig.tooling.json`, covering app source and tests/scripts).
- **Mobile Unit Tests (Jest)**: `npm ci`, then `npm test -- --ci` (`jest-expo` preset).

Both jobs use `actions/setup-node` with `cache-dependency-path:
apps/mobile/package-lock.json` and never touch the root `pnpm-lock.yaml` — `pnpm install
--frozen-lockfile` in the root `validate` job is unaffected. `.github/dependabot.yml` has a
matching `npm` entry scoped to `/apps/mobile` for its isolated lockfile.

**Verified baseline (2026-07-22, `feat/mobile-launch`):** Mobile Typecheck and Mobile Unit
Tests are green locally and in CI shape — **646/646** Jest tests; `tsc` clean for both
`tsconfig.json` and `tsconfig.tooling.json` once the gitignored `expo-env.d.ts` shim is
present (same shim CI regenerates). Promoting these jobs to required branch-protection
status in `infra/github/rulesets/main-protection.json` remains an integrator decision
(outside this README's ownership).

**Still out of scope without paid EAS credentials or a physical/simulator device matrix**
(blocked on `repo-fsxq` first): EAS build profiles wired into a GitHub Actions workflow,
Android/iOS native build jobs, Maestro E2E flows, on-device accessibility
(VoiceOver/TalkBack) passes, and release/store-submission evidence. `apps/mobile/eas.json`'s
`development` / `preview` / `production` profiles exist for local/manual `eas-build:*` npm
scripts today; none of them run in GitHub Actions yet.

## pnpm workspace resolution — verified NOT clean (real finding, not a guess)

`pnpm-workspace.yaml`'s `apps/*` glob technically covers `apps/mobile`, and ADR-020 SS5 asked
MOB-006 to verify whether that "just works." **It does not, without further changes.**
Empirical evidence from this scaffold:

- `npx expo install <pkg>` (no flags) auto-detects the root `pnpm-lock.yaml` and shells out to
  `pnpm add`, which modified the **root** `pnpm-lock.yaml` (thousands of lines) the moment it
  ran — reverted immediately (`git checkout -- pnpm-lock.yaml`) once caught. This is exactly
  the risk ADR-020 SS5 flagged.
- With `apps/mobile/package.json` present under the `apps/*` glob, `pnpm install
  --frozen-lockfile` at the repo root now fails immediately with
  `ERR_PNPM_OUTDATED_LOCKFILE` ("specifiers in the lockfile ({}) don't match specs in
  package.json"), because pnpm treats apps/mobile as a workspace member the lockfile has never
  seen. This reproduces on a clean checkout, not just in this session.
- ADR-020 SS5's own resolution path — excluding `apps/mobile` from `pnpm-workspace.yaml` via a
  negation entry, or isolating it with its own nested lockfile — was the tested fix, but
  **editing `pnpm-workspace.yaml` was out of scope for this scaffolding session** (explicit
  session boundary: do not modify it if the existing glob already "covers" apps/mobile,
  precisely to avoid racing a parallel change to the root lockfile from unrelated concurrent
  work). So `pnpm-workspace.yaml` is unchanged in this commit.

**Net effect:** `apps/mobile` currently keeps its **own isolated `node_modules` and
`package-lock.json` via npm** (`npx expo install ... --npm` for every dependency change), which
works today for local development and `expo prebuild`/`pod install`, but **`pnpm install
--frozen-lockfile` at the repo root will fail as soon as this lands**, until a follow-up either:

1. adds `- '!apps/mobile'` to `pnpm-workspace.yaml` (cleanest — apps/mobile stays on its own
   npm-managed dependency graph permanently), or
2. runs one coordinated root `pnpm install` that adds apps/mobile's deps to the lockfile
   (bigger diff, couples apps/mobile onto the shared pnpm store).

This is real, reproducible MOB-006 evidence for ADR-020 SS5's open risk, not a
theoretical concern — flag it before merging this scaffold, ideally as its own immediate
follow-up bead so CI's frozen-lockfile install doesn't start failing on `main`.

## Lint — isolated from the root ESLint config (also verified, not assumed)

The monorepo root `pnpm lint` runs `@repo/eslint-config` (tuned for the Next.js/Node apps)
across `apps/`. Running it against the stock Expo template code failed hard — RN's idiomatic
`require()` for image/font assets trips `@typescript-eslint/no-require-imports`, which
`@repo/eslint-config` has no RN exception for. `apps/mobile/eslint.config.js` (this directory)
uses Expo's own maintained `eslint-config-expo` instead; ESLint's flat-config resolution finds
the nearest config walking up from a file, so this local config governs everything under
`apps/mobile` without needing (or being permitted, in this session) to edit the root
`eslint.config.mjs`. Run `npm run lint` from `apps/mobile`, not the root aggregate, until/unless
a follow-up wires an explicit ignore for `apps/mobile/**` into the root config.

## OS floor re-verification (ADR-020 SS7 — required at MOB-006 scaffold time)

ADR-020 proposed iOS 16 / Android API 26, above Expo SDK 54's then-current platform floor
(~iOS 15.1). At this scaffold's actual pinned SDK (56), `pod install` failed until the iOS
floor was raised to **16.4** — several Expo-bundled pods (`expo`, `expo-asset`,
`expo-modules-core`, etc.) now require iOS 16.4 outright. Per ADR-020 SS7 ("whichever SDK
MOB-006 actually pins governs"), the **platform floor now governs**: `app.config.ts` sets
`ios.deploymentTarget: '16.4'`, not the originally-proposed 16.0. Android's API 26 floor is
unaffected and is enforced via the `expo-build-properties` plugin
(`android.minSdkVersion: 26`), confirmed present in the generated
`android/gradle.properties` (`android.minSdkVersion=26`) after `expo prebuild`.

## Public data path (why Dev may not “hit Supabase”)

Mobile never talks to Supabase/Postgres directly (ADR-022). The only network
origin is `extra.apiBaseUrl` → `apps/api-public` over HTTPS (or LAN HTTP in
Dev). That service reads `bb_public.*` when
`PUBLIC_DATA_SOURCE=postgres` + `DATABASE_URL` / `APP_DATABASE_URL` are set.

| Surface | Data source today |
|---|---|
| **Explore** map + list | Bundled `DEMO_MAP_SOURCE` fixtures — **no API call**. Subtitle shows `demo fixtures (not live API)` in `__DEV__`. ADR-025’s live GeoJSON path is not wired; `api-public` has no map FeatureCollection route yet. |
| **Learn** | Bundled `content-catalog.ts` (not `/v1/content`). |
| **Search** / **entity** / cold-start **bootstrap** | HTTP to `API_BASE_URL` (`/v1/search`, `/v1/entity/:id`, `/v1/bootstrap`) with `X-BlackStory-Client`. SQLite is a release-coupled cache, not a fixture pack. |
| **Web Explore** | Server-side Postgres in Next.js — unrelated to mobile’s API host. |

**Defaults:** `app.config.ts` and preview/production `eas.json` bake
`https://api.blackbook.app`. Development EAS profile leaves `API_BASE_URL`
unset, so local `expo start` uses that same default. As of 2026-07-22 that
host is **NXDOMAIN** and Cloud Run has no `black-book-api-public` service —
bootstrap/search/entity fail with network errors (logged in Metro); Explore
still shows a few demo pins (unrelated to MapLibre glyph/style issues).

### Local Dev → live Supabase via api-public

```bash
# Terminal A — api-public on :8080 against Supabase
cd apps/api-public
run-with-dev-secrets -- env \
  PUBLIC_DATA_SOURCE=postgres \
  DATABASE_SSL=1 \
  pnpm dev

curl -sS -H 'X-BlackStory-Client: mobile/1.0.0; api=1' \
  http://127.0.0.1:8080/v1/bootstrap | jq .
curl -sS -H 'X-BlackStory-Client: mobile/1.0.0; api=1' \
  'http://127.0.0.1:8080/v1/search?q=black&pageSize=5' | jq .
# Expect a real activeRelease + non-empty results when bb_public is populated.

# Terminal B — point BlackStory (Dev) at the API
# apps/mobile/.env.local (simulator):
#   API_BASE_URL=http://127.0.0.1:8080
# physical device: use the Mac LAN IP, e.g. http://192.168.1.50:8080
cd apps/mobile && npx expo start --dev-client --clear
```

Metro should log `[blackstory] apiBaseUrl=…` and
`[blackstory] apiBaseUrl=… { bootstrapSync: … }`. An unreachable host logs
`bootstrapSync offline` with the LAN-run hint. Tracker: `repo-tahv`.

## Client attestation & observability (MOB-010 / MOB-018)

The app attests to `apps/api-public` and `apps/api-submissions` via the
`X-BlackStory-Client: mobile/<version>; api=<major>` header on every request.
Server-side validation uses the Postgres-backed client registry — there is **no**
Firebase App Check, no `@react-native-firebase/*` dependency, and no
GoogleService config in this app.

Crash/perf signals go to the **dev console only** (`__DEV__`) through the
redacting wrapper in `src/observability/crash-reporter.ts`. Production builds
emit nothing from that layer.

### What each config input is (and whether it's a secret)

| Env var (read by `app.config.ts`) | Purpose | Secret? |
|---|---|---|
| `APP_VARIANT` | `development` \| `preview` \| `production` identity tier | no |
| `API_BASE_URL` / `SUBMISSIONS_BASE_URL` | public API origins (→ `extra.apiBaseUrl`) | no |
| `OBSERVABILITY_ENABLED` / `PERFORMANCE_SAMPLE_RATE` | MOB-018 kill switch + sampling | no |

All are validated at config-eval time — a bad URL or an out-of-range sample rate
**fails the build fast, by name, without printing a value**. See `.env.example`
for the full template and `eas.json` for the committed non-secret per-profile
`env` blocks.

### Wired vs. still human-gated

| Item | Status |
|---|---|
| Client header on every API request | ✅ wired (`src/security/api-client.ts`) |
| Observability bootstrap on cold start | ✅ wired (`AppProviders.tsx` → `initializeObservability`) |
| Env-driven, validated `extra` (api/observability) | ✅ wired |
| `.env.example` + EAS env runbook | ✅ wired |
| Apple Developer Program / Google Play Console / EAS org + billing | ⛔ human gate (`repo-fsxq`) |
| Bundle-id availability, trademark, spend ceiling | ⛔ human gate (`repo-fsxq`) |

## EAS Update / OTA (MOB-019, repo-ovn7)

`expo-updates` is installed and `runtimeVersion: { policy: 'appVersion' }` is
wired in `app.config.ts` (ADR-023 §2's OTA/rebuild fence). `extra.eas.projectId`
defaults to the provisioned project (`@gerald-maron/blackstory`) so local
`eas device:*` / CLI stay linked. **OTA itself is off for
`APP_VARIANT=development`** (`updates.enabled: false`,
`checkAutomatically: 'NEVER'`) so BlackStory (Dev) + Metro own the JS bundle —
leaving the updater on with a live `updates.url` previously fought Metro /
Expo codesigning and looked like continuous refresh. Preview/production keep
`updates.url` + `ON_LOAD` against their `eas.json` channels (ADR-023 §1:
OTA never crosses an environment boundary).

**Code-signing decision (ADR-023's 2026-07-20 adversarial-review amendment,
threat-model T6):** EAS Update end-to-end code signing is a **paid EAS
Production/Enterprise-plan feature**, not merely an SDK-support question. To
keep the free-tier-first posture (ADR-023 §7), OTA ships **without** code
signing on the free tier; the blast-radius controls are phishing-resistant MFA
custody of the EAS org, a scoped/revocable CI-only publish token, staged
channel rollout, and immutable-update rollback. This is **accepted risk by
design**, with code signing recorded as a cost-gated upgrade trigger, not a
silent gap. See `src/updates/README.md` for the full decision record, the
activation steps, and the OTA rollback runbook (ADR-023 §6).

### If Dev Client keeps refreshing

```bash
# Stop Metro (Ctrl+C), then:
rm -rf ~/.expo/codesigning/51a35884-e6b5-43b6-b95b-c5a7460fa665
mkdir -p ~/.expo/codesigning/51a35884-e6b5-43b6-b95b-c5a7460fa665
cd apps/mobile
npx expo prebuild --platform ios   # regenerates Expo.plist with updates.enabled=false
cd ios && pod install && cd ..
npx expo start --dev-client --clear
# In another terminal / Xcode: launch BlackStory (Dev), not Expo Go
npx expo run:ios
```

In the simulator Dev Menu (⌘D): disable Fast Refresh only if a bad HMR loop
persists after the cache clear. Never open this project in Expo Go (MapLibre
native module is missing there).

## Package naming — a documented discrepancy, not a guess

`docs/mobile/decisions/mobile-identity.md` states the live package scope is `@black-book`
and calls `@repo` "a stale pre-rename scope surviving only in build artifacts." Checking this
worktree's actual `packages/*/package.json` / `apps/*/package.json` files at scaffold time
shows the opposite: every existing package here is still `@repo/*` (e.g. `@repo/web`,
`@repo/config`, `@repo/typescript-config`) — the identity doc's rename claim does not hold in
this branch, even though a commit on this same branch (`d237aa9`) says it "fixed" the
scope reference in that doc. This package is named **`@repo/mobile`** to match every sibling
package actually present today; if/when the real `@repo` → `@black-book` rename lands on this
branch, `apps/mobile`'s name should be renamed alongside every other package in the same
commit, not out of step with it.

## What was verified vs. what remains (adversarial-case checklist)

Verified with runtime evidence in this session:

- `npx expo-doctor`: 21/21 after fixing an `eas-cli`-as-local-dependency flag (removed; use
  `npx eas-cli` instead) and the pnpm-lockfile issue above.
- `npx expo prebuild --platform ios` + `cd ios && pod install`: succeeded cleanly — 103
  dependencies from the Podfile, 102 pods installed, no errors.
- `npx expo prebuild --platform android`: succeeded; confirmed `minSdkVersion=26` landed in
  the generated Gradle config.
- `npm run typecheck` (`tsc --noEmit`) and `npm run lint` (`expo lint` via the local
  `eslint-config-expo`): both clean.
- `npm run build` (`expo export`): produced real static web bundles (JS + CSS + routes) —
  proves the JS/TS graph actually bundles end-to-end.
- Root `pnpm install --frozen-lockfile` behavior with `apps/mobile` present (see above) —
  confirmed it fails today; this is real, not assumed.

Not verified / explicitly out of scope for this pass:

- **No physical-device or simulator boot.** A full `xcodebuild`/simulator launch and an
  Android emulator/Gradle build were not attempted — no Xcode simulator run and no working
  `java` were exercised in this session (`java -version` reports no runtime installed here).
  `pod install` is the iOS build-readiness evidence; Android prebuild-config-only is the
  Android evidence.
- **Physical-device dev builds** (a real iPhone/Android device paired to a real
  Apple/Google developer account) are out of scope structurally, not just for this session —
  MOB-001's human gates (Apple Developer Program, Google Play Console, EAS org) are not yet
  cleared, so there is no signing identity to test against yet.
- **Stale native-directory recovery** (deleting `ios`/`android` mid-development and
  re-running `expo prebuild` cleanly) was exercised once each for iOS/Android in this session
  (both regenerated cleanly after the OS-floor fix), but not stress-tested across repeated
  config changes.
- **Metro resolving server-only barrel files** — not applicable yet: no `packages/*` imports
  exist in apps/mobile's source, and `packages/public-contracts` (MOB-003, in progress on this
  branch by a parallel change) is not yet consumed here.
- **New-architecture compatibility** — SDK 56 no longer exposes a `newArchEnabled` toggle at
  all (confirmed against `@expo/config-types`); New Architecture is the only supported mode,
  so there is nothing to opt into or verify as a separate axis.
- **Root `pnpm install --frozen-lockfile` full CI gate** — reproduced the failure (see above)
  but did not resolve it, per this session's explicit boundary against editing
  `pnpm-workspace.yaml`/root lockfile. Flagged as an immediate follow-up, not silently left
  broken without notice.
