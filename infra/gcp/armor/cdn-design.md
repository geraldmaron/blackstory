# Cloud CDN design for cacheable API responses (BB-023)

**Status:** Design stub — CDN enabled on `api-public` only.

## Rationale

Read-heavy `api-public` endpoints (search, entity summaries, geo-bounded location lists)
serve **released public projections** that change only on publication events. Edge caching
reduces origin load during volumetric read abuse (T-01, T-19) and improves latency for
anonymous users.

`api-submissions` remains **CDN-disabled** — all intake traffic must reach origin for
App Check, rate limits, and quarantine writes.

## Backend configuration

| Setting | `api-public` | `api-submissions` |
|---------|--------------|-------------------|
| CDN enabled | yes | no |
| Cache mode | `CACHE_ALL_STATIC` | n/a |
| Default TTL | 300s | n/a |
| Max TTL | 3600s | n/a |
| Negative caching | off | n/a |

Source: [`ingress-matrix.json`](./ingress-matrix.json) → `backends[].cdn`.

## Cacheable paths

| Path pattern | Cache key notes |
|--------------|-----------------|
| `/v1/search` | Include normalized query params; strip cache-busting noise (BB-025) |
| `/v1/entities/*` | Key on path + `release` query param when present |
| `/v1/locations/nearby` | Key on geohash prefix + radius + release |
| `/health` | Short TTL; used for LB health checks only |

## Bypass / do-not-cache

Requests carrying these headers bypass CDN and hit origin:

- `Authorization`
- `X-Black-Book-App-Check` (when BB-024 enforcement is on)

`POST`, `PUT`, `PATCH`, `DELETE` are never cached (submissions surface has CDN off entirely).

## Invalidation

Publication events (BB-019) should trigger targeted CDN invalidation for affected entity
and search paths. Until automation exists (BB-062), document manual invalidation:

```bash
gcloud compute url-maps invalidate-cdn-cache black-book-public-api-lb \
  --path="/v1/entities/ENTITY_ID" \
  --project=black-book-efaaf
```

Prefer path-level invalidation over full-map flush to avoid origin stampedes.

## Acceptance checks (stub)

| Check | Method |
|-------|--------|
| Cache HIT on repeat search | `curl -I` twice; second response includes `Age` / `X-Cache-Status: HIT` |
| Cache-bust param ignored for static snapshot | See [`load-test-plan.md`](./load-test-plan.md) § cdn-cache-bust |
| Submissions never cached | `curl -I https://submit.blackbook.app/v1/submissions` → `Cache-Control: private` or miss |

## Related

- Rate limits at edge: `policies/api-public-policy.json`
- Abuse case AC-02: [`../../docs/security/abuse-cases.md`](../../docs/security/abuse-cases.md)
