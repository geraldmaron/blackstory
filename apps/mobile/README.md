# @repo/mobile — BlackStory native app (Expo)


## Monorepo isolation

`apps/mobile` is **excluded** from the root pnpm workspace (`!apps/mobile` in
`pnpm-workspace.yaml`) and uses its own npm lockfile. Shared wire types come from
`@repo/public-contracts` via a `file:` dependency + Metro/tsconfig/Jest resolution
(see `metro.config.js`, `jest.config.js`). Do not rename packages to `@black-book/*`
— the brand-agnostic scope is `@repo/*`.

Bare scaffold only (`black-book-mobile-006` / MOB-006): Expo + Expo Router + TypeScript
strict + `expo-dev-client`, dev/preview/prod identity, EAS build profiles. **No UI, state,
network, map, or Firebase libraries are installed yet** — those land in MOB-007+ per the
[mobile app epic](../../docs/mobile/mobile-app-epic.md)'s non-goal for this bead. See
`docs/adr/ADR-020-mobile-stack.md` for the framework/version-pinning rationale this scaffold
follows.

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

# iOS
npx expo prebuild --platform ios     # generates ios/ (gitignored, CNG — see ADR-020 SS6)
cd ios && pod install && cd ..
npx expo run:ios                     # builds + launches in the Simulator

# Android
npx expo prebuild --platform android # generates android/ (gitignored, CNG)
npx expo run:android                 # requires Android SDK + a working `java`
```

`ios/` and `android/` are **not committed** (ADR-020 SS6): they are pure `expo prebuild`
build output from `app.config.ts` + config plugins. Delete and regenerate them any time; a
stale native directory is never a source of truth.

## CI (black-book-mobile-019)

`.github/workflows/ci.yml` runs two dedicated npm-based jobs when a PR/push touches
`apps/mobile/**`, `packages/public-contracts/**`, or `brand/` (mobile token source),
alongside the root pnpm-based jobs (which cannot see `apps/mobile` — see below).
Unrelated monorepo changes skip these jobs:

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

Known baseline gap (tracked, not silently masked — no `continue-on-error`): **Mobile
Typecheck currently fails** against 7 pre-existing type errors in two test files
(`src/features/entity/__tests__/EntityDetailScreen.accessibility.test.tsx` and
`src/features/entity/__tests__/useEntityDetail.test.ts` — both call
`@testing-library/react-native`'s async `render`/`renderHook`/`rerender` with a stale,
pre-async type expectation). Jest itself is fully green (629/629) because `jest` transpiles
via Babel and never type-checks. See the follow-up bead referenced in
`black-book-mobile-019`'s notes before promoting this check to a required branch-protection
status in `infra/github/rulesets/main-protection.json` (out of this bead's exclusive
ownership — CODEOWNERS/ruleset changes are a separate integrator's call).

**Explicitly out of scope for `black-book-mobile-019` without paid EAS credentials or a
physical/simulator device matrix** (filed as `repo-fsxq` prerequisites first, then a
dedicated follow-up bead once those land): EAS build profiles wired into a workflow,
Android/iOS native build jobs, Maestro E2E flows, on-device accessibility (VoiceOver/TalkBack)
passes, and release/store-submission evidence. `apps/mobile/eas.json`'s `development` /
`preview` / `production` profiles exist for local/manual `eas-build:*` npm scripts today;
none of them run in GitHub Actions yet.

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
wired in `app.config.ts` (ADR-023 §2's OTA/rebuild fence). `updates.url` /
`extra.eas.projectId` are gated on `EAS_PROJECT_ID`, which is unset today — no
Expo/EAS organization has been provisioned yet (`mobile-identity.md` human
gate #3) — so `expo-updates` currently has no update server to poll and stays
structurally inert until that gate clears. `eas.json`'s three build profiles
already each declare a distinct `channel` (development/preview/production),
satisfying ADR-023 §1's "OTA can never cross an environment boundary"
requirement.

**Code-signing decision (ADR-023's 2026-07-20 adversarial-review amendment,
threat-model T6):** EAS Update end-to-end code signing is a **paid EAS
Production/Enterprise-plan feature**, not merely an SDK-support question. To
keep the free-tier-first posture (ADR-023 §7), OTA ships **without** code
signing on the free tier; the blast-radius controls are phishing-resistant MFA
custody of the EAS org, a scoped/revocable CI-only publish token, staged
channel rollout, and immutable-update rollback. This is **accepted risk by
design**, with code signing recorded as a cost-gated upgrade trigger, not a
silent gap. See `src/updates/README.md` for the full decision record, the
human-gate activation steps, and the OTA rollback runbook (ADR-023 §6).

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
