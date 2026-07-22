# Redacted response examples (MOB-004 evidence)

Machine-checkable sample payloads proving the public `/v1` wire shape carries only
already-redacted public projections. Each JSON file is validated in CI against the matching
`@repo/public-contracts` zod schema and scanned for forbidden internal/ranking/precise-geo keys.

| File | Route | Schema |
|------|-------|--------|
| `health-200.json` | `GET /v1/health` | surface health (see `@repo/config`) |
| `compatibility-200.json` | `GET /v1/compatibility` | `compatibilityCheck` shape |
| `bootstrap-200.json` | `GET /v1/bootstrap` | `bootstrapResponseV1Schema` |
| `entity-200.json` | `GET /v1/entity/:id` | `entityV1Schema` |
| `search-200.json` | `GET /v1/search` | `searchResponseV1Schema` |
| `error-not-found-404.json` | any missing resource | `publicApiErrorEnvelopeSchema` |
| `error-rate-limited-429.json` | quota exceeded | `publicApiErrorEnvelopeSchema` |
| `error-client-version-426.json` | below floor | `publicApiErrorEnvelopeSchema` |

OpenAPI cross-reference: `../openapi/public-v1.openapi.yaml`.
