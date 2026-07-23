# `apps/mobile/src/updates` — EAS Update / OTA posture and controls (MOB-019, repo-ovn7)

Client-side wiring for EAS Update (the OTA mechanism ADR-023 §2 decided) and the
record of the code-signing posture decision ADR-023's 2026-07-20 adversarial
review amended. This bead's scope is **client wiring + decision documentation**,
not the EAS-side account provisioning — that is a separate human gate (below).

## The decision (already made — this bead implements it)

`docs/adr/ADR-023-mobile-build-release.md`'s "Adversarial review disposition"
(2026-07-20) and `docs/mobile/security/threat-model.md` T6 already resolved the
question this bead was chartered to decide:

> **On the free tier, OTA ships without end-to-end code signing.** EAS Update
> code signing is supported on SDK 56 but is gated to the EAS **Production or
> Enterprise plan** (docs.expo.dev/eas-update/code-signing) — a paid-plan
> feature, not an SDK-support question. Adopting it now would break the
> project's free-tier-first posture (ADR-023 §7). The T6 blast-radius controls
> therefore reduce to: **phishing-resistant MFA custody of the EAS
> organization** + **a scoped, revocable CI-only EAS publish token** +
> **channel/staged-rollout discipline** + **immutable-update rollback**
> (republish the previous update — never a hotfix in place). Enabling code
> signing later is a **cost-gated upgrade trigger** (ADR-023 §7): adopt it when
> moving to a paid EAS plan for other reasons, or when a threat reassessment
> makes the unsigned-OTA residual unacceptable.

This is recorded as **accepted risk by design**, not a gap silently left open.
Re-litigating it requires a new ADR amendment, not a code change here.

## What this bead wired

| Change | File | Why |
|---|---|---|
| `expo-updates` installed | `package.json` / `package-lock.json` (`npx expo install expo-updates --npm`) | ADR-023 amendment #2: the package was entirely absent — there was no OTA mechanism to speak of, only a documented intent. |
| `runtimeVersion: { policy: 'appVersion' }` | `app.config.ts` | ADR-023 §2's structural OTA/rebuild fence: a JS bundle only installs onto a binary whose runtime version matches, so an incompatible OTA is rejected client-side, not shipped-and-crashed. Declaring this costs nothing and does not depend on an EAS project existing. |
| `updates.url` + `extra.eas.projectId` (always) + `updates.enabled`/`checkAutomatically` by `APP_VARIANT` | `app.config.ts` | Project id defaults so local EAS CLI stays linked. **Development** sets `enabled: false` + `checkAutomatically: 'NEVER'` so Dev Client + Metro own the JS bundle (always-on updater previously fought Metro / codesigning → continuous refresh). Preview/production enable `ON_LOAD` against their channel. |
| `channel` per build profile | `eas.json` (already present, unchanged) | `development`/`preview`/`production` build profiles already each declare a distinct `channel`, matching ADR-023 §1's "OTA can never cross an environment boundary" requirement. Verified correct as-is; nothing to fix. |
| `resolveUpdatesPosture` / `loadNativeUpdates` / `checkForUpdate` / `fetchAndApplyUpdate` | `config.ts` / `native-bridge.ts` / `bootstrap.ts` | Client-side posture resolution + a defensive, never-throwing wrapper around `expo-updates`'s native surface, mirroring the guarded-`require` pattern `src/security/app-check.ts` and `src/observability/native-bridge.ts` already established. **Not wired into the app's entry point by this bead** — see "Not wired into app startup" below. |

## EAS project status

Project `@gerald-maron/blackstory` (`51a35884-e6b5-43b6-b95b-c5a7460fa665`) is
linked. `extra.eas.projectId` / `updates.url` are always present; OTA polling
is **variant-gated** (off for development, on for preview/production). Remaining
human gates: phishing-resistant MFA on the Expo account that owns
`gerald-maron`, and a scoped CI publish token in 1Password before the first
production `eas update` publish.

## MFA custody (threat-model T6 primary control on the free tier)

The EAS organization is root-account-tier custody, same bar as the
Apple/Google/Firebase root accounts `mobile-identity.md` already requires:

- **Phishing-resistant MFA required** on the EAS organization account
  (hardware security key or platform passkey — not SMS/TOTP, matching the
  "root-account custody" requirement already applied to Apple/Google/Firebase).
- **A recorded custody owner and a recovery plan**, same as those other root
  accounts — record who holds it and how it is recovered if that person is
  unavailable, before the first production publish.
- This is an account-configuration act on Expo's dashboard, not something this
  codebase can enforce or verify — record completion as human-gate evidence
  (MOB-021 launch-gate index), the same way Apple/Google account custody is
  recorded there.

## CI-scoped publish token (the actual blast-radius control, since code signing is off)

Per ADR-023 §5 and threat-model T6, with end-to-end code signing off on the
free tier, the token that can publish to the `production` OTA channel **is**
the primary attack surface — anyone holding it can push arbitrary JS to every
installed client instantly, with no store review:

- **Publish only from CI**, never from a developer laptop. No human ever holds
  a standing publish credential.
- **Scoped, revocable EAS access token** — not a personal Expo login — stored
  only as a GitHub Actions secret (never in the repo, never logged), rotated on
  the same cadence as the repo's other CI secrets (ADR-006's "no standing
  long-lived keys" doctrine, ported to EAS).
- **Least privilege**: the token needs `update`/`build`/`submit` scopes for
  this project only, nothing org-wide, if EAS's token scoping supports it at
  provisioning time — verify against EAS's current token-scoping options when
  the org is created (Expo's token model can change independently of this
  ADR).
- Wiring the actual GitHub Actions job that uses this token is MOB-019's
  broader CI-wiring scope, gated on the same human gate as above — no workflow
  file is added by this bead since there is no real token to authenticate with
  yet.

## Rollback runbook (ADR-023 §2/§6 — drilled at MOB-021, documented here)

**OTA rollback (fast path, no store review, the drilled case):**

1. Detect a bad `production`-channel update (crash spike, Crashlytics alert,
   or a manual report).
2. Identify the last known-good update id on that channel (every published
   update is immutable and addressable — never deleted, so the prior good
   update is always still retrievable).
3. Republish the previous known-good update to the `production` channel
   (`eas update --channel production`, pointed at the prior update — an EAS
   Update "rollback"/republish, not a new build).
4. Clients recover on their **next update check** — recovery latency is
   bounded by the client's check interval, not by store review. Record the
   update ids, timestamps, and observed recovery latency as launch evidence
   (ADR-023 §6 requires this be **drilled**, not merely asserted).
5. The bad update is never deleted — it stays in the immutable audit trail,
   just no longer the channel head.

**What OTA rollback cannot fix:** a regression in native code already shipped
to a store binary. That falls to ADR-023 §6's binary contingency — halt the
staged rollout, promote the prior known-good store build, request expedited
review — which this bead does not implement (it is a store-console runbook,
not app code).

**Never hotfix a shipped binary or a bad update in place** — publish a new
update or roll back the channel, mirroring ADR-004's "do not fix an active
release in place" doctrine.

## Not wired into app startup (deliberate boundary, not an oversight)

`bootstrap.ts`'s `getUpdatesPosture` / `checkForUpdate` / `fetchAndApplyUpdate`
exist so the actual entry-point call is a one-line addition, but this bead does
**not** call them from `src/runtime/AppProviders.tsx` — that composition root
is another bead's exclusive file (same boundary `src/observability/bootstrap.ts`
documents for its own `initializeObservability`). Two reasons this is safe to
defer, not a functional gap today:

1. **`expo-updates` checks automatically on preview/production.** With
   `updates.enabled: true` + `checkAutomatically: 'ON_LOAD'`, the native
   module downloads a new update on cold launch with **zero JS code required** —
   this module's explicit `checkForUpdate`/`fetchAndApplyUpdate` are for an
   opt-in "check now" affordance or a controlled apply-and-reload flow.
2. **Development is a deliberate no-op.** `APP_VARIANT=development` disables
   the native updater, and `bootstrap.ts` also short-circuits in `__DEV__` so
   a future composition-root call cannot reload over Metro. Wiring into
   `AppProviders` remains deferred until a product UI needs "check now".

## Not implemented here (explicitly out of scope)

- **EAS Update code signing** — the paid-plan feature itself. Enabling it is
  the recorded cost-gated upgrade trigger (ADR-023 §7), not something to
  half-implement against a free-tier account that cannot actually turn it on.
- **The GitHub Actions publish workflow** — needs the real CI-scoped token
  above; MOB-019's broader CI-wiring scope, gated on the same human gate.
- **The MOB-021 rollback drill itself** — this README documents the runbook
  the drill will execute; the drill needs a real EAS project and a real device
  to produce runtime evidence, which this bead's sandbox cannot produce.
