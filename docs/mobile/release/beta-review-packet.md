# Beta review packet (MOB-020 skeleton)

- **Bead**: `black-book-mobile-020` (MOB-020)
- **External ref**: MOB-020
- **Status**: **draft advancing** — store copy drafted; still blocked on accounts + live URLs
- **Blocked by**: `repo-fsxq` human gates (`docs/mobile/release/store-account-checklist.md`)
- **Updated**: 2026-07-22 (agent) — brand-safe draft copy for owner review; not yet submitted

Packet for TestFlight, Google Play closed/internal testing, and eventual store review. Replace every remaining `[PLACEHOLDER]` / `[OWNER]` before submission. No placeholder content may ship in store listings or review notes.

---

## 1. Release candidate identity

| Field | Value |
|---|---|
| Product name | BlackStory |
| Subtitle (App Store) | **Draft:** History, pinned to place. |
| Short description (Play) | **Draft (78 chars):** American history on a map — people, places, evidence, and context you can check. |
| Full description | **Draft:** BlackStory is a place-connected research archive. Explore documented people and places on a map, open the evidence behind each record, and follow citations to primary sources. People. Places. Evidence. Context. No accounts. No ads. Optional corrections go through moderated review — nothing changes publicly until it passes independent review. United States coverage at launch. |
| Primary category (iOS) | **Draft:** Reference (secondary: Education) |
| Primary category (Play) | **Draft:** Education (or Books & Reference if Play taxonomy prefers) |
| Age rating (iOS) | **17+ / Mature** (historical violence, injustice — not child-directed) |
| Content rating (Play) | **Draft intent:** IARC — flag violence / historical injustice themes; not child-directed. Owner completes questionnaire in Play Console. |
| Territories at launch | United States only (MOB-001) |
| Preview bundle ID | `app.blackbook.mobile.preview` |
| Production bundle ID | `app.blackbook.mobile` |
| Preview build channel (EAS) | `preview` (`apps/mobile/eas.json`) |
| API origin (preview/prod) | `https://api.blackbook.app` |

---

## 2. Store URLs and contact

| Field | URL / value | Status |
|---|---|---|
| Support URL | `https://blackbook.app/support` | **In repo** on this branch; production still redirects to `/lander` (verified 2026-07-22) |
| Privacy policy URL | `https://blackbook.app/privacy` | **In repo** on this branch; production still redirects to `/lander` (verified 2026-07-22) |
| Marketing URL (optional) | `https://blackbook.app` | Live (web app; currently lander-gated) |
| Contact email (store-facing) | `me@geralddagher.com` |

**Blocker**: MOB-020 cannot pass link validation until `/support` and `/privacy` return real HTML 200 on production **and** `[Legal entity — owner]` / `[Support contact — owner to set]` placeholders are replaced.

---

## 3. Screenshots and preview media

Capture from **actual preview/production builds** on representative devices. Use approved brand assets only (`apps/web/public/brand/`, root `brand/`).

### iOS (App Store Connect)

| Device class | Size (px) | Files | Status |
|---|---|---|---|
| iPhone 6.7" | 1290 × 2796 | `[PLACEHOLDER — 01-explore.png …]` | Not captured |
| iPhone 6.5" | 1284 × 2778 | `[PLACEHOLDER]` | Not captured |
| iPad Pro 12.9" (if supporting tablet) | 2048 × 2732 | `[PLACEHOLDER]` | Not captured |

**Suggested frames** (minimum set):

1. Explore map with evidence markers (no alarm/red violence heat styling).
2. Entity detail with citation/evidence visible.
3. Search results (bounded filters).
4. Correction intake + receipt (no PII in screenshot).
5. Dark mode equivalent of #1 or #2.

### Android (Play Console)

| Type | Size | Files | Status |
|---|---|---|---|
| Phone screenshots | min 320px short edge | `[PLACEHOLDER — match iOS narrative set]` | Not captured |
| Feature graphic | 1024 × 500 | `[PLACEHOLDER]` | Not captured |
| App icon | 512 × 512 | `[PLACEHOLDER — from brand symbol master]` | Not captured |

### App preview video (optional)

- [ ] `[PLACEHOLDER — URL or "not submitted"]`

---

## 4. App Store privacy nutrition labels

Derived from audited inventory: `apps/mobile/PRIVACY.md` (MOB-010). MOB-020 must reconcile with aggregated `PrivacyInfo.xcprivacy` at build time.

### Data linked to you

| Data type | Collected? | Purpose | Notes |
|---|---|---|---|
| Contact info | No | — | No accounts at launch |
| Location | No | — | No location permission declared |
| User content | No* | — | *Corrections submitted via API; treat as server-side intake, not on-device collection for label purposes — confirm with current Apple guidance |
| Identifiers | No | — | No IDFA; no ad SDK |
| Usage data | No | — | No analytics SDK |
| Diagnostics | **Draft: No** (production) | — | Production builds emit nothing from the crash/perf layer (`apps/mobile/README.md` / MOB-018). `__DEV__` console only. Confirm on first preview IPA Privacy Report. |

### Data used to track you

- **None** — no tracking domains or SDKs (`apps/mobile/PRIVACY.md` invariant 7).

### Privacy manifest

- [ ] Export Xcode **Privacy Report** from preview IPA.
- [ ] Attach path: `[PLACEHOLDER — e.g. artifacts/mob-020/ios-privacy-report.pdf]`
- [ ] Confirm aggregated manifest matches this worksheet.

---

## 5. Google Play Data Safety form

Complete in Play Console using the same inventory as §4.

| Question area | Draft answer | Verified |
|---|---|---|
| Collects or shares user data? | **Draft: No** for on-device collection; corrections are optional server intake via HTTPS (disclose accurately if Play treats form POST as collection) | No |
| Data encrypted in transit? | Yes (HTTPS to `api.blackbook.app`) | Yes |
| Users can request deletion? | **Draft:** Contact support; correction content retained under moderated review policy until disposed | No |
| Independent security review? | No | Yes |
| Ads | No | Yes |
| Location | Not collected | Yes |
| Personal info | Not collected (no accounts) | Yes |
| App activity / diagnostics | **Draft: No** in production (MOB-018) | No |

- [ ] Play **pre-launch report** clean for preview AAB.
- [ ] Attach report export: `[PLACEHOLDER]`

---

## 6. Permissions and sensitive capabilities

From `apps/mobile/PRIVACY.md` / `app.config.ts`:

- No camera, microphone, contacts, calendar, or location permissions at launch.
- Internet access only (OS baseline).
- Optional: document **no ATT prompt** (no tracking).

Reviewer note snippet:

> BlackStory is a read-only historical reference app. No login. No ads. No tracking. No background location. Optional corrections submit to `https://api.blackbook.app` and receive an opaque receipt; nothing publishes without moderated review.

---

## 7. Content rights and attribution

- [ ] Map tiles / PMTiles attribution text matches in-app credits (MOB-011).
- [ ] Media rights: only publicly licensed or project-owned assets in screenshots and app.
- [ ] Third-party fonts: Sora, Inter, Source Serif 4, IBM Plex Mono (SIL OFL / Apache — confirm license files in `brand/` / font packages before submit).

---

## 8. Tester instructions

### TestFlight (iOS)

**Audience**: **Draft:** internal team + representative U.S. history educators / archive users  

**Install steps**:

1. Accept TestFlight invite sent to `[OWNER — email domain policy]`.
2. Install **BlackStory (Preview)** (`app.blackbook.mobile.preview`).
3. Confirm app loads Explore without login.

**What to exercise** (30–45 min):

| Area | Steps | Pass? |
|---|---|---|
| Cold start | Launch from home screen; no crash | `[ ]` |
| Explore map | Pan/zoom; open entity pin | `[ ]` |
| Entity detail | Citations render; back navigation | `[ ]` |
| Search | Run bounded query; open result | `[ ]` |
| Dark mode | Toggle system appearance | `[ ]` |
| Correction | Submit test correction; receive receipt code | `[ ]` |
| Deep link | Open `blackstory://` allowlisted route (if enabled) | `[ ]` |
| Offline | Airplane mode → graceful empty/error states | `[ ]` |

**Feedback channel**: `[OWNER — email / form URL; prefer support@ once set]`

### Google Play closed / internal testing

**Closed test track name**: **Draft:** `closed-preview` (create in Play Console)

**12-tester / 14-day requirement** (new developer accounts):

- [ ] Roster of 12 opted-in testers: `[OWNER — names/emails in secure doc, not repo]`
- [ ] Day-1 start date: `[OWNER]`
- [ ] Day-14 eligible date: `[OWNER]`

**Install steps**:

1. Opt in via Play closed-test link `[OWNER — after track exists]`.
2. Install preview build from Play Store testing channel.
3. Same exercise matrix as TestFlight above.

---

## 9. App Review notes (both stores)

Paste into App Store Connect / Play Console review notes:

```
BlackStory is a U.S.-only historical reference reader. No user accounts, no ads, no tracking SDKs, no location permission.

Demo account required: No (no login).

Special instructions:
- App reads public historical records from https://api.blackbook.app.
- Optional correction submission sends user-entered text to the submissions API; no account is created; reviewers may submit a test correction and discard.
- Support: https://blackbook.app/support (must be live before submit).
- Privacy: https://blackbook.app/privacy (must be live before submit).

Contact for review questions: Gerald Dagher, me@geralddagher.com.
```

---

## 10. Beta build registry

| Platform | Profile | Build ID / version | Distribution link | Date |
|---|---|---|---|---|
| iOS | `preview` | `7c6b1a68-8d11-4599-84fd-448e8ef0279e` (buildNumber 8) | https://expo.dev/accounts/gerald-maron/projects/blackstory/builds/7c6b1a68-8d11-4599-84fd-448e8ef0279e | 2026-07-22 — queued on EAS Free (ad hoc: iPhone + Mac) |
| Android | `preview` | `6482d531-de5c-42cc-a6f9-1ff4aac9d2cf` (versionCode 2) | https://expo.dev/accounts/gerald-maron/projects/blackstory/builds/6482d531-de5c-42cc-a6f9-1ff4aac9d2cf | 2026-07-22 — queued on EAS Free |

---

## 11. Blockers and dependencies

| Blocker | Owner | Bead |
|---|---|---|
| Apple / Google / EAS accounts not provisioned | Owner | `repo-fsxq` |
| Bundle IDs not verified available | Owner | `repo-fsxq` |
| Trademark search not done | Owner | `repo-fsxq` |
| `/support` and `/privacy` not live on production (repo pages exist; lander still intercepts) | Engineering + owner | `repo-tbpa` (code closed; deploy + placeholders remain) |
| Spend ceiling not set | Owner | `repo-fsxq` |
| Firebase mobile App Check configs | **N/A for v1** — Postgres client attestation; no `@react-native-firebase/*` | superseded |
| ASC API / Play service account / EAS token in 1Password | Owner (when EAS Submit automation needed) | `repo-fsxq` |
| Physical device + VoiceOver/TalkBack evidence | Owner + engineering | `repo-f7we`, `repo-1z1a` |

---

## 12. Evidence to close MOB-020

Attach to bead before close:

- [ ] TestFlight + Play closed-track links (§10)
- [ ] Completed privacy nutrition + Data Safety exports (§4–5)
- [ ] Screenshot set uploaded to both consoles (§3)
- [ ] Tester roster + 14-day Play compliance record (§8)
- [ ] Review notes pasted (§9)
- [ ] Link crawler pass for support/privacy/marketing URLs
- [ ] Clean install recording (fresh account / new device)

---

## Related documents

- Owner checklist: `docs/mobile/release/store-account-checklist.md`
- Identity + gates: `docs/mobile/decisions/mobile-identity.md`
- SDK inventory: `apps/mobile/PRIVACY.md`
- Epic index: `docs/mobile/mobile-app-epic.md`
