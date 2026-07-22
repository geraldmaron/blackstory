# ADR-024: Mobile build, distribution, OTA update, and release-rollback model

- **Status:** Accepted (amended 2026-07-20)
- **Date:** 2026-07-19
- **Depends on:** ADR-004, ADR-006, ADR-022

## Adversarial review disposition (2026-07-20)

Verdict: **Accepted with amendments.** The pipeline shape (EAS Build/Submit/Update, three profiles bound to
three bundle IDs and three channels, tag-gated production, forced-update driven only by a server signal,
fail-open on a missing/malformed min-version signal, drilled rollback as a launch gate) is sound and matches
2026 EAS guidance. `eas.json` and `app.config.ts` implement the three profiles and channels. Two material
amendments from research + repo state:

1. **EAS Update end-to-end code signing is a PAID-PLAN feature, not just an SDK-support question (§2/§6/§7;
   threat-model T6).** Per Expo's docs, "EAS Update Code Signing is only available to accounts subscribed to
   the EAS Production or Enterprise plans" (docs.expo.dev/eas-update/code-signing). T6 and this ADR framed
   enabling code signing as contingent on *SDK support*; it is supported on SDK 56, but adopting it **breaks
   the free-tier-first posture** (§7). Decision: on the free tier, OTA ships **without** end-to-end code
   signing, and the T6 blast-radius controls reduce to **phishing-resistant MFA custody + a scoped, revocable
   CI-only EAS token + channel/staged-rollout discipline + immutable-update rollback**. Enabling code signing
   is a **cost-gated upgrade trigger**, folded into §7's recorded triggers (adopt when moving to a paid EAS
   plan for other reasons, or when a threat assessment makes the un-signed-OTA residual unacceptable). This is
   a **remaining risk accepted by design** until the paid plan is adopted.
2. **`expo-updates` is not yet wired.** `apps/mobile/package.json` does **not** include `expo-updates`, and
   `app.config.ts` sets no `runtimeVersion` policy or `updates.url`. The entire OTA mechanism §2 relies on is
   therefore **not yet installed** — a legitimate MOB-019 deferral, but the ADR implied it as present.
   Amended to: OTA/EAS Update is the decided mechanism; wiring (`expo install expo-updates`,
   `eas update:configure`, `runtimeVersion: { policy: "appVersion" }`) is a MOB-019 task and a prerequisite
   for the §6 OTA rollback drill. Until then there is no OTA path and JS fixes ride full store releases.
3. **Minor:** `eas.json` uses `appVersionSource: "remote"` (EAS-managed version), whereas §3 describes a
   manual bump in `app.config`. Both are valid; the remote source is EAS's current recommendation. §3's
   "manually bumped" is reconciled to "the semantic app version is a deliberate human act per release, whether
   set in `app.config` or via EAS remote version management."

No decision reversed.

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| Expo/EAS project | Does not exist — no `apps/mobile`, no `eas.json`, no Expo account reference anywhere in the repo (see `docs/mobile/decisions/mobile-identity.md` audit) | EAS project linked to the Expo/EAS org gated in MOB-001; `eas.json` with three build profiles |
| Binary build pipeline | Absent | EAS Build produces iOS/Android binaries; EAS Submit uploads to stores; EAS Update ships JS-only OTA patches |
| CI wiring | Web CI/CD via GitHub Actions + OIDC/WIF (ADR-006), mobile untouched | GitHub Actions invokes EAS via a scoped EAS token; store credentials in EAS managed credentials + GitHub Actions secrets |
| Version scheme | Web deploys the tested commit SHA (ADR-006) | Semantic app version (manual) + monotonic build number (CI-derived); recorded in release provenance |
| Rollback | Web: activate prior release pointer (ADR-004) | OTA: republish/roll back an EAS Update channel; binary: prior store build + staged-rollout halt; drilled in MOB-021 |

## Context

The mobile program's invariant 4 is "immutable release artifacts with atomic activation and proven rollback." The web platform already satisfies that shape: ADR-004 versions every publication as an immutable release with a signed manifest and instant rollback via an active-release pointer, and ADR-006 makes GitHub Actions the sole CI/CD authority that deploys only the tested commit SHA, with automatic rollouts disabled, environment-gated approvals, and OIDC/WIF short-lived credentials instead of standing keys. A native mobile app cannot literally reuse either mechanism — a compiled binary sitting in App Store Connect / Play Console is not a Firebase Hosting release pointer, and store review latency means "atomic activation" and "instant rollback" mean something different once a build is in users' hands. This ADR ports the *spirit* of ADR-004/ADR-006 (immutable artifacts, one audited commit, no standing keys, proven not asserted rollback) onto the native distribution reality that EAS, Apple, and Google impose.

The identity record (`docs/mobile/decisions/mobile-identity.md`) already fixes the three environment tiers (dev / preview / production), the bundle/application IDs per tier, U.S.-only launch territories, and the account-custody human gates. It also records the binding budget constraint: EAS Build/Submit is usage-based and the owner must set a spend ceiling consistent with the project's `operating-principle-runs-itself-within-reason` posture (free-tier-first, budget-capped, kill-switch, with a recorded upgrade trigger). This ADR decides the pipeline, the OTA policy, the versioning scheme, the minimum-supported-app enforcement, the CI secrets handling, the rollback-drill requirement, and the cost of reversing off EAS.

Two adjacent mobile ADRs bound this one:

- **ADR-004** (immutable public releases): mobile *content and map artifacts* still ride the server-side release pointer; a mobile build never bakes in a canonical snapshot, so a content rollback is a server release rollback, not an app resubmission. This ADR governs only the *client binary and its JS bundle*, not the data it reads.
- **ADR-022** (mobile data boundary, drafted in parallel): sets the public API's N / N-1 version compatibility window and the minimum-supported-app signal. This ADR decides what the *client* does when the server says the app is below minimum (see Decision §4); ADR-022 owns the server contract that emits that signal.

## Decision

### 1. Build and distribution pipeline: EAS Build + EAS Submit + EAS Update, three profiles

**EAS Build** produces the iOS and Android binaries; **EAS Submit** uploads them to App Store Connect / Play Console; **EAS Update** ships JS-only over-the-air patches to already-installed binaries. All three are configured through a single committed `eas.json` with exactly three build profiles, one per identity-doc environment tier:

| Profile | Distribution | Bundle/app ID (from identity doc) | Firebase target | Trigger |
|---|---|---|---|---|
| `development` | Dev client, internal only (simulator / registered devices) | `app.blackbook.mobile.dev` | Firebase **emulator suite** — never production | On demand, from a developer machine or a manually dispatched CI job. Never store-bound. |
| `preview` | Internal testing — TestFlight internal group / Play **internal** track / EAS internal-distribution URL | `app.blackbook.mobile.preview` | Distinct App Check attestation (preview) | **Every merge to `main`** via GitHub Actions, once MOB-006 lands. Fast feedback lane; never a public store listing. |
| `production` | Store-bound (App Store / Play production track) | `app.blackbook.mobile` | Production `black-book-efaaf` via `apps/api-public` boundary only | **Only** on an explicit annotated release tag pushed to an audited commit — never on a bare `main` merge. |

The production trigger deliberately mirrors ADR-006's "deploy only the tested commit (immutable SHA)" and the epic's "one audited commit" launch-gate discipline: a public binary is minted from a tagged commit that a human gated, not from whatever last landed on `main`. `preview` is the mobile analogue of ADR-006's optional staging/preview lane — high-frequency, internal, never a security boundary and never public. `development` creates no permanent or public store resource, consistent with program invariant 5.

The EAS **update channel** is bound to the build profile (`preview` binaries subscribe to the `preview` channel, `production` binaries to the `production` channel), so an OTA push can never cross an environment boundary — a preview-channel update can never reach a store build, exactly as the emulator-vs-production Firebase split prevents a dev build from touching production data.

### 2. OTA update policy (EAS Update) and OTA rollback

EAS Update replaces only the **JavaScript bundle and bundled JS-readable assets** of an already-installed binary. It therefore *may* ship, without any store review:

- Bug fixes in JS/TS application logic.
- Content, copy, and layout changes that are pure JS (strings, styles, component trees).
- Configuration changes that live in the JS bundle (feature flags, endpoint routing within the already-permitted host set).

It **must not**, and technically cannot correctly, ship anything that changes the native binary. The following **require a full binary rebuild + EAS Submit + store review**:

- Any native module added or removed (any change to the set of linked native dependencies).
- Any `Info.plist` / `AndroidManifest.xml` change, **especially any permission or capability change** (a new permission shipped via OTA would be a privacy and review-integrity violation, not merely a technical mismatch — see program invariant 7).
- Any **Expo SDK upgrade** (the SDK's native runtime must match the bundle's expected runtime; a mismatched OTA bundle can hard-crash on launch).
- Any change to the app version, entitlements, associated-domain configuration, or signing.

This boundary is enforced structurally by EAS's **runtime version** field: a JS bundle only ever installs onto a binary whose runtime version matches, so an incompatible OTA is *rejected by the client*, not shipped and crashed. The runtime version is bumped exactly when the native layer changes — which is precisely the set of changes that require a resubmission — so the "OTA vs rebuild" decision is encoded in the artifact, not left to a reviewer's judgment.

**OTA rollback (concrete mechanism, satisfying invariant 4's "proven rollback" for the OTA case):** every published update on a channel is immutable and addressable by update ID (same immutable-artifact discipline as ADR-004 release manifests). A bad `production`-channel update is rolled back by **republishing the previous known-good update to the same channel** (`eas update --channel production` pointing at the prior update, i.e. an EAS Update "rollback"/republish). Clients on their next update check pull the restored bundle; the bad update is never deleted (immutable audit trail) but is no longer the channel head. Because the JS bundle and the binary are decoupled, this rollback needs **no store review and no resubmission** — it is the mobile equivalent of ADR-004's active-release-pointer flip, and it is the fast path for any regression that shipped via OTA. Rollback latency is bounded by the client's update-check interval, not by store review.

**OTA cannot rescue a bad *binary*.** If a regression is in native code (already shipped to the store), OTA is powerless; that case falls to §6's binary contingency (halt staged rollout, promote prior build, expedited review).

### 3. App version and build number scheme

Two independent numbers, matching store requirements:

- **App version** (user-visible semantic version, e.g. `1.2.0` → iOS `CFBundleShortVersionString`, Android `versionName`): **manually bumped** in `app.config`/`eas.json` on a meaningful release, following semver intent (patch = fixes, minor = features, major = breaking UX/compat). It is a deliberate human act tied to the tagged production commit, not a CI side effect.
- **Build number** (monotonic, store-required uniqueness, iOS `CFBundleVersion` / Android `versionCode`): **derived by CI** and strictly increasing. Preferred source: EAS's own auto-increment (`autoIncrement` per profile) so the platform guarantees monotonicity across builds of the same app version; the fallback derivation if EAS auto-increment is not used is the **git commit count** (`git rev-list --count`), which is monotonic and reproducible from the repo. A CI run number is acceptable only if it is guaranteed never to reset; commit count is preferred because it survives CI-provider changes. The build number is recorded in release provenance alongside the commit SHA, the app version, the EAS build ID, and the runtime version — the mobile analogue of ADR-006's release-metadata provenance record.

The pair `(appVersion, buildNumber)` uniquely identifies an immutable binary; `(channel, updateId)` uniquely identifies an immutable OTA bundle. Together they are the mobile "immutable release artifact" set invariant 4 demands.

### 4. Minimum-supported-app enforcement (tie-in to ADR-022)

ADR-022 fixes the public API's N / N-1 compatibility window and defines a **minimum-supported-app** signal the server returns (e.g. a minimum acceptable `(appVersion, buildNumber)` and/or minimum contract version in a response header or bootstrap payload). This ADR decides the **client behavior** when the server reports that the running app is below that minimum:

- The app presents a **blocking forced-update screen** that prevents all further use of the product (no bypass, no "later"), because a below-minimum client is, by ADR-022's definition, outside the supported contract window and may misrender or mishandle server responses.
- The screen carries a **store deep link** (App Store / Play Store product page for `app.blackbook.mobile`) so the user can update in one tap.
- The check runs at launch and on the first successful (bootstrap) response, so a client that goes stale mid-session is caught on its next server round-trip. (There are no user accounts at launch — MOB-001 non-goal — so "bootstrap response" here means the first successful unauthenticated read, not an authenticated session.)
- The forced-update state is driven **only** by the server signal, never by a client-baked constant, so raising the floor is a server-side act (ADR-022's surface) that needs no app resubmission — consistent with keeping the server authoritative (program invariant 6).

**Fail-open when the min-version signal itself is unavailable or malformed (red-team-resolved).** The blocking
forced-update screen fires **only** on an *affirmative, well-formed* below-minimum signal — never on the *absence*
or corruption of one. Concretely:

- If the bootstrap payload / header that advertises the minimum-supported version is **missing, empty, unparseable,
  or malformed**, the client treats it as *"no floor asserted"* and proceeds normally. It must **not** self-brick
  on a signal it cannot read.
- This is the same fail-open-toward-reads posture the rest of the stack takes (threat model T2; ADR-010 "fail to
  degraded snapshot reads"; ADR-020 "App Check is fail-safe toward reads"). Fail-*closed* here would convert any
  transient server hiccup, CDN blip, or a single malformed deploy into an instant, total outage across every
  installed device — the worst possible failure for a one-maintainer operation, and a self-inflicted denial of
  service an attacker could aim for. The bounded downside of fail-open — a genuinely-too-old client keeps talking
  for a little longer — is already contained: below-minimum clients gain no capability (invariant 6, server
  re-validates every parameter), and the server retains a **hard backstop** independent of this soft signal.
- **Backstop / reconciliation with ADR-022.** ADR-022's `CLIENT_VERSION_UNSUPPORTED` / `426 Upgrade Required` is
  that hard backstop: it is the server *affirmatively rejecting* a request from a known-too-old client, and the
  client **does** honor it (it is a well-formed below-minimum signal, delivered per-request). The bootstrap
  min-version field decided here is the *proactive* self-fence that lets a client warn/block itself before it hits
  a 426; its *absence* fails open to that 426 backstop. So the two mechanisms are complementary, not redundant:
  affirmative rejection (426) and affirmative bootstrap floor both block; only a missing/garbled bootstrap floor
  fails open. A malformed floor value is logged as a privacy-safe anomaly (MOB-018) so a broken deploy is noticed,
  but it never blocks a user.

This makes OTA and forced-update complementary: a recoverable regression is fixed via §2 OTA rollback in minutes; an unrecoverable-old client is fenced off by the server raising the minimum and the client blocking itself until updated.

### 5. Secrets in CI

The pipeline needs three credential families, and **none of them may ever live in the repository**, consistent with ADR-006's OIDC/WIF doctrine and the repo-wide "secrets in Secret Manager / GitHub Actions secrets, never in the repo" posture (see `infra/gcp/wif/`):

| Credential | Purpose | Storage (decided) |
|---|---|---|
| **Apple App Store Connect API key** (`.p8` + key ID + issuer ID) | EAS Submit → App Store Connect; TestFlight | **EAS managed credentials service** (preferred — EAS holds signing + submission secrets), with the key never checked out to the CI runner. |
| **Google Play service-account JSON** | EAS Submit → Play Console (internal/production tracks) | **EAS managed credentials** preferred; if a raw JSON must reach CI, it lives only as a **GitHub Actions secret**, injected at job time, never written to the repo or logged. |
| **iOS/Android signing material** (distribution cert, provisioning profile, Android keystore) | EAS Build code-signing | **EAS managed credentials** (EAS generates and custodies signing keys) — the recommended path; the Android keystore custody is recorded per the identity doc's root-account-custody + phishing-resistant-MFA requirement. |
| **EAS access token** | GitHub Actions authenticating to EAS (build/submit/update) | **GitHub Actions secret**, a **scoped, revocable EAS token** (not a personal login), rotated on the same cadence as other CI secrets. |

Preference order matches ADR-006's "no standing long-lived keys in GitHub secrets where a managed short-lived path exists": push signing/submission secrets into **EAS's managed credentials** (analogous to WIF holding the trust relationship) and keep only the *scoped EAS token* in GitHub Actions secrets as the one bootstrap credential — the minimal surface, revocable, never in the repo. No Apple/Google secret value is invented or stored by this ADR; MOB-019 provisions them into the stores above once the MOB-001 account-custody human gates clear.

### 6. Rollback drill is a launch-gate requirement (MOB-021 evidence)

Invariant 4 says "proven rollback," and the epic's closure discipline says every child closes on runtime evidence, not documentation. Therefore **MOB-021 (the adversarial launch gate) must execute and record an actual rollback drill as runtime evidence — it may not merely assert that rollback works.** The drill must demonstrate, at minimum:

1. **OTA rollback (mandatory):** publish a deliberately-bad `production`-channel OTA update to a controlled build, observe the regression on a real device, execute the §2 republish-previous-update rollback, and record that the device recovered on its next update check — with the update IDs, timestamps, and recovery latency captured in the launch evidence index.
2. **Store-side binary contingency (mandatory if feasible at drill time):** rehearse the halt of a Play/App Store **staged rollout**, promotion of the prior known-good store build, and the **Apple/Google "expedited review" request** path for a critical fix — or, if a live store rehearsal is not feasible before launch, record the exact runbook and the reason the live rehearsal could not run, flagged as a residual launch risk rather than silently skipped.

This mirrors the web platform's expectation that rollback is rehearsed, not theoretical (ADR-006 "avoid destructive down-migrations in prod without rehearsal"; `infra/gcp/recovery-rehearsal/`). No production go/no-go is granted until the OTA drill evidence exists.

### 7. Reversal cost: moving off EAS

EAS is a **narrow, reversible vendor boundary**, chosen the same way ADR-013 chose a self-host-friendly map stack: it earns adoption on free-tier-first economics with a recorded upgrade trigger, and the exit is a pipeline swap, not an app rewrite.

- **What is portable:** the app is standard Expo/React Native. The binaries can be built by **`expo prebuild` → Fastlane → self-hosted CI runners** (or GitHub-hosted macOS runners for iOS), and OTA can move to a self-hosted `expo-updates` server or be dropped in favor of store-only releases. None of this touches product code, the identity/bundle IDs, or the store records — it swaps *how* the binary and bundle are produced and shipped.
- **What the migration costs:** standing up and maintaining macOS build infrastructure (or paid macOS CI minutes), re-implementing signing/submission in Fastlane, custodying the signing keys that EAS otherwise manages, and running a self-hosted updates server if OTA is retained. This is real, recurring ops work — precisely the toil EAS's managed path buys out — which is why EAS is chosen first.
- **EAS free-tier limits (as understood at 2026-07; reverify at MOB-019 because vendor pricing moves independently of this ADR):** the free plan grants a small monthly quota of cloud builds with limited concurrency and slower queue priority, and EAS Update is metered by monthly active users / bandwidth on the free tier. Exact current numbers must be confirmed at implementation time, not trusted from this ADR.
- **Recorded upgrade/exit trigger** (per `operating-principle-runs-itself-within-reason`): move off the EAS free tier — first to a paid EAS tier, then, only if paid EAS cost or limits still bind, to the self-hosted Fastlane path — **when** sustained monthly build volume exceeds the free build quota during normal release cadence, **or** EAS Update MAU/bandwidth exceeds the free metering at launch scale, **or** the owner-set monthly spend ceiling (MOB-001 human gate #7) would be breached by EAS charges. Whichever trips first is the trigger; the owner records the decision the same way ADR-011/ADR-013 record measured migration thresholds rather than guessing.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| **Fastlane + self-hosted CI runners from day one** | Front-loads macOS build-infra and signing-custody toil that EAS buys out, before any measured need to leave the free/paid tier — violates the free-tier-first, recorded-upgrade-trigger posture. It is the *exit* path (§7), not the entry path. |
| **OTA-ship anything, including native/permission changes** | Technically impossible for native code and a privacy/review-integrity violation for permission changes (invariant 7). The runtime-version guard exists precisely to prevent it. |
| **One build profile with runtime environment switches** | Would let a dev/preview build point at production Firebase and let an OTA cross environment boundaries — exactly the "accidental production use from dev builds" risk the identity doc mitigates structurally. Three profiles bound to three bundle IDs and three channels keep the boundary physical. |
| **Auto-submit to the production store track on every `main` merge** | The direct analogue of ADR-006's rejected "automatic App Hosting rollout on every push": untested/unaudited commits reach public users. Production requires a tagged, audited commit. |
| **Soft "please update" banner instead of a blocking forced-update screen** | A below-minimum client is outside ADR-022's supported contract window and may mishandle responses; a dismissible banner lets a broken client keep talking to the server. Blocking is the safe default; the server controls when the floor rises. |
| **Long-lived personal EAS/Apple/Google credentials in GitHub secrets** | Same objection ADR-006 raises to standing GCP keys: leak blast-radius and no revocation story. Use EAS managed credentials plus a single scoped, revocable EAS token. |
| **Assert rollback works in this doc and move on** | Violates the epic's runtime-evidence closure discipline and invariant 4's "proven." MOB-021 must drill it (§6). |
| **Store-only releases, no OTA at all** | Loses the minutes-fast rollback path for JS regressions and forces every copy/bug fix through multi-day store review — a worse rollback posture than invariant 4 wants, for no security gain (OTA is environment- and runtime-version-fenced). |

## Consequences

- `apps/mobile` gains an `eas.json` with three profiles and a channel-per-profile binding; MOB-006 scaffolds it, MOB-019 wires the GitHub Actions jobs (`preview` on merge, `production` on tag).
- Release provenance grows a mobile record: `(appVersion, buildNumber, commitSHA, easBuildId, runtimeVersion)` per binary and `(channel, updateId)` per OTA — the mobile parallel to `infra/github/release-metadata/`.
- The client must implement a launch/bootstrap minimum-version check and a blocking forced-update screen (MOB-008/MOB-009 surface, driven by ADR-022's server signal).
- MOB-021's launch evidence index must include the OTA rollback drill artifacts before production go/no-go.
- A hard dependency on the MOB-001 human gates (Apple/Google/EAS accounts, MFA custody, spend ceiling) — no production build is signed until those clear; nothing here unblocks earlier engineering (MOB-003/006/007 proceed on dev/preview identifiers).

## Migration triggers

- Move off the EAS free tier (then off EAS entirely to Fastlane/self-hosted) per §7's recorded trigger — measured build volume / OTA metering / spend-ceiling breach, not a guess.
- Revisit the OTA-vs-rebuild boundary only if Expo changes what `expo-updates` can safely deliver; the permission/native/SDK exclusions are non-negotiable regardless.
- Reconsider the forced-update blocking behavior only if ADR-022 changes the N / N-1 window such that below-minimum clients become provably safe to keep serving (they are not today).
- Change the build-number source only with a scheme that preserves strict monotonicity across the change (dual-track until the new source is proven ≥ the old high-water mark).

## Rollback considerations

- **JS/OTA regression:** republish the previous immutable update to the affected channel (§2); recovery bounded by client update-check interval, no store review. This is the fast path and the drilled path (§6).
- **Native/binary regression:** halt the store staged rollout, promote the prior known-good store build, and request expedited review for a fix build (§6 contingency); OTA cannot help here.
- **Below-minimum clients:** the server raises the minimum-supported version (ADR-022); affected clients self-fence via the forced-update screen (§4) until they update — a coarse but reliable last-resort "rollback" of a whole compatibility generation.
- **Content/data regression:** not a mobile-build concern — the app reads server-side immutable releases, so content rollback is an ADR-004 active-release-pointer flip, requiring no app action at all.
- Never "hotfix" a shipped binary in place; publish a new build or roll back an OTA channel, mirroring ADR-004's "do not fix an active release in place."

## Red-team resolution

Disposition of the question flagged for the independent second-model red-team (MOB-002 requires recorded reviewer
findings and dispositions):

- **Fail-open vs. fail-closed when the minimum-supported-app signal itself is unavailable or malformed —
  *resolved: fail open* (§4).** The blocking forced-update screen fires only on an affirmative, well-formed
  below-minimum signal (bootstrap floor) or an affirmative server rejection (ADR-022 `426` /
  `CLIENT_VERSION_UNSUPPORTED`). A missing, empty, or malformed floor signal is treated as "no floor asserted," the
  client proceeds, and the malformed value is logged as a privacy-safe anomaly for MOB-018 rather than blocking any
  user. Fail-closed was rejected because it turns a transient signal outage or one bad deploy into a total,
  self-inflicted outage across every install — the opposite of the fail-open-toward-reads posture the whole stack
  holds (ADR-010, ADR-020, threat model T2) — while the fail-open downside is fully contained by server-side
  re-validation and the `426` backstop.
