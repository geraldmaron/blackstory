# Beta review packet (MOB-020 skeleton)

- **Bead**: `black-book-mobile-020` (MOB-020)
- **External ref**: MOB-020
- **Status**: **draft skeleton** — not submission-ready
- **Blocked by**: `repo-fsxq` human gates (`docs/mobile/release/store-account-checklist.md`)

Packet for TestFlight, Google Play closed/internal testing, and eventual store review. Replace every `[PLACEHOLDER]` before submission. No placeholder content may ship in store listings or review notes.

---

## 1. Release candidate identity

| Field | Value |
|---|---|
| Product name | BlackStory |
| Subtitle (App Store) | `[PLACEHOLDER — e.g. American history, documented]` |
| Short description (Play) | `[PLACEHOLDER — ≤80 chars]` |
| Full description | `[PLACEHOLDER — see brand language in AGENTS.md]` |
| Primary category (iOS) | `[PLACEHOLDER — e.g. Reference or Education]` |
| Primary category (Play) | `[PLACEHOLDER]` |
| Age rating (iOS) | **17+ / Mature** (historical violence, injustice — not child-directed) |
| Content rating (Play) | `[PLACEHOLDER — complete IARC questionnaire; flag violence/injustice themes]` |
| Territories at launch | United States only (MOB-001) |
| Preview bundle ID | `app.blackbook.mobile.preview` |
| Production bundle ID | `app.blackbook.mobile` |
| Preview build channel (EAS) | `preview` (`apps/mobile/eas.json`) |
| API origin (preview/prod) | `https://api.blackbook.app` |

---

## 2. Store URLs and contact

| Field | URL / value | Status |
|---|---|---|
| Support URL | `https://blackbook.app/support` | **In repo** (`apps/web/src/app/support/`); production 200 **unverified** |
| Privacy policy URL | `https://blackbook.app/privacy` | **In repo** (`apps/web/src/app/privacy/`); production 200 **unverified** |
| Marketing URL (optional) | `https://blackbook.app` | Live (web app) |
| Contact email (store-facing) | `[PLACEHOLDER — e.g. support@blackbook.app]` |

**Blocker**: MOB-020 cannot pass link validation until `/support` and `/privacy` return 200 on production **and** legal-entity / support-contact placeholders are replaced.

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
| Diagnostics | `[PLACEHOLDER]` | App functionality | Dev-console observability only in `__DEV__`; confirm production build behavior per MOB-018 |

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
| Collects or shares user data? | `[PLACEHOLDER — likely "No" or minimal diagnostics; align with MOB-018]` | No |
| Data encrypted in transit? | Yes (HTTPS to `api.blackbook.app`) | Yes |
| Users can request deletion? | `[PLACEHOLDER — corrections receipt workflow / contact support]` | No |
| Independent security review? | No | Yes |
| Ads | No | Yes |
| Location | Not collected | Yes |
| Personal info | Not collected (no accounts) | Yes |
| App activity / diagnostics | `[PLACEHOLDER]` | No |

- [ ] Play **pre-launch report** clean for preview AAB.
- [ ] Attach report export: `[PLACEHOLDER]`

---

## 6. Permissions and sensitive capabilities

From `apps/mobile/PRIVACY.md` / `app.config.ts`:

- No camera, microphone, contacts, calendar, or location permissions at launch.
- Internet access only (OS baseline).
- Optional: document **no ATT prompt** (no tracking).

Reviewer note snippet:

> `[PLACEHOLDER — BlackStory is a read-only historical reference app. No login. No ads. No background location. Corrections optional via in-app form to api.blackbook.app.]`

---

## 7. Content rights and attribution

- [ ] Map tiles / PMTiles attribution text matches in-app credits (MOB-011).
- [ ] Media rights: only publicly licensed or project-owned assets in screenshots and app.
- [ ] Third-party fonts: Sora, Inter, Source Serif 4, IBM Plex Mono (open-source — `[PLACEHOLDER license refs]`).

---

## 8. Tester instructions

### TestFlight (iOS)

**Audience**: `[PLACEHOLDER — internal team + representative U.S. history educators]`  

**Install steps**:

1. Accept TestFlight invite sent to `[PLACEHOLDER email domain policy]`.
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

**Feedback channel**: `[PLACEHOLDER — email / GitHub Discussions / form URL]`

### Google Play closed / internal testing

**Closed test track name**: `[PLACEHOLDER]`

**12-tester / 14-day requirement** (new developer accounts):

- [ ] Roster of 12 opted-in testers: `[PLACEHOLDER — names/emails in secure doc, not repo]`
- [ ] Day-1 start date: `[PLACEHOLDER]`
- [ ] Day-14 eligible date: `[PLACEHOLDER]`

**Install steps**:

1. Opt in via Play closed-test link `[PLACEHOLDER]`.
2. Install preview build from Play Store testing channel.
3. Same exercise matrix as TestFlight above.

---

## 9. App Review notes (both stores)

Paste into App Store Connect / Play Console review notes:

```
[PLACEHOLDER]

Demo account required: No (no login).

Special instructions:
- App reads public historical records from https://api.blackbook.app.
- Optional correction submission sends user-entered text to the same API; no account created.
- Support: https://blackbook.app/support (must be live before submit).
- Privacy: https://blackbook.app/privacy (must be live before submit).

Contact for review questions: [PLACEHOLDER name, email, phone].
```

---

## 10. Beta build registry

| Platform | Profile | Build ID / version | Distribution link | Date |
|---|---|---|---|---|
| iOS | `preview` | `[PLACEHOLDER]` | `[PLACEHOLDER TestFlight link]` | — |
| Android | `preview` | `[PLACEHOLDER]` | `[PLACEHOLDER Play internal link]` | — |

---

## 11. Blockers and dependencies

| Blocker | Owner | Bead |
|---|---|---|
| Apple / Google / EAS accounts not provisioned | Owner | `repo-fsxq` |
| Bundle IDs not verified available | Owner | `repo-fsxq` |
| Trademark search not done | Owner | `repo-fsxq` |
| `/support` and `/privacy` not published | Engineering + owner | `repo-tbpa` |
| Spend ceiling not set | Owner | `repo-fsxq` |
| Firebase mobile apps + 1Password secrets | Owner | `repo-fsxq` |
| MOB-019 EAS submit automation + device matrix | Engineering | `black-book-mobile-019` |
| Accessibility gate (MOB-017) | Engineering | `black-book-mobile-017` |

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
