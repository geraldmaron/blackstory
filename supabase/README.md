# Supabase local/CLI notes for BlackStory (ADR-020)
#
# Project: blackstory-app (twykhihqkcldpreuovay)
# URL: https://twykhihqkcldpreuovay.supabase.co
#
# Auth: Supabase Auth with bb_role in app_metadata only.
# Migrations: supabase/migrations/ — review before remote apply.
#
# Link (once):
#   supabase link --project-ref twykhihqkcldpreuovay
#
# Access token (1Password):
#   SUPABASE_ACCESS_TOKEN=op://Private/Supabase/credential
#
# Firestore → Postgres ETL (idempotent; no traffic cutover):
#   packages/migrate-firestore-postgres/README.md
#   Direct DATABASE_URL required for private bb_* writes (PostgREST only exposes
#   public / bb_public / bb_submissions). Use op:// item id refs (colons in titles break op run).
#
# Browse data in Dashboard (Table Editor defaults to empty `public`):
#   1. Open https://supabase.com/dashboard/project/twykhihqkcldpreuovay/editor
#   2. Schema dropdown (top of left sidebar, usually shows "public") → pick bb_public
#   3. Open release_entities / search_index (migrated map rows live here)
#   Other product schemas: bb_research, bb_ops, bb_reference, bb_audit, bb_evidence,
#   bb_canonical, bb_publication, bb_submissions. SQL Editor also works with
#   fully-qualified names (e.g. SELECT count(*) FROM bb_public.release_entities).
#
# Observability (MCP get_logs vs product activity):
#   - Dashboard / MCP logs cover HTTP edges: api (PostgREST/Kong), auth, storage,
#     postgres (server log), edge-functions, realtime. Retention is short (~24h).
#   - Empty get_logs for a service usually means no recent traffic on that edge,
#     not that the database is idle. Auth often looks empty when there are no
#     sign-ins; research/admin writes still show under postgres when they hit SQL.
#   - bb_audit.events and most private bb_* writes go through direct Postgres
#     (DATABASE_URL / pooler) via packages/data-access path-write — they do not
#     appear as PostgREST/api log lines. Use SQL on bb_audit.events (or Dashboard
#     SQL Editor) for product audit trail; use get_logs for edge/HTTP debugging.
#   - Prefer: get_logs service=postgres|api|storage for infra; execute_sql on
#     bb_audit.events for research_case / promotion activity.
#
# Storage public-media:
#   Bucket stays public=true for /object/public/public-media/... URLs.
#   Broad anon SELECT listing was removed (tighten_public_media_listing); staff
#   roles still SELECT for ops/upsert. Public object fetch does not need listing.
#
# Do NOT apply migrations to remote without explicit approval.
# Do NOT drop Firestore until cutover is approved.
