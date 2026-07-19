# Mobile privacy & SDK data-collection inventory (MOB-010)

- **Bead**: `black-book-mobile-010` (MOB-010)
- **Scope**: `apps/mobile` (the native iOS/Android reader)
- **Invariant**: mobile privacy invariant 7 (`docs/mobile/mobile-app-epic.md`,
  `docs/mobile/security/threat-model.md`) — **no ad SDKs, no tracking, no
  analytics beyond privacy-safe observability (MOB-018); no query text,
  correction content, precise location, citation URLs, or sensitive entity
  classifications in logs or crash reports.**

This is a human-readable inventory, **not** an iOS `PrivacyInfo.xcprivacy`
manifest. The exact `xcprivacy` "reason code" syntax (`NSPrivacyAccessedAPITypes`,
`NSPrivacyCollectedDataTypes`) is generated at build time — Expo's
`apple.privacyManifestAggregationEnabled` is already `true` in
`ios/Podfile.properties.json`, so each pod contributes its own privacy manifest
and Expo aggregates them. This document is the authoritative human review that
those aggregated declarations must match; MOB-020 confirms the final aggregated
`PrivacyInfo.xcprivacy` before store submission.

## Native SDK inventory (data-collection implications)

| SDK / module | Purpose | Data collected / transmitted | Tracking? |
|---|---|---|---|
| `@react-native-firebase/app` | Firebase core (App Check host) | Device/app attestation metadata sent to Firebase App Check *only* — no user identifiers, no Analytics module linked | No |
| `@react-native-firebase/app-check` | App Attest / DeviceCheck (iOS), Play Integrity (Android) attestation | Hardware-backed attestation assertion + App Check JWT. Attests that a genuine build runs on a genuine device. **No personal data, no advertising ID, no location.** Raw tokens never logged (invariant 7). | No |
| `expo` / `expo-modules-core` | Expo runtime | None user-identifying | No |
| `expo-constants` | Read build/config values | None | No |
| `expo-device` | Read device model/OS for compatibility/UX | Coarse device model + OS version (on-device; not transmitted by this app except as request metadata) — **does not request any runtime permission** | No |
| `expo-image` | Image rendering + cache | Fetches already-public media URLs; on-device cache only | No |
| `expo-linking` / `expo-router` | Deep-link routing (allowlisted, MOB-008) | None | No |
| `expo-web-browser` / `expo-splash-screen` / `expo-status-bar` / `expo-system-ui` / `expo-symbols` / `expo-glass-effect` / `expo-font` / `@expo-google-fonts/*` | UI / fonts / chrome | None user-identifying (fonts are bundled, not fetched) | No |
| `react-native`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`, `react-native-worklets` | RN runtime / animation / navigation | None | No |

## Explicit confirmations (invariant 7)

- **No ad SDK.** No AdMob, no ad network, no advertising identifier (IDFA/GAID)
  is requested or read. There is no App Tracking Transparency prompt because
  nothing tracks.
- **No analytics SDK** beyond the privacy-safe observability MOB-018 will add
  (which, per its bead, must itself carry no query text / correction content /
  precise location / citation URLs / sensitive classifications — routed through
  `src/security/log-redaction.ts`).
- **No third-party tracking / attribution / crash-reporter with PII.** Firebase
  Analytics, Crashlytics, and all Firestore/Auth data modules are deliberately
  **not linked** (ADR-020 §3: App Check surface only).
- **No accounts, no push, no social, no background location** at launch
  (non-goals) — so there are no credentials, contacts, notification tokens, or
  location streams to collect.

## Permissions footprint (least privilege — MOB-010 item 3)

`app.config.ts` declares **no** `ios.infoPlist` permission usage strings and
**no** `android.permissions` entries. No dependency requires camera, photo
library, contacts, microphone, calendar, location, or notification permissions
(verified: no such package is in `package.json`). The merged native manifests
therefore request only the OS baseline (internet access). Any future permission
addition is a review-blocking manifest diff (threat-model T8; enforced in
MOB-019 CI).

## App Check token handling

App Check JWTs are attestation assertions, not user data — but they are still
treated as never-log secrets (ADR-010; invariant 7). `src/security/api-client.ts`
attaches the token under `X-Firebase-AppCheck` and `src/security/log-redaction.ts`
redacts any JWT-shaped value (and any `*token*`/`*appcheck*` key) from every log
sink. Enforcement of App Check is staged monitor→enforce
(`src/security/README.md`).
