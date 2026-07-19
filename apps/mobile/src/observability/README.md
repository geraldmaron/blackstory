# `apps/mobile/src/observability` — privacy-safe crash/perf reporting (MOB-018)

Client-side observability for the native reader: crash reporting, performance
tracing, and the release/build metadata that ties a report to an exact build.
**This is diagnostic tooling, not analytics** — see "Not analytics" below.

## SDK choice: Firebase Crashlytics + Performance Monitoring

`@react-native-firebase/crashlytics` + `@react-native-firebase/perf`, chosen
over Sentry (the other realistic option) for the same reasons ADR-020 chose
React Native Firebase App Check over an alternative attestation stack:

- **Firebase-first posture already established.** `docs/mobile/decisions/mobile-identity.md`
  and ADR-020 record a deliberate "stay in Firebase" preference for this
  project (single vendor, one Firebase project — `black-book-efaaf` — already
  the system of record per `apps/api-public`'s boundary). App Check already
  links `@react-native-firebase/app`; Crashlytics/Performance are two more
  modules on an SDK family already in the dependency tree, not a new vendor
  relationship, a new dashboard login, or a new DPA to review.
- **Cost.** Both Crashlytics and Performance Monitoring are **free, with no
  per-event or per-crash billing** in Firebase's actual pricing model (unlike
  Firestore reads, Cloud Run invocations, or a metered map API — the things
  `infra/gcp/cost-controls/cost-controls-matrix.json` actually budgets).
  Sentry's free tier is event-volume-capped and paid tiers bill per event;
  Crashlytics/Performance have no such ceiling to budget against. See "Cost
  ceilings" below for what this does and does not remove from scope.
- **Proven gated-config-plugin pattern to reuse, not invent.** MOB-010's
  `src/security/app-check.ts` already established: (a) a config-plugin slot
  in `app.config.ts` gated on the same `firebaseConfigPresent` check (no
  `GoogleService-Info.plist` / `google-services.json` committed yet — a human
  gate, not a new one), and (b) a guarded `require()` native loader that
  degrades to `null` instead of throwing when the native module or its config
  is absent. `src/observability/native-bridge.ts` mirrors (b) exactly;
  `app.config.ts`'s plugin list mirrors (a) exactly.
- **What Sentry would have bought instead:** richer session-replay/breadcrumb
  UX and a vendor-neutral client. Neither materially matters here — the
  redaction pipeline (below) is the actual privacy control regardless of
  which SDK receives the (already-scrubbed) payload, and richer session
  replay is explicitly the kind of surface privacy invariant 7 forbids
  capturing in the first place (no query text, no correction content, no
  precise location, no citation URLs, no sensitive classifications).

## Redaction is mandatory, not optional

`reportError`, `addBreadcrumb`, and `startPerfTrace`/`reportPerf`
(`crash-reporter.ts`) are the **only** sanctioned path from app code to the
crash/perf SDK. They pipe every context payload through
`src/security/log-redaction.ts` — MOB-010's existing, tested utility, not a
reimplementation — before it can reach `@react-native-firebase/crashlytics`
or `@react-native-firebase/perf`. `no-raw-sdk-imports.test.ts` statically
scans the whole `apps/mobile/src` tree so a future direct import of either
package outside `native-bridge.ts` fails CI.

## Not analytics

Crashlytics and Performance Monitoring are **diagnostic-only**: crash
stack traces, ANR/slow-frame signals, and named performance traces tied to a
build. Neither is a user-behavior analytics product. This app adds **no**
general analytics SDK, ad SDK, or attribution SDK — `no-raw-sdk-imports.test.ts`
also asserts this (Firebase Analytics, ad-mob, Segment/Amplitude/Mixpanel,
and App Tracking Transparency are all absent). `PRIVACY.md` records the same
distinction for the SDK inventory.

## Release/build metadata tagging

`report-context.ts`'s `buildReportContext()` centralizes every field every
report carries: app version, EAS Update runtime version (ADR-023 §2),
release ID (the server release stamp this client last synced against — MOB-005
bootstrap / `data/release-cache.ts`), local cache schema version
(`data/db/schema.ts`'s `CACHE_SCHEMA_VERSION`), platform/OS version, app
variant (dev/preview/production), and the current degraded-mode state
(MOB-009's connectivity signal). `bootstrap.ts` is the only place that
gathers the real inputs (`expo-constants`, `Platform`, the SQLite cache, the
connectivity signal) and calls it — the function itself is pure and unit
tested without any native dependency.

## Sampling & retention (policy decision, recorded here — no new infrastructure)

- **Crashes: 100% captured.** Every `reportError` call that reaches an
  initialized Crashlytics instance is recorded — crashes are rare enough,
  and important enough, that there is no sampling case for them.
- **Performance traces: 10% sampled by default** (`DEFAULT_PERFORMANCE_SAMPLE_RATE`
  in `config.ts`, override-able via the `PERFORMANCE_SAMPLE_RATE` build env /
  `extra.performanceSampleRate`). This is a **volume/noise control**, not a
  cost control (Performance Monitoring is not billed per trace — see "Cost
  ceilings"): at 100% of installs sending every trace, dashboards become
  noisy and harder to read long before any bill appears. 10% is a reasonable
  starting point for a pre-launch app with a small install base; revisit
  upward once real traffic volume is measured (MOB-019/MOB-021), since a
  small base under-samples rare slow paths.
- **Retention is Firebase's own default — nothing here enforces or extends
  it.** Crashlytics retains crash data for **90 days** and Performance
  Monitoring retains trace data for **90 days** under Firebase's standard
  retention policy, applied server-side by Firebase itself. This project
  does not need to build or operate anything to get this; it is recorded
  here as the policy this bead relies on, not a promise this codebase
  enforces. If a longer retention window is ever needed, that is a Firebase
  project/BigQuery-export configuration decision (`infra/`), not a mobile
  client change.

## Cost ceilings and kill switch (mirrors the repo's existing budget-capped posture)

Per `docs/mobile/security/threat-model.md` T9 and the project's
`operating-principle-runs-itself-within-reason` doctrine (also cited in
`docs/mobile/decisions/mobile-identity.md`'s spend-ceiling gate), every
automated system here gets a documented cap and an override — sized to the
actual risk, not copy-pasted from the server-side metered-service pattern.

- **Crashlytics and Performance Monitoring are free-tier / not billed per
  event in Firebase's actual pricing model** — confirmed against Firebase's
  published pricing (both are listed under the free "Spark"-tier-eligible
  products with no usage-based line item, unlike Firestore reads/writes,
  Cloud Storage egress, or a paid Maps API call). This means the "cost
  ceiling" concern that `infra/gcp/cost-controls/cost-controls-matrix.json`'s
  `dailyBudgets` array exists to bound (metered services that can run up a
  bill under abuse or a bug) is **much smaller** for these two specific
  products — there is no daily spend cap to define here the way there is for
  the geocoder or the model-token budget. This is a positive finding to
  record, not a gap: it is exactly why this bead does not add a new entry to
  `cost-controls-matrix.json`.
- **What we DO define, consistent with that same posture:** `observabilityEnabled`
  (`config.ts` / `app.config.ts extra.observabilityEnabled`) is a blunt kill
  switch, **defaulting to `true`**, override-able per build via the
  `OBSERVABILITY_ENABLED=false` env var without a code change. When `false`,
  `reportError`/`addBreadcrumb`/`startPerfTrace` become true no-ops (they
  never reach the native SDK; see `crash-reporter.ts`) and
  `initializeObservability` toggles `setCrashlyticsCollectionEnabled(false)`
  / `setPerformanceCollectionEnabled(false)` on the native SDKs themselves.
  This exists for: (a) Firebase's pricing model ever changing, (b) a runaway
  crash loop flooding the dashboard with duplicate reports, or (c) an
  operator simply wanting it off for a build — the same "kill switch exists
  per feature class" doctrine ADR-010/threat-model T9 already establishes for
  the mobile API surface, applied to this feature class too.
- **`performanceSampleRate`** (same config surface) is the volume control
  described above.

## Bundle/binary size baseline (MOB-018 item 8)

`../scripts/report-bundle-size.ts` (`pnpm --filter @repo/mobile bundle-size`)
runs `expo export` into a throwaway temp directory, measures the resulting
Hermes JS bundle and the total exported asset payload for a platform, and
prints the numbers (add `--record` to update `scripts/bundle-size-baseline.json`,
the recorded reference point). **Measured 2026-07-19, iOS, Expo SDK 56.0.16
(this bead's baseline, recorded in `scripts/bundle-size-baseline.json`):**

| Metric | Value |
|---|---|
| JS bundle (Hermes bytecode) | 3,413,393 bytes (3.26 MiB) |
| Total export payload (bundle + all bundled assets/fonts) | 17,019,894 bytes (16.23 MiB) |
| Asset count | 86 |

This is a real, measured number from running the script against this repo's
current `apps/mobile`, not an estimate. Wiring a CI check that **fails a PR**
on regression against this baseline is MOB-019's job (quality gates / CI) —
this bead only establishes the measurement mechanism and the current number.

## Known gaps / deferred to real-device or CI evidence

- **`runtimeVersion` resolution.** `expo-updates` (which resolves EAS Update's
  `runtimeVersion` policy to a concrete string via `Updates.runtimeVersion`
  at runtime) is not yet a dependency of this app — `eas.json` has no EAS
  Update channel wired yet either (MOB-019/ADR-023 territory). `report-context.ts`'s
  `resolveRuntimeVersion` falls back to the app version until that lands;
  tracked as a follow-up, not invented here.
- **Symbolication.** Crashlytics needs dSYM upload (iOS) / native debug
  symbols (Android) wired into the release build pipeline to turn a native
  crash's raw addresses into readable stack traces. The config plugins added
  here wire the build-phase scripts; actually producing and uploading real
  symbols requires a real EAS build (MOB-019/MOB-021), which this sandbox
  cannot produce.
- **Real crash reproduction / real device evidence.** Everything in this
  bead is proven with fake native-SDK doubles (`native-bridge.ts`'s guarded
  loaders return `null` in this environment, since the native packages have
  no native binary here) and a real, measured `expo export` bundle. Proving
  an actual native crash reaches the actual Firebase Crashlytics dashboard,
  and that Performance traces appear there, needs a real device + a real
  Firebase project connection — MOB-019/MOB-021 evidence, not obtainable in
  this sandbox.
- **Real cost/load evidence.** The "no per-event billing" claim above is
  based on Firebase's published pricing model, not a live billing-load test
  against the real `black-book-efaaf` project — there is nothing to load-test
  today since no native build has ever sent a real event.
