# Store account checklist (owner)

- **Bead**: `repo-fsxq` (MOB-001 human gates)
- **Blocks**: `black-book-mobile-020` (MOB-020), first real EAS preview submit, TestFlight/Play closed testing
- **Source**: `docs/mobile/decisions/mobile-identity.md`
- **Status**: **none complete** for account enrollment — verified 2026-07-22; store-search research notes added 2026-07-22; Firebase §8 superseded for v1

Owner-ordered checklist. Complete in sequence where noted; do not mark items done until evidence is recorded (account IDs, screenshots of console settings, or 1Password item links — never paste secrets into git).

---

## Before you start

- [ ] Read `docs/mobile/decisions/mobile-identity.md` (proposed bundle IDs, URLs, custody rules).
- [x] Confirm monthly spend ceiling with project budget posture (free-tier-first; kill-switch if EAS usage spikes).
  - **Owner 2026-07-22:** EAS ≤ **$10/mo** beyond Supabase; stay on Expo **Free** plan (15 iOS + 15 Android builds/mo). Do not subscribe Starter ($19) without raising the ceiling. Alert recipient: `me@geralddagher.com`.
- [x] Decide **individual vs organization** Apple/Google developer accounts (org may require D-U-N-S; budget 1–2+ weeks).
  - **Owner 2026-07-22:** **individual** for both.

---

## 1. Apple Developer Program

- [ ] Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/) under the legal entity that will sign store agreements.
  - **Owner 2026-07-22:** individual; legal name **Gerald Dagher**; Team ID **`4Q2XU7D33G`** confirmed (already in `eas.json` + AASA).
- [ ] Enable **phishing-resistant MFA** (hardware security key or platform passkey) on the Apple ID that owns the account.
- [ ] Record custody: primary owner, recovery contact, and where account recovery codes live (1Password item — not in repo).
- [x] Note **Team ID** (needed later for `apple-app-site-association` / universal links — MOB-008/MOB-020) — `4Q2XU7D33G`.

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

- [ ] USPTO Trademark Search (tmsearch.uspto.gov — TESS retired) for **BlackStory** and **Black Story** (and close variants).
- [x] App Store search for name collisions on **BlackStory** / **Black Stories** — agent pass 2026-07-22 (see notes below).
- [x] Play Store search for name collisions on **BlackStory** / **Black Stories** — agent pass 2026-07-22 (see notes below).
- [ ] Document owner outcome: proceed, rename subtitle only, or escalate to legal before creating store listings.

**Agent research notes (2026-07-22 — not legal advice):**

| Surface | Finding |
|---|---|
| Exact product mark | **BlackStory** (one word, medial capital) — no identical App Store / Play hit found in web search for a place-pinned history archive. |
| Near collision | Multiple **“Black Stories”** (two words) party/riddle games on Play and App Store (e.g. STARSIRIUS / TechInnovate Labs / “Black Stories - Dark Puzzles”). Different category (games), different spelling/spacing, different meaning. |
| USPTO | Automated fetch of tmsearch.uspto.gov blocked (407). **Owner must run Basic Search** for BLACKSTORY / BLACK STORY and save date + result summary in 1Password / bead notes. |
| Risk posture | Proceeding with **BlackStory** + subtitle “History, pinned to place.” is plausible; keep subtitle factual so store search distinguishes from “Black Stories” games. Escalate to counsel if USPTO shows live conflicting marks in IC 9/41. |

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
- [x] Replace legal-entity / support-contact placeholders — **Gerald Dagher** / `me@geralddagher.com` (2026-07-22).
- [x] Privacy policy **data controller** name matches individual Apple/Google agreements (Gerald Dagher).
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
  - **Ceiling:** $10 USD/mo beyond Supabase. **Plan:** Expo Free only. **Alerts:** `me@geralddagher.com`.
- [ ] Document **annual Apple renewal** owner — Gerald Dagher (individual).
- [x] Align with ADR-023 free-tier posture (OTA code signing is a paid upgrade — accepted risk until budget allows).

**Evidence**: written ceiling amount + alert recipient (bead note).

---

## 8. Signing / submit secrets in 1Password (Firebase App Check N/A)

**Superseded for v1 mobile client:** `apps/mobile` uses Postgres-backed `X-BlackStory-Client` attestation — **no** `@react-native-firebase/*`, **no** `GoogleService-Info.plist` / `google-services.json` in the native app (see `apps/mobile/README.md`, `apps/mobile/PRIVACY.md`). Do **not** block preview builds on Firebase mobile app registration.

Still required for EAS Submit automation (store when ready):

- [ ] Apple Developer / App Store Connect API key (Issuer ID, Key ID, `.p8`) in 1Password
- [ ] Google Play service account JSON (if using EAS Submit for Android)
- [ ] EAS CI token (scoped, revocable)

Optional later: if a future bead reintroduces Firebase Crashlytics or App Check, register iOS/Android apps under `black-book-efaaf` then — not a MOB-020 gate today.

---

## 9. Gate: ready for first EAS **preview** submit

All must be true before `eas build --profile preview` is submitted to TestFlight or Play internal testing:

- [ ] Items **1–3** complete (Apple, Google, Expo/EAS org + MFA custody recorded).
- [ ] Item **4** availability confirmed for `app.blackbook.mobile.preview`.
- [ ] Item **5** trademark/name collision reviewed (no blocking conflict) — store searches drafted; USPTO owner pass still open.
- [ ] Item **6** `/support` and `/privacy` live on `blackbook.app` **or** explicit owner waiver documented (MOB-020 cannot complete store metadata without them).
- [ ] Item **7** spend ceiling documented.
- [ ] Item **8** ASC/Play/EAS submit secrets in 1Password **if** using automated submit (manual upload acceptable for first beta).

---

## Related artifacts

- MOB-020 review packet skeleton: `docs/mobile/release/beta-review-packet.md`
- Mobile privacy SDK inventory: `apps/mobile/PRIVACY.md`
- EAS profiles: `apps/mobile/eas.json`
- Identity decision: `docs/mobile/decisions/mobile-identity.md`
