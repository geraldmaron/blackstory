<!--
  Operator runbook: mirror GCS public-media into Supabase Storage, dual-serve,
  then flip writers. Does not authorize deleting GCS or Firebase.
-->

# Supabase Storage cutover

> **Historical cutover note.** Current media path (2026-08-28): Supabase Storage on
> `blackstory-app` (`https://twykhihqkcldpreuovay.supabase.co`). Live CSP still allows leftover
> GCS (`storage.googleapis.com`). Public web is on Vercel. The "App Hosting stays on Firebase"
> line below is leftover and superseded.

**Status:** Public-media copy complete (2026-07-21); raw-sources copy required before GCS
decommission, not yet run (4 rows identified, see ST5/repo-ks7t, repo-t4bw); hosting sentence
below is leftover  
**ADR:** ADR-020 (amended) (`docs/adr/` purged 2026-07-24; restated in
[decisions-carryover.md](../decisions-carryover.md))  
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
   Listing via Storage API is not public (anon SELECT listing removed); known
   object paths still fetch with `public=true`.
2. **Done (2026-07-21):** writers (`entityPrimaryImageObjectRef` / `publicMediaObjectUrl`) emit Supabase URLs; collage `sourceUrl`s + manifest updated; live `release_entities.primary_image.url` rewritten (76 rows)
3. **Required, not optional:** raw-sources must be copied into Supabase before GCS is
   decommissioned — GCS is a temporary dual-serve staging copy, not an approved permanent home,
   per the project's single-system-of-record direction. Verified 2026-09-12 against live
   `bb_evidence.source_captures` (69 total rows): exactly **4** rows carry a
   `storage_object.uri` pointing at `gs://black-book-efaaf-raw-sources` and need migrating —
   `item_opportunity_atlas_tract_outcomes`, `item_mapping_inequality_holc`,
   `item_fbi_ucr_hate_crime`, `item_fbi_ucr_participation`. (repo-t4bw's original "~14 rows"
   estimate conflated this with 10 other rows that have no storage reference at all — either
   empty or a text-only provenance note — and need no migration.) All 4 are re-derivable from
   stable public government/institutional URLs, so the safest remediation is
   re-capturing them via the capture-backfill lane (dedup-safe on content hash) rather than a
   manual GCS→Supabase blob copy. Neither blocks the live public app. No other ingested dataset
   (census, ACS, NRHP) currently has any GCS raw-source archive reference in this table.
4. Wind-down GCS only after export + dual verification ([firebase-wind-down.md](./firebase-wind-down.md))

## Out of scope

- **Leftover / superseded (2026-07-21 owner note):** "App Hosting stays on Firebase." Public web
  hard-cut to Vercel on 2026-07-22. Do not treat that sentence as current hosting.
- Deleting GCS / Firebase project
