<!--
  Operator runbook: mirror GCS public-media into Supabase Storage, dual-serve,
  then flip writers. Does not authorize deleting GCS or Firebase.
-->

# Supabase Storage cutover

**Status:** Public-media copy complete (2026-07-21); raw-sources optional  
**ADR:** [ADR-020](../adr/ADR-020-supabase-postgres-system-of-record.md) (amended)  
**Buckets:** `public-media` (public), `raw-sources` (private)

## Done

1. Storage buckets + RLS policies applied on `blackstory-app`
2. PostgREST `published_*` views + `bb_reference.jurisdictions.location` applied
3. URL helpers in `@repo/domain` (`supabasePublicMediaUrl` / `gcsPublicMediaUrl`)
4. Web CSP allows both `storage.googleapis.com` and the project Supabase host
5. Copy script: [`scripts/copy-gcs-public-media-to-supabase.mjs`](../../scripts/copy-gcs-public-media-to-supabase.mjs)

## Public-media copy

Completed 2026-07-21: GCS `black-book-efaaf-public-media/public/` mirrored into Supabase bucket `public-media` (same object keys). GCS left untouched for dual-serve/rollback.

Re-run / repair (service role preferred; anon only with temporary upload policy):

```bash
node scripts/copy-gcs-public-media-to-supabase.mjs   # dry-run
SUPABASE_STORAGE_COPY=1 SUPABASE_SERVICE_ROLE_KEY=… node scripts/copy-gcs-public-media-to-supabase.mjs
```

## After copy

1. Spot-check a public URL:
   `https://twykhihqkcldpreuovay.supabase.co/storage/v1/object/public/public-media/public/entities/<id>/primary.jpg`
2. **Done (2026-07-21):** writers (`entityPrimaryImageObjectRef` / `publicMediaObjectUrl`) emit Supabase URLs; collage `sourceUrl`s + manifest updated; live `release_entities.primary_image.url` rewritten (76 rows)
3. Optional: raw-sources stay on GCS (research archives; not required for public app)
4. Wind-down GCS only after export + dual verification ([firebase-wind-down.md](./firebase-wind-down.md))

## Out of scope

- **App Hosting stays on Firebase** (owner decision 2026-07-21) — do not migrate `apps/web` to Vercel/Cloud Run as part of storage or Postgres cutover
- Deleting GCS / Firebase project
