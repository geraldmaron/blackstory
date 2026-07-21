# `apps/mobile/src/observability` — privacy-safe dev-console reporting (MOB-018)

Client-side observability for the native reader: crash reporting, performance
tracing, and the release/build metadata that ties a report to an exact build.
**This is diagnostic tooling, not analytics** — see "Not analytics" below.

## Sink: dev-console only (no Firebase)

There is no third-party crash SDK linked. `reportError`, `addBreadcrumb`, and
`startPerfTrace`/`reportPerf` (`crash-reporter.ts`) are the **only** sanctioned
path from app code to observability output. In `__DEV__` only, redacted payloads
go to `console.error` / `console.debug`. Production builds emit nothing from
this layer unless a future remote sink is added deliberately.

## Redaction is mandatory, not optional

Every context payload is piped through `src/security/log-redaction.ts` — MOB-010's
existing, tested utility, not a reimplementation — before it can be emitted.
`no-raw-sdk-imports.test.ts` statically scans the whole `apps/mobile/src` tree
so no Firebase or ad/analytics SDK is introduced.

## Not analytics

This layer captures **diagnostic-only** signals: error messages, named
performance traces, and build metadata. It is not a user-behavior analytics
product. This app adds **no** general analytics SDK, ad SDK, or attribution SDK.
`PRIVACY.md` records the same distinction for the SDK inventory.

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

## Sampling & retention

- **Crashes in dev:** every `reportError` call that reaches the dev-console
  sink is logged — crashes are rare enough that volume is not a concern locally.
- **Perf traces:** sampled at 10% by default (`config.ts` /
  `performanceSampleRate` in `app.config.ts` `extra`). An unsampled trace is a
  true no-op — it never touches the console.
- **Kill switch:** `observabilityEnabled` in `extra` (default `true`) disables
  all emission without a code change.

## Bootstrap wiring

`initializeObservability(store, connectivity)` in `bootstrap.ts` resolves config
from `Constants.expoConfig.extra`, assembles the report context from on-device
cache diagnostics + connectivity, and activates the reporter. It never throws —
same contract as the security bootstrap. `AppProviders.tsx` calls it once on
cold start.

## What this bead does NOT do

- No remote crash aggregation (Crashlytics/Sentry/etc.) — dev console only.
- No session replay, no user-behavior funnels, no ad attribution.
- No wiring into CI beyond the static import guard in
  `no-raw-sdk-imports.test.ts`.
