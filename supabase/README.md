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
# Do NOT apply migrations to remote without explicit approval.
# Do NOT drop Firestore until cutover is approved.
