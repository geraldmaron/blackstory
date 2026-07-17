# Project and configuration-scope matrix (BB-005)

Derived from [`isolation-matrix.json`](./isolation-matrix.json).

## Current project

| Project ID | Number | Tier | Verified live surface |
|------------|--------|------|-----------------------|
| `black-book-efaaf` | `332234323945` | production | Firebase Hosting site `black-book-efaaf.web.app` |

`black-book-efaaf` is the only cloud project and is production. Firebase apps, App Hosting backends,
SAs, buckets, and IAM in this design are not live until BB-011 inventory/provisioning verifies them.

## Configuration scopes inside the project

| Scope | Project | Live | Meaning | Isolation strength |
|-------|---------|------|---------|--------------------|
| Local development | `demo-black-book` emulator ID | yes, local only | Synthetic fixtures; no cloud access | Process/local data isolation |
| Staging | `black-book-efaaf` | no | Optional `black-book-web-staging` backend and prefixed config | Naming/config only |
| Production | `black-book-efaaf` | project/site only | Public serving and all production workloads | Per-SA, bucket, DB role, network |
| Production research | `black-book-efaaf` | no | Research-prefixed jobs/config and private-evidence | Per-SA, bucket, DB role, quota/kill switch |

Staging and research are not separate IAM, billing, quota, org-policy, or recovery boundaries. Any
cloud access to this project is production access.

## Deferred target

The original `blackbook-dev`, `blackbook-staging`, `blackbook-prod`, and
`blackbook-research-prod` topology remains a migration target, not current infrastructure. Re-split
when cloud development needs production-like data/destructive tests, research blast radius exceeds
lower-layer controls, or independent compliance/billing/recovery boundaries are required.

See [`../../docs/security/environment-isolation.md`](../../docs/security/environment-isolation.md)
for migration order and BB-011 actions.
