<!--
  Operator runbook: mirror GCS public-media into Supabase Storage, dual-serve,
  then flip writers. Does not authorize deleting GCS or Firebase.
-->

# Supabase Storage cutover

**Status:** Buckets live; byte copy gated on service role  
**ADR:** [ADR-020](../adr/ADR-020-supabase-postgres-system-of-record.md) (amended)  
**Buckets:** `public-media` (public), `raw-sources` (private)

## Done

1. Storage buckets + RLS policies applied on `blackstory-app`
2. PostgREST `published_*` views + `bb_reference.jurisdictions.location` applied
3. URL helpers in `@repo/domain` (`supabasePublicMediaUrl` / `gcsPublicMediaUrl`)
4. Web CSP allows both `storage.googleapis.com` and the project Supabase host
5. Copy script: [`scripts/copy-gcs-public-media-to-supabase.mjs`](../../scripts/copy-gcs-public-media-to-supabase.mjs)

## Live public-media copy (owner)

```bash
# Dry-run
node scripts/copy-gcs-public-media-to-supabase.mjs

# Live (~461 MiB, ~480 objects) — requires service_role; GCS untouched
export SUPABASE_URL=https://twykhihqkcldpreuovay.supabase.co
export SUPABASE_SERVICE_ROLE_KEY='…'   # Dashboard → Project Settings → API
export SUPABASE_STORAGE_COPY=1
node scripts/copy-gcs-public-media-to-supabase.mjs
```

Prefer storing the key in 1Password and injecting via `run-with-dev-secrets` rather than shell history.

## After copy

1. Spot-check a public URL:
   `https://twykhihqkcldpreuovay.supabase.co/storage/v1/object/public/public-media/public/entities/<id>/primary.jpg`
2. Soak with dual-serve (GCS URLs still valid in projections)
3. New release / writer flip to Supabase URLs; update collage hardcodes when ready
4. Optional phase 2: raw-sources → private bucket + rewrite `storage_object` refs
5. Wind-down GCS only after export + dual verification ([firebase-wind-down.md](./firebase-wind-down.md))

## Out of scope

- Hosting Next.js on Supabase (use Vercel or Cloud Run to leave Firebase App Hosting)
- Deleting GCS / Firebase project
