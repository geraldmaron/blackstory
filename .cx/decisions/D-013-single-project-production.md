# D-013 — Single-project production

Use the existing live Firebase/GCP project `black-book-efaaf` (project `332234323945`, Hosting
`black-book-efaaf.web.app`) as the one production project. Do not create the four BB-005 target
projects now.

Preserve isolation through per-surface SAs, four bucket boundaries with UBLA/PAP, per-secret IAM,
private ingress, distinct Postgres roles, quotas, and kill switches. Local development uses
`demo-black-book`; staging/research names in the same project are configuration scopes, not project
security boundaries.

Re-split when cloud non-production requires production-like data/destructive testing, research risk
or cost exceeds lower-layer containment, or compliance/billing/incident/recovery requires
independent project boundaries.

Formal: `docs/security/environment-isolation.md`  
Addenda: ADR-005 and ADR-009  
Provisioning: BB-010 (WIF), BB-011 (Firebase/IAM/buckets), BB-012/013 (Cloud SQL/roles).
