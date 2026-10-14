-- Corrections receipt-code lookup needs a durable, privacy-safe index (repo-vl155.1: the public
-- corrections/appeal/abuse-report forms never persisted to Postgres at all, so this migration is
-- part of giving them a real write path).
--
-- Receipt codes are opaque, one-way-derived tokens (see
-- apps/web/src/app/corrections/receipt-code.ts) -- this stores only a SEPARATE one-way digest of
-- the code, never the code itself, so a row here still cannot be used to reconstruct or enumerate
-- anyone's receipt code. digestReceiptCode() in that same file computes the value written here.
--
-- NOTE (repo-vl155.6): this repo's other supabase/migrations/*.sql files say `bb_submissions`
-- throughout (e.g. 20260720220008_publication_public.sql creates `bb_submissions.intake_items`),
-- but the LIVE schema is named `submissions` -- no `bb_` prefix, confirmed 2026-09-21/22 via
-- information_schema.schemata against the blackstory-app Supabase project. The application code
-- already reads/writes `submissions.intake_items` (apps/web/src/admin/lib/postgres-submissions.ts)
-- and is correct; it is the migration *files* that have drifted from what was actually applied.
-- This migration targets the schema that actually exists, not the one the older files describe.
alter table submissions.intake_items
  add column if not exists receipt_digest text;

create unique index if not exists intake_items_receipt_digest_idx
  on submissions.intake_items (receipt_digest)
  where receipt_digest is not null;
