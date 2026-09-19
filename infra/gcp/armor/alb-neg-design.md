# Global external ALB and serverless NEG design (BB-023)

**Status:** Optional design stub — not applied or evidence of a live GCP deployment.
**Current boundary:** `api-public` is a Vercel function and the public web is Cloudflare-fronted; `api-submissions` and `api-internal` require separate deployment verification. See [`packages/config/src/surfaces.ts`](../../../packages/config/src/surfaces.ts) for the typed capability contract.
**Project:** `black-book-efaaf` · **Region:** `us-central1`

## Topology

```text
Internet
   │
   ▼
Global external HTTP(S) LB  (black-book-public-api-lb)
   ├── URL map: api.blackbook.app      → backend black-book-api-public-backend
   └── URL map: submit.blackbook.app   → backend black-book-api-submissions-backend
           │
           ├── Cloud Armor policy (per backend)
           ├── Cloud CDN (api-public read paths only)
           └── Serverless NEG → Cloud Run (internal-and-cloud-load-balancing)
```

If this design is ever provisioned, public APIs should not accept direct `*.run.app` traffic. Cloud Run ingress would be `internal-and-cloud-load-balancing` so only the load balancer (and authorized VPC paths) can reach the revision. None of those GCP controls is established by this repository.

## Load balancer (global external managed)

| Field | Value |
|-------|-------|
| Name | `black-book-public-api-lb` |
| Scheme | `EXTERNAL_MANAGED` |
| Scope | Global |
| Protocol | HTTPS (HTTP→HTTPS redirect enabled) |
| SSL policy | `black-book-modern-tls` (TLS 1.2+, modern cipher suite) |
| Certificate map | `black-book-api-cert-map` (Certificate Manager) |

### URL maps / host rules

| Hostname | Backend service | Surface |
|----------|-----------------|---------|
| `api.blackbook.app` | `black-book-api-public-backend` | `api-public` |
| `submit.blackbook.app` | `black-book-api-submissions-backend` | `api-submissions` |

Replace hostnames with production DNS before apply. Keep host-based separation so
submissions traffic can carry stricter Armor rules without affecting read caching.

## Serverless NEGs

Serverless NEGs bind each backend service to a Cloud Run service in `us-central1`.

| NEG | Cloud Run service | Notes |
|-----|-------------------|-------|
| `black-book-api-public-neg` | `black-book-api-public` | Read/search/geo API |
| `black-book-api-submissions-neg` | `black-book-api-submissions` | Intake only; no CDN |

### Cloud Run ingress (proposed)

Deploy both public APIs with:

```bash
gcloud run services update black-book-api-public \
  --ingress=internal-and-cloud-load-balancing \
  --region=us-central1 \
  --project=black-book-efaaf

gcloud run services update black-book-api-submissions \
  --ingress=internal-and-cloud-load-balancing \
  --region=us-central1 \
  --project=black-book-efaaf
```

**Negative test (future acceptance if provisioned):** `curl https://black-book-api-public-xxxxx-uc.a.run.app/health`
must fail (403/404) from the public internet after ingress is applied.

Do not infer this ingress posture for the current Vercel or node-service deployments from this optional design.

## Backend service wiring

If provisioned, each backend service would attach:

1. **Serverless NEG** (single region `us-central1`)
2. **Cloud Armor security policy** — see `policies/api-*-policy.json`
3. **Cloud CDN** — enabled only on `api-public` (see [`cdn-design.md`](./cdn-design.md))
4. **Logging** — `sampleRate=1.0` during initial rollout; reduce after baseline (BB-034)

## Human apply order (summary)

1. Create Cloud Armor policies from `policies/*.json`.
2. Create serverless NEGs for both Cloud Run services.
3. Create backend services with NEG + Armor (+ CDN on public).
4. Create URL map, target HTTPS proxy, forwarding rule (global).
5. Map DNS `A/AAAA` to the LB anycast IP.
6. Update Cloud Run ingress to `internal-and-cloud-load-balancing`.
7. Verify LB health and direct `run.app` negative test.

Full conditional security narrative: [`../../../docs/security/ingress-armor.md`](../../../docs/security/ingress-armor.md).
