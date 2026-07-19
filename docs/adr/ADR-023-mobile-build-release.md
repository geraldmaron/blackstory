# ADR-023: Mobile build, release, and OTA update policy — EAS Build/Submit/Update, runtime versions, and forced-update enforcement

- **Status:** Proposed
- **Date:** 2026-07-19
- **Bead:** MOB-002 (architecture, threat model, contract boundary ADRs)
- **Depends on:** ADR-004, ADR-006, ADR-021
- **Blocks:** MOB-005, MOB-019, MOB-020, MOB-021

> ADR-021 (mobile data boundary) is being drafted in parallel and may not yet exist in this worktree. It defines the public API's N/N-1 compatibility window and the min-supported-app-version signal this ADR ties into. Where this ADR says "the min-version signal," it means that ADR-021 mechanism; if ADR-021's final number differs, only the cross-reference changes, not the decisions here.

## Scaffold vs target

| Aspect | Today (verified) | Target (MOB-005/019/020/021) |
|--------|------------------|------------------------------|
| Expo/EAS project | **Does not exist** — no `apps/mobile`, no `eas.json`, no Expo account (MOB-001 audit) | EAS project linked, three build profiles, three update channels |
| Build pipeline | **Absent** | EAS Build → EAS Submit, triggered from GitHub Actions (MOB-019) |
| OTA channel | **Absent** | EAS Update channels bound 1:1 to build profiles, gated by runtime version |
| Store records | **Absent** — Apple/Play accounts are open human gates (MOB-001) | TestFlight/Play internal + production listings (MOB-020) |
| Rollback evidence | **None** | Executed OTA rollback drill + expedited-review contingency recorded (MOB-021) |

## Context

Program invariant 4 requires "immutable release artifacts with atomic activation and proven rollback." The web surface already realizes this discipline: ADR-004 versions every public projection into an immutable release with a signed manifest and flips a single active-release pointer to activate or roll back atomically; ADR-006 orchestrates deployment through GitHub Actions with short-lived OIDC credentials and no long-lived keys in the repo; ADR-013 couples map artifacts to that same release-activation pipeline so they roll back for free with the pointer. The mobile app must inherit the *spirit* of these — immutable artifacts, atomic activation, a demonstrated pointer-flip rollback, secrets out of the repo — without pretending a store binary behaves like a CDN object.

The mobile constraint that has no web analogue: two release channels with fundamentally different latencies. A native binary is gated by App Store / Play review (hours to days, not always in our control), while JavaScript and asset changes can ship over-the-air in minutes. This ADR decides which changes are allowed to use which channel, how versions are numbered so the two channels stay coherent, and what the app does when the server tells it it is too old to talk to the API safely.

MOB-001 already fixed the three environment tiers (dev / preview / production) and their bundle identifiers; this ADR maps a build profile and an update channel onto each. Per program invariant 2 the app never touches canonical Firestore — it reads only `apps/api-public` — so "release" here means the *client artifact* lifecycle, distinct from and downstream of ADR-004's data-release lifecycle.

## Decision

### 1. Build and distribution pipeline: EAS Build + EAS Submit + EAS Update

Expo Application Services is the mobile build/distribution/OTA plane, orchestrated from GitHub Actions (MOB-019) so it sits inside the same CI authority ADR-006 already mandates for the web surface. Three build profiles in `eas.json`, one per MOB-001 environment tier, each bound 1:1 to an EAS Update channel of the same name:

| Profile | Distribution | Trigger | Channel | Bundle ID (MOB-001) |
|---------|-------------|---------|---------|---------------------|
| `development` | Dev client, internal devices/simulators only | Manual / on demand | `development` | `app.blackbook.mobile.dev` |
| `preview` | Internal testing — TestFlight internal group + Play internal track | **Every merge to `main`** | `preview` | `app.blackbook.mobile.preview` |
| `production` | Store-bound (App Store + Play production) | **Only an explicit tagged, audited release commit** — never an untagged main push | `production` | `app.blackbook.mobile` |

The `production` trigger mirrors this repo's launch-gate discipline: ADR-006 deploys "only the tested commit (immutable SHA)" behind a protected-environment approval, and the epic's closure discipline requires the epic to close on "a signed-off launch evidence index linking … production commit, store build … release ID." A production build/submit therefore runs only from a signed release tag on an audited commit that passed the MOB-021 launch gate — the mobile analogue of ADR-006's "one audited commit" protected-production rule. `production` profile builds and `production` channel promotions require the same GitHub protected-environment approval ADR-006 uses for web production.

EAS Submit (not manual Xcode/Transporter or Play Console uploads) performs store upload, so submission is auditable CI, consistent with ADR-006 rejecting "Firebase Console / gcloud manual prod deploys" as unauditable.

### 2. OTA update policy (EAS Update) and the runtime-version boundary

Every native binary embeds a **runtime version**. EAS Update only ever delivers an update to a binary whose runtime version matches the update's — this is the enforced, mechanical boundary between "can ship OTA" and "requires a new binary." We set `runtimeVersion` policy so it changes exactly when the native layer changes (Expo's `appVersion`-linked or fingerprint policy; MOB-006 pins the concrete policy at scaffold and records it here as an amendment).

**MAY ship over-the-air** (same runtime version, published to the tier's channel):

- Bug fixes in JavaScript/TypeScript logic that touch no native module.
- Content and copy changes, styling, layout, non-native feature flags.
- Any pure-JS behavior change that does not alter the native binary's capabilities.

**REQUIRES a full binary resubmission** (runtime-version bump → new EAS Build → EAS Submit → store review):

- Adding or removing any native module / config plugin.
- Any `Info.plist` / `AndroidManifest.xml` change, especially a permission or entitlement change.
- Expo SDK upgrade, React Native upgrade, or any change to native build config.

An OTA update whose JS assumes native capabilities absent from the installed binary is a crash-on-launch class bug; the runtime-version match is what structurally prevents it, so **we never hand-wave a native change into an OTA update** — a runtime-version bump is mandatory for anything in the second list.

**OTA rollback = republish the previous immutable update to the channel.** Each EAS Update is content-addressed and immutable. A channel points at whichever update is "active" for a runtime version; rolling back means pointing the channel back at the prior good update (an EAS "roll back to embedded" / republish-previous operation). This is the direct mobile analogue of ADR-004's active-release pointer flip — no artifact is mutated, no rebuild occurs, activation is atomic, and the prior artifact stays immutable and addressable exactly as ADR-004 requires. Because a channel pointer flip is cheap and near-instant, OTA is also the fastest mitigation for a bad JS change — faster than any store path.

This rollback must be **demonstrated, not asserted**: MOB-021 must execute and record an actual OTA rollback drill (publish a marked bad update to `preview`, observe a device pick it up, flip the channel back, observe the device return to the prior update) as runtime evidence, consistent with the epic's rule that "documentation alone cannot substitute." See §6.

### 3. App version and build number scheme

- **Semantic app version** (`X.Y.Z`, the store-facing marketing version): **manually bumped** on a deliberate release, owned by the release commit, single source of truth in `app.config.ts` / `app.json`. It signals human-meaningful change and is what the min-supported-version check in §4 compares against.
- **Build/version number** (iOS `CFBundleVersion`, Android `versionCode`): **monotonically increasing, machine-derived, never hand-edited.** Primary source is EAS auto-increment; the CI-derived fallback is git commit count (`git rev-list --count HEAD`), which is monotonic and reproducible without EAS state. Stores reject a re-used or non-increasing build number, so this must be automatic to avoid failed submissions.

The two are orthogonal: many monotonic build numbers can share one semantic version (e.g. successive `preview` builds), and OTA updates ship under an unchanged semantic version and build number but a new immutable update ID. The min-version gate in §4 keys on the **semantic app version**, not the build number.

### 4. Minimum-supported-app enforcement (ties into ADR-021's N/N-1 signal)

ADR-021 defines the public API's N/N-1 compatibility window and a **min-supported-app-version signal** the API returns to clients. This ADR decides the client behavior:

1. On launch and on a cadence, the app reads the min-supported-app-version signal from `apps/api-public` (ADR-021's mechanism).
2. If the app's **semantic version (§3) is below** the advertised minimum, the app shows a **blocking, non-dismissible forced-update screen** with a deep link to its store listing (App Store / Play), and does not proceed to normal content. This protects the API's N-1 contract: clients too old to be supported are stopped at the door rather than making unsupported calls.
3. **Fail-open default for a missing or malformed signal.** If the signal itself is **unavailable, times out, is malformed, or is otherwise unreadable** (server outage, network timeout, bad/absent header, parse error), the app **fails OPEN** — it continues to operate normally as if it were supported. Rationale: a broken version-check must never become an accidental self-inflicted denial-of-service that bricks every install at once. A version *gate* is a safety mechanism, not an authorization boundary; the real authorization boundary is the API itself (App Check + guardrails, invariant 6), which stays authoritative regardless. Only a **valid, successfully parsed** signal that *explicitly* places the app below minimum triggers the blocking screen. Fail-closed is rejected precisely because it converts any signal outage into a fleet-wide outage.

This requirement (3) is stated explicitly and numbered so it cannot be left as an implementation-time coin flip.

### 5. Secrets in CI

Consistent with this repo's "secrets in Secret Manager / GitHub Actions secrets, never in the repo" doctrine (ADR-006; the WIF/OIDC pattern in `infra/gcp/wif/`):

- **Signing and store credentials live in EAS managed credentials**, not in the repo and not in GitHub secrets. EAS holds the iOS distribution certificate / provisioning profiles / push key and the Android keystore, and the Apple App Store Connect API key and Google Play service-account JSON used by EAS Submit. This also realizes MOB-001's noted fallback: EAS managed credentials survive local machine loss.
- **The only required GitHub Actions secret is a single, scoped, revocable EAS access token** (`EXPO_TOKEN`) stored as a GitHub Actions secret, used by CI to invoke EAS Build/Submit/Update. It is scoped to the minimum needed, rotatable, and revocable without touching signing material.
- **Nothing signing-related is committed to the repo** — no keystore, no `.p8`, no service-account JSON, no provisioning profile. `eas.json` contains only non-secret build configuration.

Web deploys use OIDC/WIF for keyless GCP auth (ADR-006); EAS does not offer GitHub OIDC federation today, so a single scoped, revocable token is the closest equivalent that keeps standing secrets to exactly one narrowly-scoped, rotatable credential. If EAS adds OIDC federation, migrating `EXPO_TOKEN` to it is a pure win and should be taken (see Migration triggers).

### 6. Rollback drill requirement (runtime evidence, per MOB-021)

Rollback is not proven by prose. MOB-021 must execute and record, as runtime evidence in the launch evidence index:

- **(a) An OTA rollback drill** — the channel-pointer-flip procedure of §2, demonstrated end-to-end on a real device against the `preview` channel: push a marked-bad update, confirm a device receives it, flip the channel to the prior immutable update, confirm the device returns to the prior update. Record update IDs, timestamps, and device evidence.
- **(b) A store-side expedited-review contingency plan** — because a native-layer bug can only be fixed by a new binary through store review (§2), and review latency is not fully in our control, MOB-021 must document and (where possible) rehearse the expedited/emergency review request path (Apple expedited App Review request; Google Play's escalation/review process), including who requests it, the justification template, and the interim OTA mitigation (disable the broken feature via an OTA feature-flag flip while the binary is in review). This is the mobile answer to "some failures can't be pointer-flipped away."

Neither (a) nor (b) may be closed by assertion; both require recorded execution/rehearsal.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Self-hosted Fastlane + self-hosted runners now | Standing signing infrastructure, keystore custody, and runner maintenance we do not need at pre-launch scale; EAS managed credentials remove the highest-risk secret custody. Reconsidered only on a measured trigger (below). |
| Manual Xcode/Transporter and Play Console uploads | Unauditable, skips CI gates — same reason ADR-006 rejects manual console prod deploys. |
| Ship native changes via OTA | Structurally unsafe (crash-on-launch); the runtime-version boundary exists precisely to forbid it. |
| Production build on every `main` merge | Untested/unaudited commits reach public store users — the mobile form of ADR-006's rejected "automatic App Hosting on every main push." Production is tag-gated. |
| Long-lived signing keys committed or in GitHub secrets | Violates repo secret doctrine; EAS managed credentials + one scoped token instead. |
| Fail-closed on a missing min-version signal | Converts any signal outage into a fleet-wide self-DoS; fail-open is the safety-preserving default (§4.3). |
| Auto-incrementing the *semantic* version in CI | Semantic version must carry human meaning and drive the min-version gate; only the build number is machine-monotonic. |

## Migration triggers (reversal cost: moving off EAS)

EAS is a managed dependency; this records the concrete condition for leaving it, consistent with the project's free-tier-first-with-a-recorded-upgrade-trigger principle.

- **EAS free-tier limits (as understood, 2026-07; re-verify at MOB-006 scaffold, since EAS pricing moves):** the free plan provides a small monthly quota of cloud builds (order of ~30 builds/month) on shared/queued infrastructure with lower priority and longer queue times, plus EAS Update with a bounded monthly active-user / bandwidth allotment. Paid tiers raise build concurrency/priority and Update MAU/bandwidth. **These numbers are not authoritative — MOB-019 must confirm current limits against Expo's live pricing before relying on them**, and the owner's monthly spend ceiling (MOB-001 human gate #7) governs whether we sit on free or a paid tier.
- **Concrete trigger to migrate off EAS to self-hosted (Fastlane + self-hosted GitHub runners):** if **either** (a) sustained build volume or Update MAU/bandwidth pushes EAS cost above the owner-set monthly ceiling with no cheaper EAS tier that fits, **or** (b) EAS queue latency repeatedly blocks the release cadence (e.g. can't get an expedited-fix binary built in time), **or** (c) an EAS pricing/policy change materially breaks the model — then migrate.
- **Reversal cost when triggered:** moderate but bounded, and deliberately de-risked. EAS Build wraps standard native tooling, so a Fastlane pipeline reproduces `fastlane gym`/`supply`/`pilot` equivalents of Build+Submit. The genuine costs are: (i) **taking custody of signing material** — export the iOS certificate/profiles and Android keystore out of EAS into our own secret store (Secret Manager, mirroring ADR-006/`infra/gcp/wif/` doctrine), the single highest-risk step; (ii) **standing up and hardening self-hosted macOS runners** for iOS builds (a real maintenance and supply-chain surface ADR-006's pinned-Actions discipline would extend to); and (iii) **replacing EAS Update** — the hardest piece, since OTA has no drop-in OSS equivalent with the same runtime-version guarantees, so leaving EAS likely means either self-hosting `expo-updates` against our own CDN or dropping OTA and living with store-review latency for every fix. That asymmetry is exactly why we stay on EAS until a measured trigger fires rather than pre-building a self-hosted plane.

## Rollback considerations

- **JS/content regression:** flip the EAS Update channel pointer to the prior immutable update (§2) — fastest path, atomic, no rebuild. This is the default first response.
- **Native/binary regression:** OTA-flip a feature flag off to neutralize the broken path immediately, then ship a corrected binary through EAS Build/Submit, requesting expedited store review per the §6(b) contingency. Store rollback to a prior binary is limited (Apple does not truly "roll back" a live version; Play supports halting a staged rollout), so the OTA feature-flag mitigation is the real-time control while the fixed binary is in review.
- **Bad forced-update gate:** because the min-version check fails open (§4.3), a mistaken or unreachable min-version signal cannot brick the fleet; correct the signal server-side (ADR-021 surface) and clients recover on next check.
- **Staged rollout:** production store releases use phased/staged rollout (Play staged rollout; App Store phased release) so a regression is caught on a fraction of installs before full exposure — the store-native form of ADR-006's "progressive release + automatic rollback."

## Consequences

- Mobile inherits invariant 4's immutable-artifact/atomic-activation/proven-rollback posture via two coherent mechanisms: EAS Update's content-addressed channel pointer (JS/content) and store binaries gated by runtime version (native), both demonstrated by MOB-021.
- Exactly one standing CI secret (`EXPO_TOKEN`); all signing custody sits in EAS managed credentials, keeping the repo and GitHub secrets free of signing material.
- A hard dependency on EAS is accepted deliberately, bounded by a recorded, measured migration trigger and a de-risked (if non-trivial) exit.
- MOB-005 (release-coupled bootstrap/content artifacts) can now assume this client-release lifecycle; MOB-019 wires the CI; MOB-020 creates store records; MOB-021 supplies the rollback-drill and expedited-review runtime evidence that closes the loop.
- Open cross-reference risk: this ADR is coupled to ADR-021's not-yet-final min-version signal shape — if ADR-021 lands with a different signal contract, §4 must be reconciled with it (numbered fail-open requirement 4.3 is expected to hold regardless).

_Package scope note: the mobile identity doc refers to the workspace scope as `@repo` in one place; the verified scope in this repo is `@repo` (e.g. `@repo/config`, `@repo/domain` in `packages/*/package.json`). No `@black-book` scope exists. Recorded here so downstream mobile package naming (MOB-003/006) uses the real scope._
