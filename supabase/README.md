# Supabase

Supabase Postgres is the product system of record. Auth uses trusted `app_metadata.app_role`;
user-editable metadata cannot grant staff permissions. Private writes use a scoped server-side
Postgres connection. Public clients read approved projections only.

Migrations in `migrations/` are the database authority. The responsibility-schema cutover must
be deployed together with its application and Auth metadata changes. Applied migration history
must be reconciled against the target project before remote deployment. A fresh local reset
proves migration syntax and local behavior, not production history or a safe live cutover.

**The migration files' own text can lie about current schema names.** Confirmed 2026-09-22
(repo-vl155.6): every migration file still says `bb_submissions`, `bb_canonical`, `bb_auth`, etc.,
but the live blackstory-app project has no `bb_`-prefixed schemas at all — the real, live names
have no prefix (`submissions`, `canonical`, `access_control`, ...), matching what the application
code already reads and writes. Before writing SQL against any schema name you found by reading an
existing migration file, verify it against the live project first (`information_schema.schemata`,
or `list_tables`/`execute_sql` via the Supabase MCP) — do not trust the file's text alone.

Use an isolated local project for schema rehearsal and `tests/research-kernel.sql` for ledger
and authorization checks. Do not print `supabase status` keys or credentials into logs.

Public media uses the `public-media` bucket. Research captures use a private bucket; storage
permission and public archival permission are separate decisions. Extracted text is not a raw
page archive. See [storage](../docs/data/supabase-storage-cutover.md) and
[research operations](../docs/research/research-operations.md).

Dashboard logs cover service requests. The durable product audit is `audit.events`; direct
Postgres research operations need not appear in PostgREST request logs. Remote infrastructure
changes require a reviewed deployment plan. No Firebase or Firestore migration tooling remains.
