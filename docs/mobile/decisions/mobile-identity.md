# Mobile product identity, accounts, and release prerequisites

- **Bead**: `black-book-mobile-001` (MOB-001)
- **Date**: 2026-07-19
- **Status**: proposed — engineering-relevant fields settled; store-account fields are human gates (see "Open human gates")
- **Prepared by**: mobile-program-review (agent), pending owner sign-off on gated items

## Audit

| Surface | Existing value | Source |
|---|---|---|
| User-facing product name | `BlackStory` | `packages/config/src/identity.ts` (`PRODUCT_NAME`), `brand/README.txt` |
| Internal/code identity | `black-book`, `blackbook` | repo name `blackstory` (root `package.json`), GCP project `black-book-efaaf`, domain `blackbook.app` |
| Package scope | `@repo` (brand-agnostic, never renamed) | `packages/config/src/identity.ts` |
| Production domain | `blackbook.app` (in use: `api.blackbook.app`, `submit.blackbook.app`) | `infra/firebase/registered-apps.json`, api routes |
| Firebase/GCP project (prod, immutable) | `black-book-efaaf` (project number `332234323945`) | `infra/firebase/registered-apps.json` |
| Existing Firebase web apps | `web` (`apps/web`), `admin` (`apps/admin`) | `infra/firebase/registered-apps.json` |
| Brand mark | Book-and-pin lockup, light/dark, approved | `brand/README.txt`, `brand/logos/`, `brand/symbols/` |
| Design tokens | `ds` prefix, brand-agnostic | `packages/config/src/identity.ts` |
| Apple Developer account | **Unknown — not found in repo.** No `infra/apple/` or ASC config exists. | n/a |
| Google Play Console account | **Unknown — not found in repo.** No Play config exists. | n/a |
| Expo/EAS project | **Does not exist yet.** No `apps/mobile`, no `eas.json`, no `expo` account reference anywhere in the repo. | n/a |
| Trademark conflicts | **Not checked** — requires a live USPTO/state trademark search, which this agent cannot perform (no verified web-search tool wired for legal search in this session). | n/a |

## Decision

### Store-facing name and capitalization

- **Selected name**: `BlackStory` (matches the already-shipped `PRODUCT_NAME` constant and brand kit; no new name is introduced for mobile).
- **Subtitle working rule**: a short factual subtitle (e.g. "American history, documented") — final subtitle copy is a store-listing content task (MOB-020), not an identity decision.
- **Capitalization**: `BlackStory` (single word, medial capital) everywhere it appears as a proper noun in UI, store listings, and legal pages. Never `Black Story` (two words) or `BLACKSTORY`.

### Developer identity

- **Legal/developer name on stores**: not resolved — **human gate**. Requires knowing whether the Apple Developer Program account and Google Play Console account are (a) already provisioned under an org name, (b) to be provisioned as an individual account, or (c) to be provisioned as a new organization account (which requires D-U-N-S and can take days to weeks). This blocks nothing engineering-side; it blocks only the moment a real binary must be signed and submitted (MOB-019/020).

### Bundle / application IDs (proposed, NOT yet verified available)

Reverse-DNS of the owned domain `blackbook.app` gives the base identifier `app.blackbook`. Proposed scheme, matching the existing web pattern of one project with environment-scoped namespaces rather than separate legal entities:

| Environment | iOS Bundle ID (proposed) | Android applicationId (proposed) | Notes |
|---|---|---|---|
| Development | `app.blackbook.mobile.dev` | `app.blackbook.mobile.dev` | Local/simulator only. Never points at `black-book-efaaf` production Firebase — dev builds use the Firebase emulator suite per existing repo convention. |
| Preview (internal/EAS preview, TestFlight/Play internal testing) | `app.blackbook.mobile.preview` | `app.blackbook.mobile.preview` | Distinct Firebase App Check attestation, distinct push/App Store Connect record if Apple requires it. |
| Production | `app.blackbook.mobile` | `app.blackbook.mobile` | The only identifier ever submitted to a public store listing. |

**This bead does not register any of these identifiers.** Per program invariant 5, no permanent store resource is created before this record is approved. Availability of `app.blackbook.mobile` on the App Store and Play Store **has not been verified** (requires live Apple Developer / Play Console access) — **human gate**.

### URL scheme and associated domains

- **Custom URL scheme**: `blackstory://` (fallback deep link scheme, matches product display name, distinct from the reverse-DNS bundle id to stay readable in support docs and marketing).
- **Associated domains / App Links**: `blackbook.app` (universal links), plus any subdomain MOB-008 chooses for deep-link routing (e.g. `blackbook.app/e/{entityId}`, mirroring existing web routes so a single link works on web and native). Requires publishing `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from `apps/web` (or Firebase Hosting root) once the bundle/applicationId and Apple Team ID / Android signing SHA-256 are known — **deferred to MOB-008/MOB-020**, not blocked on this bead.

### Minimum OS / territories / account type

- **Minimum OS (proposed)**: iOS 16+, Android 8 (API 26)+ — matches Expo SDK's current supported floor and avoids maintaining polyfills for OS versions with negligible and declining share; MOB-006 should re-verify current Expo SDK minimums at scaffold time since these floors move with each Expo SDK release.
- **Territories (proposed)**: United States only at launch, matching the product's explicit U.S.-only scope (ADR-008, ADR-013). No international App Store/Play territories are enabled at launch.
- **Account type**: not resolved — **human gate** (individual vs. organization, see "Developer identity" above).
- **Spend ceiling**: not resolved — **human gate**. Apple Developer Program is a fixed annual fee; Google Play Console is a one-time fee; EAS Build/Submit has a usage-based or subscription tier depending on build volume — owner must set a monthly ceiling consistent with `operating-principle-runs-itself-within-reason` (budget-capped, kill-switch, free-tier-first).

### Root account custody

- **Apple Developer / App Store Connect, Google Play Console, Expo/EAS organization**: none provisioned yet. When provisioned, require phishing-resistant MFA (hardware security key or platform passkey) on all three, consistent with existing GCP/Firebase root-account hygiene (`stay-in-firebase-for-now` posture). **Human gate**: who holds these credentials and the recovery plan must be recorded here before any production build is signed.
- **Firebase, GitHub, DNS (`blackbook.app` registrar)**: already exist and are owned outside this bead's scope; mobile reuses the existing production Firebase project `black-book-efaaf` through the `apps/api-public` boundary (per program invariant 2) rather than provisioning a new Firebase project.

### Google Play closed-test requirement

Google Play requires 12 testers opted in for 14 continuous days via a closed test before a new app can request production access. **Not yet started** — this has a hard lead time and should begin as early as MOB-019/020 have a distributable build, not deferred to the end. Recorded here as a scheduling constraint, not an open decision.

### Support and privacy-policy URLs

- **Support URL (proposed)**: `https://blackbook.app/support` (new route; does not exist yet — MOB-020 to add or confirm an existing contact/support surface).
- **Privacy policy URL (proposed)**: reuse the existing web privacy-policy route if one exists under `apps/web` (e.g. `/methodology` or a dedicated `/privacy`); if no such route exists yet, MOB-020 must add one before store submission. Mobile adds no new privacy-relevant data collection beyond what the existing web app's policy should already disclose (App Check attestation, no ad/tracking SDKs, no accounts at launch per MOB-001 non-goals).

## Adversarial review

- **Brand conflict / trademark risk**: not cleared — flagged as an open human gate above. Recommend the owner run a USPTO TESS search plus App Store/Play Store name-collision search for "BlackStory" and "Black Story" before MOB-020 begins store record creation.
- **Impersonation risk**: registering `app.blackbook.mobile` and the `blackstory://` scheme early (once approved) reduces squatting risk; do not delay past MOB-006 scaffold.
- **Loss of signing access**: mitigated by the MFA + documented custody requirement above; EAS supports its own managed credentials service as a fallback if Apple/Google credentials are ever lost, which MOB-019 should evaluate.
- **Organization D-U-N-S delay**: if the owner chooses an organization Apple Developer account, budget 1-2+ weeks for D-U-N-S verification before any TestFlight build — this is a scheduling risk to flag against MOB-019/020 timelines now, not discover late.
- **Mismatched privacy-policy entity**: the privacy policy's named data controller must match whichever legal entity signs the Apple/Google developer agreements — resolve together, not independently.
- **Accidental production Firebase use from dev builds**: mitigated structurally — dev bundle id (`app.blackbook.mobile.dev`) never carries production `google-services.json` / `GoogleService-Info.plist`; MOB-006 must wire environment-scoped Firebase config files, never a single shared one.
- **Children-only category misclassification**: this product's content (historical violence, injustice, death) is unambiguously not child-directed; MOB-020 must select the correct App Store age rating (17+/Mature) and Play Console content rating (violence/injustice themes) explicitly, not accept a default.

## Open human gates (block MOB-020/021, not earlier engineering work)

1. Apple Developer Program account: provision (individual vs. org), D-U-N-S if org, phishing-resistant MFA, custody record.
2. Google Play Console account: provision, one-time fee, custody record, start the 12-tester/14-day closed test track as early as a build exists.
3. Expo/EAS organization: create, link billing, phishing-resistant MFA, custody record.
4. Verify `app.blackbook.mobile` (and `.dev`/`.preview` variants) are available/unclaimed on both stores before MOB-006 hardcodes them into build config.
5. Trademark/name-collision search for "BlackStory" on USPTO TESS and both app stores.
6. Confirm or create the public support URL and privacy-policy URL referenced above.
7. Owner-set monthly spend ceiling across Apple/Google/EAS, consistent with the project's budget-capped-automation posture.

None of these gate MOB-002 (architecture/ADRs), MOB-003 (contracts), MOB-006 (scaffold), or MOB-007 (brand tokens) — those proceed using the proposed dev/preview identifiers above, which create no permanent or public store resource. They do gate: registering the bundle/application ID with Apple/Google, publishing associated-domain files under the real production domain, creating any store listing, and starting the Play closed-test track.

## Evidence to close

- This decision record, dated and reviewed by the mobile program review pass (agent).
- No secrets are present (no accounts provisioned yet — nothing to redact).
- Verified support/privacy URLs: **not yet verified** — carried as open human gate #6 above, tracked in the epic, not blocking downstream engineering.
- Explicit unresolved blockers: gates #1-7 above, flagged to the owner via `bd human`.
