# Supabase

Supabase Postgres is the product system of record. Auth uses trusted `app_metadata.app_role`;
user-editable metadata cannot grant staff permissions. Private writes use a scoped server-side
Postgres connection. Public clients read approved projections only.

Migrations in `migrations/` are the database authority. The responsibility-schema cutover must
be deployed together with its application and Auth metadata changes. Applied migration history
must be reconciled against the target project before remote deployment. A fresh local reset
proves migration syntax and local behavior, not production history or a safe live cutover.

Use an isolated local project for schema rehearsal and `tests/research-kernel.sql` for ledger
and authorization checks. Do not print `supabase status` keys or credentials into logs.

Public media uses the `public-media` bucket. Research captures use a private bucket; storage
permission and public archival permission are separate decisions. Extracted text is not a raw
page archive. See [storage](../docs/data/supabase-storage-cutover.md) and
[research operations](../docs/research/research-operations.md).

Dashboard logs cover service requests. The durable product audit is `audit.events`; direct
Postgres research operations need not appear in PostgREST request logs. Remote infrastructure
changes require a reviewed deployment plan. No Firebase or Firestore migration tooling remains.
