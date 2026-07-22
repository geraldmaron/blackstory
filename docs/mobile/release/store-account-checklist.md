# Store account checklist (owner)

- **Bead**: `repo-fsxq` (MOB-001 human gates)
- **Blocks**: `black-book-mobile-020` (MOB-020), first real EAS preview submit, TestFlight/Play closed testing
- **Source**: `docs/mobile/decisions/mobile-identity.md`
- **Status**: **none complete** — verified 2026-07-22 in `feat/mobile-launch` worktree

Owner-ordered checklist. Complete in sequence where noted; do not mark items done until evidence is recorded (account IDs, screenshots of console settings, or 1Password item links — never paste secrets into git).

---

## Before you start

- [ ] Read `docs/mobile/decisions/mobile-identity.md` (proposed bundle IDs, URLs, custody rules).
- [ ] Confirm monthly spend ceiling with project budget posture (free-tier-first; kill-switch if EAS usage spikes).
- [ ] Decide **individual vs organization** Apple/Google developer accounts (org may require D-U-N-S; budget 1–2+ weeks).

---

## 1. Apple Developer Program

- [ ] Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/) under the legal entity that will sign store agreements.
- [ ] Enable **phishing-resistant MFA** (hardware security key or platform passkey) on the Apple ID that owns the account.
- [ ] Record custody: primary owner, recovery contact, and where account recovery codes live (1Password item — not in repo).
- [ ] If **organization** account: complete D-U-N-S verification before expecting TestFlight uploads.
- [ ] Note **Team ID** (needed later for `apple-app-site-association` / universal links — MOB-008/MOB-020).

**Evidence to attach** (bead note or secure vault reference): enrolled entity name, Team ID, enrollment date.

---

## 2. Google Play Console

- [ ] Create Play Console developer account; pay one-time registration fee.
- [ ] Enable **phishing-resistant MFA** on the Google account that owns the console.
- [ ] Record custody (same standard as Apple).
- [ ] Create the app shell **only after** trademark + bundle-id gates (#4–5) — Play app IDs are permanent.

**Play closed-test lead time** (start as soon as a distributable preview build exists):

- [ ] Recruit **12 testers** opted into a closed test track.
- [ ] Keep them active for **14 continuous days** before requesting production access (Google policy for new personal/developer accounts).

**Evidence**: Play Console developer account ID, closed-test track name (once created).

---

## 3. Expo / EAS organization

- [ ] Create Expo account / organization at [expo.dev](https://expo.dev).
- [ ] Link billing; set usage alerts aligned with owner spend ceiling (#7).
- [ ] Enable **phishing-resistant MFA** on the Expo org owner account.
- [ ] Run `eas init` in `apps/mobile` to link project; set `EAS_PROJECT_ID` in EAS profile env (activates `expo-updates` URL in `app.config.ts`).
- [ ] Store **EAS access token** (CI-scoped, revocable) in 1Password — not in repo.

**Current repo state**: `eas.json` profiles exist (`development`, `preview`, `production`); `EAS_PROJECT_ID` is unset; no Expo org provisioned.

**Evidence**: Expo org slug, project ID, billing alert screenshot.

---

## 4. Bundle / application ID availability

Proposed identifiers (from `apps/mobile/app.config.ts` / MOB-001):

| Environment | iOS bundle ID | Android applicationId |
|---|---|---|
| Development | `app.blackbook.mobile.dev` | `app.blackbook.mobile.dev` |
| Preview (first EAS internal/TestFlight candidate) | `app.blackbook.mobile.preview` | `app.blackbook.mobile.preview` |
| Production (public store) | `app.blackbook.mobile` | `app.blackbook.mobile` |

- [ ] In **App Store Connect**, confirm `app.blackbook.mobile` (and `.preview` if registering a separate preview app) is unclaimed / available.
- [ ] In **Play Console**, confirm the same applicationIds are unclaimed.
- [ ] Register identifiers in both consoles **only after** trademark gate (#5) clears.

**Evidence**: screenshot or console note showing availability check date.

---

## 5. Trademark and store name collision

- [ ] USPTO TESS search for **BlackStory** and **Black Story** (and close variants).
- [ ] App Store search for name collisions on **BlackStory**.
- [ ] Play Store search for name collisions on **BlackStory**.
- [ ] Document outcome: proceed, rename subtitle only, or escalate to legal before creating store listings.

**Evidence**: search date + summary (links OK; no legal advice in repo).

---

## 6. Public support and privacy policy URLs

Store listings require live HTTPS URLs on the production domain.

| URL | Proposed | Verified in repo |
|---|---|---|
| Support | `https://blackbook.app/support` | **In repo** — `apps/web/src/app/support/` (`repo-tbpa` closed); **not verified live on production** |
| Privacy policy | `https://blackbook.app/privacy` | **In repo** — `apps/web/src/app/privacy/` (`repo-tbpa` closed); **not verified live on production** |

- [x] Engineering: `/support` and `/privacy` routes exist in `apps/web` (bead `repo-tbpa`).
- [ ] Deploy `feat/mobile-launch` (or merge) so both URLs return **200** on `blackbook.app`.
- [ ] Replace `[Legal entity — owner]` / `[Support contact — owner to set]` placeholders with the Apple/Google legal entity and a real contact (#1–2).
- [ ] Privacy policy **data controller** name must match the legal entity on Apple/Google agreements (#1–2).
- [ ] Verify both URLs return **200** on production (link crawler / manual check) before MOB-020 store metadata entry.

**Do not** point store listings at `/methodology` or other editorial routes as a privacy-policy substitute unless counsel approves.

---

## 7. Spend ceiling (Apple + Google + EAS)

| Cost surface | Typical model | Owner action |
|---|---|---|
| Apple Developer Program | Fixed annual fee | Budget renewal date |
| Google Play Console | One-time registration | One-time budget |
| EAS Build / Submit | Usage or subscription tier | Set monthly $ ceiling + Expo billing alert |

- [ ] Document approved **monthly EAS spend ceiling** and who receives alerts.
- [ ] Document **annual Apple renewal** owner.
- [ ] Align with ADR-023 free-tier posture (OTA code signing is a paid upgrade — accepted risk until budget allows).

**Evidence**: written ceiling amount + alert recipient (bead note).

---

## 8. Firebase iOS and Android apps + secrets in 1Password

Production Firebase project (existing): `black-book-efaaf` (`infra/firebase/registered-apps.json` lists **web + admin only** — no mobile apps yet).

Per environment tier, register Firebase apps and store config files in 1Password (Developer vault):

| Tier | Bundle / applicationId | Firebase apps to register | 1Password items (proposed names) |
|---|---|---|---|
| Development | `app.blackbook.mobile.dev` | iOS + Android (emulator/dev only; no prod Firebase in dev builds) | `BlackStory Mobile Firebase — Dev (iOS plist)`, `… Dev (Android json)` |
| Preview | `app.blackbook.mobile.preview` | iOS + Android | `BlackStory Mobile Firebase — Preview (iOS plist)`, `… Preview (Android json)` |
| Production | `app.blackbook.mobile` | iOS + Android | `BlackStory Mobile Firebase — Production (iOS plist)`, `… Production (Android json)` |

- [ ] In Firebase console (`black-book-efaaf`), register iOS apps for preview (+ production when gate clears).
- [ ] Register Android apps for preview (+ production when gate clears).
- [ ] Download `GoogleService-Info.plist` (iOS) and `google-services.json` (Android) per tier.
- [ ] Store each file in 1Password; wire EAS secrets / build credentials per MOB-019 runbook (never commit plists/json to git).
- [ ] Update `infra/firebase/registered-apps.json` with non-secret app metadata after registration (no secret keys in repo).

**Also store in 1Password** (if not already present — confirmed absent 2026-07-20 inventory):

- [ ] Apple Developer / App Store Connect API key (if using EAS Submit automation)
- [ ] Google Play service account JSON (if using EAS Submit automation)
- [ ] EAS CI token (scoped)

---

## 9. Gate: ready for first EAS **preview** submit

All must be true before `eas build --profile preview` is submitted to TestFlight or Play internal testing:

- [ ] Items **1–3** complete (Apple, Google, Expo/EAS org + MFA custody recorded).
- [ ] Item **4** availability confirmed for `app.blackbook.mobile.preview`.
- [ ] Item **5** trademark/name collision reviewed (no blocking conflict).
- [ ] Item **6** `/support` and `/privacy` live on `blackbook.app` **or** explicit owner waiver documented (MOB-020 cannot complete store metadata without them).
- [ ] Item **7** spend ceiling documented.
- [ ] Item **8** preview-tier Firebase iOS/Android apps registered; plist/json in 1Password; EAS env wired for preview profile.

---

## Related artifacts

- MOB-020 review packet skeleton: `docs/mobile/release/beta-review-packet.md`
- Mobile privacy SDK inventory: `apps/mobile/PRIVACY.md`
- EAS profiles: `apps/mobile/eas.json`
- Identity decision: `docs/mobile/decisions/mobile-identity.md`
