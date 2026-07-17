# IAM boundaries in `black-book-efaaf` (BB-005)

> Designed, not yet verified as applied. One production project means least privilege at the SA,
> resource, secret, database, and network layers is load-bearing.

## Project-level policy

- Reject Owner/Editor and project-wide Storage Admin/Viewer for runtime SAs.
- Disable service-account key creation where organization policy authority permits.
- Use WIF for `github-deploy`; never export keys. Design: [`wif/`](./wif/) (BB-010; not applied).
- Restrict resource locations and Cloud SQL public IP where supported.
- Grant Secret Manager access on individual secrets only.
- Keep human production access exceptional, time-boxed, approved, and audited.

Public Access Prevention cannot be both enforced at the project level and exempted for a directly
public bucket. BB-011 must choose and verify one design: enforce PAP everywhere and serve
public-media through a private CDN/origin path, or document the narrow public-media exception while
enforcing PAP on every private bucket.

## Workload denials

| Identity | Required negative permissions |
|----------|-------------------------------|
| `web-runtime`, `api-public` | no private-evidence/quarantine IAM; no canonical write; no publish |
| `api-submissions` | no object read, evidence, canonical write, publish, deploy, or impersonation |
| `research` | no public-media write, public projection/release write, deploy, or impersonation |
| `publication` | no raw-evidence write; no public ingress |
| `security` | no publish/release activation |
| `migrations` | no long-running runtime attachment or publication |
| `github-deploy` | no key; no trust from forks, PRs, or unprotected contexts |

## Environment reality

There is no dev-to-prod project boundary. Local development uses `demo-black-book` emulators and
local PostGIS. Any principal able to call `black-book-efaaf` has production access. An optional
staging backend in the same project is configuration separation only.

## Research cannot publish

`research@black-book-efaaf.iam.gserviceaccount.com` is distinct from `publication` and
`api-internal`. Bucket IAM denies public-media writes; BB-012/013 maps it to `role_research`, which
cannot write projections or activate releases. Do not grant project-level storage or database
administrative roles that bypass these denials.

## Cross-project access

Current allowlist: **empty**. All designed GCP resources are in `black-book-efaaf`. GitHub WIF is an
external identity trust relationship, not a cross-project grant; declarative stubs live in
[`wif/`](./wif/) (BB-010; not applied until remote + numeric IDs + human review).

The former production-to-research evidence grant is deferred with the four-project migration. Any
future cross-project grant requires matrix, ADR, threat-model, and Terraform updates.

## Deny checklist

- [ ] A runtime has a broad project role.
- [ ] Research can write public media, projections, or release pointers.
- [ ] Public runtimes can read private evidence or quarantine.
- [ ] A private bucket allows `allUsers` / `allAuthenticatedUsers`.
- [ ] Submissions can read evidence or publish.
- [ ] A service-account key exists.
- [ ] Staging is represented as an independent security boundary.
