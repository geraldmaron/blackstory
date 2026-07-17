# D-012 — Environment and project isolation (BB-005)

BB-005 delivered the isolation model, now reconciled by D-013 to one live production project:
`black-book-efaaf`. One least-privilege SA per surface, distinct public-media/private-evidence/
exports/quarantine buckets, and later Postgres roles preserve workload boundaries. Research cannot
publish; quarantine is never public; submissions cannot reach canonical/publication.

Formal: `docs/security/environment-isolation.md`  
Matrices / IaC stubs: `infra/gcp/` (single-project, **not applied**). The former four-project design
is a deferred migration target, not live infrastructure. App Hosting stubs:
`apps/web/apphosting*.yaml`.  
Provisioning: BB-010 (WIF), BB-011 (Firebase), BB-012 (Cloud SQL).
