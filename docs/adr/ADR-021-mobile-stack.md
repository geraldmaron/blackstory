# ADR-021: Mobile stack — Expo React Native, MapLibre Native, App Check attestation, and SQLite offline cache

- **Status:** **Accepted (with amendments)** — 2026-07-20 adversarial review; owner authorized decision-making after review + research (supersedes the prior "awaiting owner acceptance" gate)
- **Date:** 2026-07-19 (accepted-with-amendments 2026-07-20)
- **Deciders:** mobile-program-review (agent); accepted under explicit owner authorization to decide after adversarial review
- **Bead:** MOB-002 (`black-book-mobile-002`); acceptance gate `repo-5os2`
- **Supersedes:** none
- **Depends on:** ADR-004, ADR-005, ADR-008, ADR-010, ADR-011, ADR-013
- **Blocks:** MOB-003, MOB-006, MOB-010, MOB-011

## Adversarial review disposition (2026-07-20)

Verdict: **Accepted with amendments.** Every core decision (Expo managed + CNG, Expo Router, MapLibre
Native, RN Firebase App Check only, `expo-sqlite`) survived the adversarial pass and matches both 2026
official guidance and what the branch actually shipped (`apps/mobile` now exists — MOB-004…018 landed; the
"Today: does not exist" tables below are historical). Amendments, all validated against the live repo:

1. **SDK/OS-floor facts were stale (§7).** This ADR was drafted against Expo SDK 54 / RN 0.81. The branch
   ships **Expo SDK 56.0.16** (released 2026-05-21), **React Native 0.85.3**, **React 19.2.3**,
   `react-native-web` 0.21, **TypeScript 6.0.3** — verified in `apps/mobile/package.json` and against
   Expo's SDK 56 changelog and versions table (expo.dev/changelog/sdk-56;
   docs.expo.dev/versions/v56.0.0). SDK 56's platform minimums are **iOS 16.4 / Android 7 (API 24)**.
   `app.config.ts` correctly re-verified this at scaffold time: `ios.deploymentTarget: '16.4'` (the
   platform minimum now *exceeds* the proposed 16.0 floor, exactly as §7 anticipated — "whichever SDK
   MOB-006 pins governs"), and Android is deliberately held **above** the SDK minimum at
   `minSdkVersion: 26` via `expo-build-properties`. §7's "current stable = SDK 54 … iOS 15.1 / API 24"
   prose is superseded by this block.
2. **New Architecture is now mandatory, not optional.** SDK 55+/RN 0.83+ removed the legacy architecture
   (expo.dev/blog/upgrading-to-sdk-56); `app.config.ts` sets no `newArchEnabled` toggle because the field
   no longer exists. MapLibre RN **v11 is new-arch-only** (Fabric/TurboModules;
   maplibre.org/maplibre-react-native) and RN Firebase App Check **v25** is new-arch-compatible (new arch
   *required* from v26; rnfirebase.io/app-check/usage) — both shipped pins (`^11.3.6`, `^25.1.0`) are
   consistent. This closes the "RN new-arch breakage" adversarial challenge: the stack is new-arch-native.
3. **pnpm layout: the §5 isolation *fallback* is what shipped, not the primary decision.** §5 preferred
   keeping `apps/mobile` inside the workspace with targeted `public-hoist-pattern` entries and only
   isolating as a last resort. The branch took the **isolation path**: `pnpm-workspace.yaml` excludes
   `apps/mobile` (`'!apps/mobile'`), the app carries its **own npm lockfile**, and `metro.config.js`
   resolves `@repo/public-contracts` via `extraNodeModules` + `watchFolders` + the package's `development`
   export condition. This is defensible and arguably *stronger* than the primary plan: mobile is entirely
   outside the pnpm dependency graph, so the root `pnpm install --frozen-lockfile` and every
   web/admin/api-*/worker build are provably unaffected by construction (the §5 blocking gate is satisfied
   trivially). Cost: two package managers in one repo, and `@repo/public-contracts` must build to `dist/`
   for any non-Metro consumer. §5's "do NOT exclude / keep in workspace" preference is amended to record
   that isolation was adopted on measured pnpm/Metro friction.
4. **App Check "reads fail open" — resolved (§3).** §3 originally claimed unconditional read fail-open under
   an App Check outage, but `@repo/security`'s quota matrix hard-denied `expensive_read` (e.g. `/v1/search`)
   for unattested anonymous callers with no outage carve-out — a real contradiction, tracked by `repo-uqmm`.
   **Update 2026-07-20 (repo-uqmm resolved, CLOSED):** `@repo/security` now takes an explicit
   `appCheckAvailability: 'available' | 'outage'` signal. Normal operation is unchanged (unattested
   `expensive_read`/`mutation` still hard-denies `app_check_required` — the enumeration/abuse defense stays).
   Only when a systemic operator/circuit signal reports a confirmed `'outage'` does the hard-deny relax, and
   it relaxes to a **bounded degraded quota** (`deriveOutageDegradedPolicy`, ~1/4 of anonymous caps, floored
   at 1, single concurrency) — never to free/unbounded access. `risk_score_exceeded` still fails closed during
   an outage (a real abuse signal, not mere token absence). Static reads were always ungated and remain so.
   §3's fail-open language below is updated accordingly. **Update 2026-07-20 (repo-vdnm resolved, CLOSED):**
   `@repo/firebase`'s rolling-window verifier-failure circuit breaker and `apps/api-public`'s
   `resolveAppCheckAvailability` provider now auto-emit `'outage'` on sustained verifier throws; manual
   `APP_CHECK_OUTAGE_OVERRIDE` still wins when set (commit b94a990d / PR #19).

No decision is reversed. Rejected alternatives stand. `repo-uqmm` and `repo-vdnm` are both resolved and closed
(2026-07-20).

## Scaffold vs target

| Aspect | Today (this bead) | Target (MOB-006 and beyond) |
|--------|--------------------|------------------------------|
| App code | No `apps/mobile` exists; no `eas.json`, no Expo account | `apps/mobile` Expo project scaffolded (MOB-006), EAS Build/Update wired (MOB-019) |
| Framework | Decision only | Expo managed workflow + Continuous Native Generation (CNG), Expo Router |
| Map | Web uses MapLibre GL JS (ADR-013) | MapLibre Native (`@maplibre/maplibre-react-native`) against the same self-hosted PMTiles (MOB-011) |
| Firebase client | Web apps use the JS SDK behind App Check reCAPTCHA | React Native Firebase App Check only (App Attest / Play Integrity), no client Firestore |
| Local storage | None | `expo-sqlite` offline cache; schema designed in MOB-009 |
| Read boundary | `apps/api-public` serves web | Same `apps/api-public` serves mobile (program invariant 2) |

This ADR **decides and justifies** the stack; it ships no code. Every downstream bead it blocks
(MOB-003 contracts, MOB-006 scaffold, MOB-010 security, MOB-011 map data) inherits these choices.

## Context

The mobile program (`docs/mobile/mobile-app-epic.md`) commits to a native iOS and Android reader that
matches the public web app's truth, evidence, map, dignity, and correction posture **without duplicating
canonical data or weakening security**. Two program invariants bound every choice here: the mobile client
reads only through `apps/api-public` (invariant 2), and only environment-neutral contracts and pure behavior
are shared across web and mobile (invariant 3). MOB-001 (`docs/mobile/decisions/mobile-identity.md`) already
fixed the identity surface: product name BlackStory, domain `blackbook.app`, proposed bundle id
`app.blackbook.mobile`, United States only, and **no accounts, push, or social features at launch**.

Three properties of this specific project dominate the framework decision more than raw benchmark numbers:

- **One-maintainer operational reality.** The project's `operating-principle-runs-itself-within-reason`
  posture (budget-capped, kill-switch, free-tier-first — see MOB-001 spend-ceiling gate) means the mobile
  stack must be maintainable by the same person who runs the web app and workers, not a mobile-specialist team.
- **A TypeScript monorepo with a hard contract boundary.** The public read surface is already TypeScript
  (`apps/api-public`), and MOB-003 will produce a versioned `packages/public-contracts` package. A JS/TS
  client can consume those contract types directly; any non-JS client would need a parallel, hand-maintained
  copy of the same types, which is exactly the drift program invariant 3 exists to prevent.
- **An accepted map doctrine to parallel, not reinvent.** ADR-013 already chose MapLibre GL JS for the web
  for its BSD license, absence of a vendor API key, and self-hosted Protomaps PMTiles served from Firebase
  Hosting/CDN, rendered in a fixed dark, desaturated "archive of record" register. The mobile map must land
  in the same place for the same reasons, differing only where the runtime genuinely differs.

Adjacent accepted ADRs this decision must fit inside, not contradict:

- **ADR-005** (service separation): mobile "later consumes the same public/submissions contracts (invariant 20);
  do not invent mobile-only services now." No new backend surface is created for mobile.
- **ADR-010** (security assumptions): browser — and by extension mobile — clients are untrusted for
  authorization; App Check is mandatory; "mobile-specific security models" are explicitly a v1 non-goal for the
  server architecture, which means the mobile client adapts to the existing server posture rather than the
  server bending to the client. Logs must never contain raw App Check tokens.
- **ADR-011** (Firestore system of record): public clients may read only under `public/**`; privileged writes
  are Admin-SDK-only from Cloud Run/workers. A mobile client therefore has no legitimate direct-Firestore role.
- **ADR-004** (immutable snapshots): the public surface is release-versioned, static-first JSON — an ideal shape
  for an offline cache to mirror.

## Decision

### 1. Framework — Expo (managed workflow + CNG) with Expo Router

The mobile app is an **Expo application using the managed workflow with Continuous Native Generation (CNG) and
custom development builds** (`expo-dev-client`), navigated by **Expo Router** (file-based routing). It is **not**
bare React Native CLI, not Flutter, and not per-platform native Swift/Kotlin.

Decision drivers:

- **Single JS/TS codebase sharing types with the web contracts.** The client imports the same
  `packages/public-contracts` types the API produces (MOB-003), so a contract change is a compile error on both
  surfaces at once. This is the cheapest possible enforcement of program invariant 3.
- **EAS build/update infrastructure fits a one-maintainer operation.** Expo Application Services provides
  cloud-hosted native builds (no local Xcode/Android farm to maintain), managed signing credentials (a fallback
  if Apple/Google credentials are ever lost — flagged in MOB-001's adversarial review), and over-the-air
  JS updates with staged rollout and rollback that mirror ADR-004's "atomic activation, proven rollback"
  discipline (program invariant 4). A one-person operation cannot economically run a self-hosted native CI farm.
- **Dev velocity.** File-based routing (Expo Router), config plugins, `expo install` version resolution, and
  Expo's curated module set collapse most of the native-integration work that bare RN leaves as manual glue.
- **CNG, not bare, preserves reversibility.** Managed CNG keeps native folders generated from
  `app.config.ts` + config plugins (see §6). The escape hatch — dropping to committed native code — remains
  available per-module via config plugins without abandoning Expo, so choosing Expo does not forfeit native
  extensibility.

Reversal cost is stated per alternative in "Rejected alternatives" and consolidated in "Reversal cost."

### 2. Map — MapLibre Native (`@maplibre/maplibre-react-native`)

The mobile map surface renders with **MapLibre Native via `@maplibre/maplibre-react-native`** (the MapLibre
organization's community React Native binding). This is the deliberate mobile parallel to ADR-013's MapLibre GL
JS choice for web: same BSD-family license, no vendor API key in the render path, and the **same self-hosted
Protomaps PMTiles archive served from Firebase Hosting/CDN** (authored under MOB-011), styled in the **same fixed
dark, desaturated "archive of record" register** — Black Ink canvas, Copper Pin points, never a bright tourism
basemap, and independent of any in-app light/dark toggle exactly as ADR-013 mandates for web.

What genuinely differs on mobile, and is therefore in scope for MOB-011/MOB-012 rather than assumed identical:

- **Native GPU rendering.** MapLibre Native renders through the platform's native graphics stack (Metal on iOS,
  OpenGL ES / Vulkan on Android) rather than a browser WebGL canvas. There are **no browser vendor prefixes,
  no `maplibre-gl` CSS import, and no SSR/hydration concern** — the map is a native view, not a DOM element.
- **Offline tile caching.** Unlike a browser, a native app can persist tiles across launches. MapLibre Native
  exposes an offline region/ambient-cache API. Program non-goals forbid a **full offline basemap** at launch,
  so MOB-011 must scope caching to a **bounded ambient cache** (recently viewed tiles, size-capped) — not a
  pre-downloaded national pack — unless MOB-022 later changes scope on measured evidence. The PMTiles
  range-request strategy from ADR-013 still applies: the client reads byte ranges over HTTPS, not whole archives.
- **Style-token sourcing.** The dark-archive style must pull the same brand tokens (MOB-007, from `brand/`) the
  web style pulls, so the two map surfaces cannot drift.

### 3. Firebase access — React Native Firebase App Check only (native attestation)

The client links **only** the App Check surface of React Native Firebase (`@react-native-firebase/app` +
`@react-native-firebase/app-check`). It does **not** link `@react-native-firebase/firestore`,
`@react-native-firebase/auth`, or any other data module. Canonical data reaches the app **only** through
`apps/api-public` (program invariant 2; ADR-011 §7). App Check is **attestation, not authorization** (program
invariant 6; ADR-010 trust assumption 3): a compromised client that forges attestation must still gain no
canonical write path, because there is no client write path to gain.

Why native attestation rather than the web SDK's reCAPTCHA-based provider:

- The web apps use App Check's reCAPTCHA Enterprise provider because a browser is the only attestation primitive
  available there. A native app has **hardware- and OS-backed attestation** the browser cannot offer:
  **App Attest** (Apple DeviceCheck App Attest) on iOS and the **Play Integrity API** on Android. These attest
  that a genuine, unmodified build of *this* app is running on a genuine device, which is a materially stronger
  signal than a reCAPTCHA challenge and requires no user-facing challenge friction.
- Running the reCAPTCHA provider inside a native WebView would be strictly worse: weaker signal, more third-party
  surface, and a UX regression, for no benefit.
- App Attest requires iOS 14+ and Play Integrity requires current Play services — both comfortably satisfied by
  the OS floor in §7. Attested requests hit the **same App Check + query-guardrail middleware** every
  `api-public` endpoint already enforces (ADR-013 §1; ADR-008 decision 6), so the server contract is unchanged;
  only the provider on the client differs. Per ADR-010, **raw App Check tokens must never be logged** on either
  surface (also program invariant 7).

**Monitor → enforce rollout (bead requirement; owned by MOB-010).** App Check is rolled out in stages, never
flipped straight to hard enforcement. (1) **Monitor mode first:** register the App Attest / Play Integrity
providers and ship attestation from the client, but the server keeps App Check as a pure *observed signal*
(`missing_app_check` risk input) — no request is denied for a failed/absent token — while MOB-018 dashboards
watch the legitimate-client verified-attestation rate across the real device/OS fleet. (2) **Promote to enforce
only on evidence:** move an endpoint class to enforcement (deny/tighten on threshold) only once monitor metrics
show the false-negative rate on genuine clients is negligible, so enforcement cannot lock out honest users on a
provider quirk. (3) **Even under enforcement, reads fail open** to rate-limited `anonymous` access on an App Check
*outage* (threat model T2; ADR-010 degraded-read doctrine) — enforcement raises abuse cost, it is never a hard
availability gate on public content. This staged posture is the mobile analogue of ADR-010's "tighten (never
silently loosen) App Check enforcement when moving staging → prod." **Amended 2026-07-20 (repo-uqmm resolved):**
static reads were always ungated and remain fully fail-open in every mode. For `expensive_read` (e.g.
`/v1/search`), `@repo/security`'s quota matrix now distinguishes normal operation from a *confirmed* App Check
outage via an explicit `appCheckAvailability` signal (never inferred from a single caller's missing token):
during normal operation, an unattested anonymous caller is still hard-denied `app_check_required` (the
enumeration/abuse defense); during a confirmed outage, the hard-deny relaxes to a **bounded degraded quota**
(`deriveOutageDegradedPolicy`, ~1/4 of anonymous caps) rather than either a hard lockout or free access.
`risk_score_exceeded` still fails closed on a genuine abuse spike even during an outage. The client should
still treat a `429` as authoritative rather than assuming unlimited fail-open — the guarantee is bounded
availability, not unlimited access. **Update 2026-07-20 (repo-vdnm resolved, CLOSED):** automatic outage
detection is live — `@repo/firebase`'s verifier-failure circuit breaker flips `appCheckAvailability` to
`'outage'` on a sustained throw pattern; the operator `APP_CHECK_OUTAGE_OVERRIDE` env flag still takes
precedence when set.

### 4. Local storage — `expo-sqlite`

The offline cache engine is **`expo-sqlite`** (SQLite). MOB-009 designs the actual schema and migrations; this
ADR only fixes the engine. The public surface is release-versioned, static-shaped JSON (ADR-004), and the
offline cache must hold **entity, evidence, timeline, and map artifacts** keyed for lookup and light querying —
a relational store fits that far better than a key-value blob.

| Engine | Storage / query model | Expo native-module maturity | Bundle / footprint | Fit for entity/evidence cache |
|---|---|---|---|---|
| **`expo-sqlite`** | Full SQLite; SQL queries, indexes, transactions, async API | First-party Expo module, in the supported-modules list, CNG-native | Modest; SQLite ships with the OS, binding is thin | **Chosen** — relational queries + migrations for versioned cached entities/evidence |
| AsyncStorage | Unstructured key-value only | Community, Expo-supported | Small | Poor — no query/index; re-implementing SQL by hand |
| MMKV (`react-native-mmkv`) | Very fast key-value | Community; needs a dev build (not Expo Go) | Small | Poor for relational cache; excellent as a small fast prefs/KV store, complementary not competing |
| WatermelonDB | ORM **on top of SQLite**; reactive | Community; extra native/config-plugin setup | Larger (ORM + adapter) | Capable but heavier abstraction over the same SQLite we can use directly |
| Realm (Atlas Device SDK) | Object DB, live objects | Community | Largest | **Rejected** — MongoDB deprecated Atlas Device Sync/Realm (sunset announced 2024); adopting a vendor-deprecated engine is a liability |

`expo-sqlite` wins on the axis that matters: it gives real relational query capability and migration support with
the least native-module and bundle cost, as a first-party module inside Expo's tested matrix. MMKV may still be
adopted **alongside** SQLite for tiny hot key-value needs (e.g. last-viewed state restoration, MOB-008); that is
not a competing choice, and MOB-009 may make it. The relational cache engine is SQLite.

### 5. Version pinning policy

- **Root inheritance, no divergence.** The monorepo root pins `node >=22` (`engines`) and `pnpm@9.12.3`
  (`packageManager`). `apps/mobile` **inherits both** and must not declare a conflicting `engines` range or
  require a different pnpm — the single `pnpm install` at the root must keep resolving for `apps/web`,
  `apps/admin`, and every worker unchanged. MOB-006 verifies this at scaffold time.
- **Expo SDK is the version anchor.** `apps/mobile` pins an **exact** Expo SDK version (not a `^` range). The
  React Native version is **whatever that Expo SDK bundles** — never bumped independently. All Expo/RN-adjacent
  native modules are added with **`expo install`** (which consults Expo's bundled-native-modules manifest) rather
  than raw `pnpm add`, so every native dependency stays inside the SDK's tested matrix.
- **pnpm hoisting policy (red-team-resolved; validated at MOB-006).** React Native's Metro bundler and native
  autolinking historically assume a hoisted `node_modules`; pnpm's default isolated/symlinked layout can break
  them. **Resolved decision: do NOT flip the whole workspace to `node-linker=hoisted`** — that is the single most
  dangerous option because `node-linker` is a workspace-root setting and switching it changes the installed layout
  (and therefore the resolution/`peerDependencies` surface) for `apps/web`, `apps/admin`, `apps/api-*`, and every
  worker at once. Instead, scope hoisting to the RN/Expo/Metro toolchain via **targeted `public-hoist-pattern` /
  `hoist-pattern` entries** (hoisting only those packages into the virtual-store root) and, only if MOB-006 proves
  that insufficient, isolate `apps/mobile` with its own nested `.npmrc`/sub-lockfile rather than changing the root
  linker. MOB-006 is **blocking-gated** on a CI proof that, after `apps/mobile` is added, `pnpm install
  --frozen-lockfile` at the root still resolves and `apps/web` + `apps/admin` + `apps/api-*` + workers build
  byte-for-byte unchanged; a regression there fails the scaffold. This is the most likely place the mobile stack
  could break the web `pnpm install`, so it is gated, not merely noted.
- **Upgrade cadence.** Track Expo SDK on an **N-1 stability window**: do not adopt a new SDK the day it releases;
  wait for the early patch releases (`.1`/`.2`) and the ecosystem's key libraries (MapLibre RN, RN Firebase) to
  publish compatible versions. Upgrades happen on a branch via Expo's upgrade path, proven by a full EAS build +
  device test matrix (MOB-019) before merge. Security patches are the exception and may jump the cadence.

### 6. Native-directory policy — `ios/` and `android/` are gitignored (CNG)

`apps/mobile/ios/` and `apps/mobile/android/` are **not committed to git**. They are treated as build output,
generated by `expo prebuild` from the committed source of truth: `app.config.ts` (or `app.json`) plus config
plugins. EAS Build runs prebuild as part of its standard pipeline, so the committed configuration — not a
checked-in native tree — is authoritative.

Rationale: with CNG, committed native folders drift from the config the moment any config plugin or SDK upgrade
regenerates them, producing merge conflicts and a two-sources-of-truth hazard for exactly the native code a
one-maintainer operation is least equipped to hand-reconcile. Keeping native folders generated means an SDK
upgrade or plugin change is a config edit, not a native-tree merge. The escape hatch remains: a native change a
config plugin cannot express is first attempted **as** a config plugin; only as a genuine last resort would the
project commit the native folders (a near-one-way door — see "Reversal cost").

### 7. Supported OS floor — iOS 16+, Android 8 (API 26)+ (proposed; re-verify at MOB-006)

Adopt the MOB-001 proposal: **iOS 16+ and Android 8.0 (API level 26)+**.

> **Amended 2026-07-20 (see disposition block):** the pins below were re-verified at scaffold time to
> **Expo SDK 56 / RN 0.85** (platform minimums **iOS 16.4 / Android 7 / API 24**). `app.config.ts` sets
> `ios.deploymentTarget: '16.4'` (platform minimum now governs, exceeding the proposed 16.0) and holds
> Android at `minSdkVersion: 26`. The SDK-54 verification prose immediately below is retained only as the
> original drafting record.

Verification against the current Expo SDK as of this writing: the current stable line is **Expo SDK 54**
(released ~September 2025, bundling React Native 0.81). Its actual platform minimums are **lower** than this
proposal — approximately **iOS 15.1** and **Android API 24 (Android 7.0)**. The proposed iOS 16 / API 26 floor
therefore sits **above** the platform minimum, which is a deliberate, allowed choice: it (a) comfortably clears
App Attest (iOS 14+) and Play Integrity requirements from §3, (b) shrinks the OS test matrix and polyfill burden
for a one-maintainer operation, and (c) covers the overwhelming majority of the U.S. install base this
U.S.-only product targets. **Red-team-resolved: hold the floor at iOS 16 / Android API 26 — do not relax toward
the Expo platform minimum.** The only circumstance that would justify lowering it is MOB-006-time device-share
evidence showing a *material* population of otherwise-reachable U.S. users excluded at iOS 16 / API 26; absent
that measured evidence, the higher floor stands because its costs (a slightly smaller addressable base) are
outweighed by the shrunken test/polyfill matrix a solo maintainer must carry. Relaxation is thus evidence-gated,
not default.

**This must be re-verified at MOB-006 scaffold time.** Expo's floor moves up roughly every ~3 months with each
SDK; a later SDK could raise the platform minimum to meet or exceed iOS 16 / API 26, at which point "proposed
floor" and "platform floor" converge and the choice is made for us. Whichever SDK MOB-006 actually pins governs.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| **Bare React Native CLI** (no Expo) | Forfeits EAS Build/Update, managed credentials, config plugins, and `expo install` version resolution — all of which do heavy lifting for a one-maintainer operation — while gaining nothing Expo's CNG + config-plugin escape hatch does not already provide. Native extensibility is available inside Expo. |
| **Flutter** | Dart codebase cannot import the TypeScript `packages/public-contracts` types; every contract would need a hand-maintained parallel copy, directly inviting the drift program invariant 3 forbids. Also a second language/toolchain for a solo maintainer already fluent in the repo's TS. |
| **Native Swift + Kotlin (two codebases)** | Two separate native codebases, two contract re-implementations, and two skill sets — the highest possible maintenance load, the opposite of `operating-principle-runs-itself-within-reason`. Justified only for platform-specific performance the reader product does not need. |
| **Mapbox GL Native / Mapbox mobile SDK** | Non-OSS license and API-key/per-load billing since the MapLibre fork point — rejected for the same reasons ADR-013 rejected Mapbox GL JS on web. Breaks license and vendor-independence posture. |
| **Google Maps SDK (mobile)** | Proprietary, API-key-gated, per-load billing from day one; cannot render our self-hosted PMTiles in the dark-archive register; conflicts with ADR-011/ADR-013 cost and independence rationale. |
| **`@react-native-firebase/firestore` for direct reads** | Violates program invariant 2 and ADR-011 §7 (public clients read only `public/**`; canonical data stays behind `api-public`). Would also bypass the `api-public` guardrail/App Check middleware and couple the client to Firestore document shapes instead of versioned contracts. |
| **App Check via reCAPTCHA provider in a WebView** | Strictly weaker than native App Attest / Play Integrity, adds WebView surface, and regresses UX — no benefit on a platform where hardware-backed attestation exists. |
| **AsyncStorage / MMKV as the primary cache** | Key-value only; re-implementing indexed relational lookup over entities/evidence by hand. MMKV is retained as an optional complementary KV store, not the cache engine. |
| **WatermelonDB** | Heavier ORM abstraction over the same SQLite `expo-sqlite` exposes directly, with extra native/config setup, for query needs SQLite already meets. |
| **Realm / Atlas Device SDK** | Vendor-deprecated (MongoDB announced sunset of Atlas Device Sync/Realm in 2024). Adopting a deprecated engine is an avoidable future migration. |
| **Committing `ios/`/`android/` to git** | Two sources of truth against CNG; native-tree merge conflicts on every plugin/SDK change — the worst failure mode for a solo maintainer. EAS Build regenerates them anyway. |
| **Lowering the OS floor to Expo's minimum (iOS 15.1 / API 24)** | Enlarges the test/polyfill matrix for negligible additional U.S. install-base coverage; not justified absent device-share evidence at MOB-006. |

## Consequences

- `apps/mobile` becomes the repo's first non-Next.js application and its first native build target; MOB-006 must
  prove it does not break the root `pnpm install` (see §5 hoisting caveat).
- The mobile client gains its first WebGL-equivalent surface (MapLibre Native), isolated to the map screen, with
  no SSR concern — simpler than the web's SSR-safety dance around `maplibre-gl`.
- A new external operational dependency appears: **EAS** (billing, credentials, MFA custody) — already flagged as
  MOB-001 human gates #3 and #7. This is the first paid third-party in the mobile build path; it is a build-time
  dependency, not a runtime one in the render path (unlike a managed map vendor would be).
- Contract discipline tightens: because the client shares `packages/public-contracts` types, MOB-003 must keep
  those contracts strictly environment-neutral (no Node/DOM/server-only transitive deps) or it breaks the mobile
  build — enforcing invariant 3 by construction.
- The offline cache (SQLite) becomes a **second copy** of released public data on-device; MOB-009 must treat it as
  cache (invalidated by release version per ADR-004), never a source of truth, and MOB-010/018 must ensure no
  protected data (precise location, sensitive classifications) is cached or logged (program invariant 7).

## Reversal cost

Required by MOB-002 acceptance — one paragraph per decision on what changing it later costs.

- **Framework (Expo → bare RN or off-RN).** Expo → **bare RN** is a *moderate, mostly one-way* door: `expo prebuild`
  then maintaining the native folders by hand keeps the JS/TS app but permanently loses EAS/CNG ergonomics and is
  painful to undo. Expo/RN → **Flutter or native** is a *full rewrite* — a new language and UI layer, re-doing the
  map, App Check, cache, and navigation from scratch. The framework choice is the least reversible decision here,
  which is why single-codebase-with-shared-contracts is weighted so heavily.
- **Map (MapLibre Native → another engine).** *Moderate.* Because the map is isolated to the Explore/detail screens
  and the tile source is our own PMTiles, swapping the rendering binding is a contained component rewrite, not an
  app-wide change — the same isolation ADR-013 relied on for web. Switching to a proprietary vendor (Mapbox/Google)
  would additionally re-introduce API keys and per-load billing this ADR deliberately avoids, so the cost is as much
  posture as code.
- **Firebase access (App Check provider or adding data modules).** *Low for the provider, high to breach the boundary.*
  Changing attestation providers is a config/module swap. But adding a client data module (Firestore/Auth) is not a
  reversal, it is a **boundary violation** (invariant 2) — the cost is re-architecting away from the `api-public`
  contract, and it should never be done casually; it would require a new ADR superseding this one and ADR-011 §7.
- **Local storage (SQLite → another DB).** *Moderate, bounded.* The cache holds derived, release-versioned data, so
  the fallback is always "clear cache and re-fetch from `api-public`" — no user data is stranded. Migration cost is a
  new schema + one-time re-hydrate on upgrade (MOB-009 owns migrations), not data loss. This bounded reversal is a
  reason to prefer plain SQLite over a heavier ORM whose abstractions would have to be unwound too.
- **Version pinning policy.** *Low.* Cadence and pinning are process, changeable per upgrade cycle. The one sharp edge
  is the pnpm hoisting configuration: once web + mobile both depend on a particular `node-linker`/hoist setup, changing
  it re-tests both surfaces' installs — cheap if caught at MOB-006, expensive if discovered post-launch.
- **Native-directory policy (gitignored → committed).** *Near one-way.* Committing native folders after living on CNG
  means every future SDK upgrade becomes a manual native-tree reconciliation; going back to gitignored/CNG afterward
  requires re-deriving all hand-edits as config plugins. Prefer the config-plugin escape hatch; treat committing native
  as a last resort with a written justification.
- **OS floor (raising or lowering).** *Asymmetric.* **Raising** the floor later (dropping old-OS users) is trivial
  config but a user-facing regression that may need release notes. **Lowering** it later (supporting older OSes) can
  reintroduce polyfills, widen the test matrix, and surface App Attest/Play Integrity edge cases — more expensive than
  it looks. Setting the floor slightly high now (§7) makes the cheap direction the likely one.

## Migration triggers

- Reconsider the map engine only if MapLibre Native fails a measured performance/quality bar on the §7 device floor
  that the isolated component cannot fix — mirroring ADR-013's "measured threshold, not a guess" pattern.
- Add an offline **basemap pack** (beyond a bounded ambient cache) only through MOB-022 on measured evidence, since a
  full offline basemap is an explicit launch non-goal.
- Revisit `expo-sqlite` only if the cache's measured query needs outgrow SQLite (unlikely for a read cache), never on
  preference.
- Re-verify the OS floor and the Expo SDK/RN pin at every SDK upgrade (MOB-006 sets the first values).

## Rollback considerations

- **Releases roll back via EAS**, mirroring ADR-004's active-pointer discipline: EAS Update rolls back JS/asset changes
  with staged rollout, and prior immutable native build artifacts remain submittable — no bespoke rollback code
  (program invariant 4; proven under MOB-021).
- **The offline cache is disposable.** Any bad cache state recovers by clearing it and re-fetching from `api-public`
  against the active release; the cache is never authoritative (ADR-004).
- **App Check is fail-safe toward reads.** Per ADR-010, an App Check misconfiguration must degrade toward
  release-snapshot reads, not a hard lockout; the mobile client inherits that posture through the shared `api-public`
  middleware and must not invent a stricter client-side gate that strands users.

## Red-team review resolutions

Dispositions of the two questions flagged in this ADR for the independent second-model red-team (MOB-002 requires
recorded reviewer findings and dispositions):

- **pnpm `node-linker=hoisted` risk to the root `pnpm install`.** *Resolved (§5):* do not change the workspace
  root linker; scope hoisting to the RN toolchain via `public-hoist-pattern`, and block MOB-006 on CI proof that
  the root install and all existing app/worker builds are unchanged after `apps/mobile` is added. The dangerous
  option (root `node-linker=hoisted`) is rejected.
- **Whether to relax the iOS 16 / Android API 26 floor toward the Expo minimum.** *Resolved (§7):* hold at iOS 16 /
  API 26. Relaxation is evidence-gated on MOB-006 device-share data showing materially excluded U.S. users, not a
  default.

## References

- `docs/mobile/mobile-app-epic.md` — program invariants, non-goals, bead index (MOB-002 → MOB-003/006/010/011).
- `docs/mobile/decisions/mobile-identity.md` (MOB-001) — product identity, bundle ids, OS floor proposal, human gates.
- ADR-013 — MapLibre GL JS, PMTiles tile strategy, dark-archive basemap register (the web parallel this ADR mirrors).
- ADR-011 — Firestore system of record; public clients read only `public/**` (§3 boundary).
- ADR-010 — security and abuse assumptions; App Check is attestation not authorization; token-logging prohibition.
- ADR-008 — bounded, static-first public queries; U.S.-only scope; guardrail middleware the mobile client reuses.
- ADR-005 — service separation; "mobile later consumes the same contracts; do not invent mobile-only services."
- ADR-004 — immutable release snapshots and atomic activation/rollback the offline cache and EAS releases mirror.
