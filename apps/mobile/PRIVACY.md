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
| `expo` / `expo-modules-core` | Expo runtime | None user-identifying | No |
| `expo-constants` | Read build/config values | None | No |
| `expo-device` | Read device model/OS for compatibility/UX | Coarse device model + OS version (on-device; not transmitted by this app except as request metadata) — **does not request any runtime permission** | No |
| `expo-image` | Image rendering + cache | Fetches already-public media URLs; on-device cache only | No |
| `expo-linking` / `expo-router` | Deep-link routing (allowlisted, MOB-008) | None | No |
| `expo-web-browser` / `expo-splash-screen` / `expo-status-bar` / `expo-system-ui` / `expo-symbols` / `expo-glass-effect` / `expo-font` / `@expo-google-fonts/*` | UI / fonts / chrome | None user-identifying (fonts are bundled, not fetched) | No |
| `react-native`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`, `react-native-worklets` | RN runtime / animation / navigation | None | No |

## Client attestation (no Firebase App Check)

Every API request carries `X-BlackStory-Client: mobile/<version>; api=<major>`.
The server validates this header against the Postgres-backed client registry —
there is no Firebase App Check token, no `@react-native-firebase/*` dependency,
and no attestation JWT in logs (invariant 7; `src/security/log-redaction.ts`).

## Dev-console observability (MOB-018)

Crash and performance signals are emitted to the **dev console only** in
`__DEV__` builds via `src/observability/crash-reporter.ts`. Every value passes
through `src/security/log-redaction.ts` first. There is no remote crash SDK,
no session replay, and no user-behavior analytics product linked.

## Explicit confirmations (invariant 7)

- **No ad SDK.** No AdMob, no ad network, no advertising identifier (IDFA/GAID)
  is requested or read. There is no App Tracking Transparency prompt because
  nothing tracks.
- **No general analytics SDK.** Observability is diagnostic-only (dev console)
  and every value is redacted through `src/security/log-redaction.ts` first.
  `src/observability/no-raw-sdk-imports.test.ts` statically asserts no Firebase,
  ad SDK, or third-party analytics/attribution SDK is present anywhere in
  `apps/mobile/src`.
- **No third-party tracking / attribution SDK.**
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
