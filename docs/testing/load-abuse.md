# Load and abuse testing

Repo-side simulations for load, abuse, and cost scenarios. **No live attacks** against production or staging endpoints.

## Run

```bash
pnpm --filter @repo/testing test:security
# or full layer:
node --import tsx scripts/run-testing-layer.mjs security
```

Module: `packages/testing/src/load-abuse/`

## Scenarios

| ID | Abuse pattern | Primary controls |
|----|---------------|------------------|
| `high_volume_static` | Entity read flood |  rolling window; search App Check separate |
| `search_flood` | Rapid search queries | App Check, token bucket, rolling window |
| `cache_busting` | Query normalization variants |  cache key collapse |
| `geocoder_abuse` | Geocode budget burn |  daily budget +  geocoding quotas |
| `submission_spam` | Spam + burst submissions |  validation/spam + corrections rate limit |
| `slow_clients` | Concurrency slot hold |  maxConcurrency |
| `oversized_payloads` | Long query / fat body |  length caps,  maxBytes |
| `distributed_low_rate` | Many low-rate IPs |  risk aggregation |
| `database_connection_exhaustion` | Pool exhaustion (simulated) |  `evaluateDatabaseAcquire` |
| `queue_retry_storms` | Retry amplification |  queue dispatch + retry budget |
| `expensive_filter_combinations` | Max filters + geo |  estimated cost / shape limits |
| `scraping_patterns` | Deep pagination + harvest |  depth cap + entity daily cap |

## Layered controls

Tests assert **≥2 independent layers** fire for most scenarios and that **rate-limit and resource-control families** both participate in several paths. Public serving stays allowed under research budget hard-stop (`assertPublicServingUnderBudgetPressure`).

## Cost model

`estimateScenarioCosts()` documents relative cost units per abusive request (not live billing). Denied requests score **0** marginal units in harness runs.

## Tuning

`loadAbuseTuningRecommendations()` returns operator-facing rows (P0–P2). Review after beta soak; do not auto-apply from CI.

## Parent wiring

- Export barrel: `packages/testing/src/load-abuse/index.ts`
- Package root barrel: add `export * from './load-abuse/index.js'` in `packages/testing/src/index.ts`
- Security test layer: `scripts/run-testing-layer.mjs` includes `load-abuse/**/*.test.ts`
- Dependency: `@repo/security` devDependency on `@repo/testing`
