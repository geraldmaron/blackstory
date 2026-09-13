<!--
  Operator runbook: mirror GCS public-media into Supabase Storage, dual-serve,
  then flip writers. Does not authorize deleting GCS or Firebase.
-->

# Supabase Storage cutover

> **Historical cutover note.** Current media path (2026-08-28): Supabase Storage on
> `blackstory-app` (`https://twykhihqkcldpreuovay.supabase.co`). Live CSP still allows leftover
> GCS (`storage.googleapis.com`). Public web is on Vercel. The "App Hosting stays on Firebase"
> line below is leftover and superseded.

**Status:** Public-media copy complete (2026-07-21); raw-sources copy complete for 3 of 4 rows
(2026-09-12, see ST5/repo-ks7t, repo-t4bw); the 4th (Opportunity Atlas, 2.47GB) is resolved as
re-cite, not migrate (2026-09-12 owner ruling, repo-7w972) — see the raw-sources bullet below;
hosting sentence below is leftover
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
3. **Done for 3 of 4, 2026-09-12.** raw-sources must be copied into Supabase before GCS is
   decommissioned — GCS is a temporary dual-serve staging copy, not an approved permanent home,
   per the project's single-system-of-record direction. Verified against live
   `bb_evidence.source_captures` (69 total rows): exactly **4** rows carried a
   `storage_object.uri` pointing at `gs://black-book-efaaf-raw-sources`. (repo-t4bw's original
   "~14 rows" estimate conflated this with 10 other rows that have no storage reference at all —
   either empty or a text-only provenance note — and need no migration.)

   The capture-backfill lane (`operator-cli capture-backfill`) turned out not to fit this job —
   it discovers and captures *new* cited URLs across entity/packet/article claims and always
   inserts a fresh row; it has no path to rewrite an *existing* row's `storage_object`. The actual
   fix was a direct blob copy, mirroring the public-media script:
   [`scripts/copy-gcs-raw-sources-to-supabase.mjs`](../../scripts/copy-gcs-raw-sources-to-supabase.mjs)
   (dry-run by default; verifies each object's sha256 against its own `content_hash_digest` before
   upload). `item_mapping_inequality_holc`, `item_fbi_ucr_hate_crime`, and
   `item_fbi_ucr_participation` are migrated and verified live in `raw-sources/captures/`.
   `item_opportunity_atlas_tract_outcomes` (2.47GB — genuinely that large: the Opportunity Atlas
   tract-outcomes file, 7,897 columns × ~73k US census tracts) is ~5x the bucket's 500MB
   `file_size_limit` and was deliberately not force-migrated. **Resolved 2026-09-12 (owner ruling,
   repo-7w972): re-cite, don't host.** BlackStory keeps no owned copy of this file at all — raising
   the Supabase limit and keeping the GCS dependency alive were both explicitly rejected (ongoing
   storage cost / a wound-down platform kept alive for one file). `bb_evidence.source_captures`
   row `cap_opportunity_atlas_tract_outcomes_ec4d9ee5` now carries `snapshot_mode = 'none'` and a
   null `storage_object` — it cites the public Opportunity Insights artifact
   (`https://opportunityinsightsstatic.s3.us-east-1.amazonaws.com/assets/tract_outcomes_early.csv`,
   also `bb_evidence.source_items.url` for `item_opportunity_atlas_tract_outcomes`) instead of a
   mirrored blob. The file's sha256 and a header-row/column-count fingerprint are recorded in
   `packages/domain/src/external-data-sources.ts` (`checksumSha256` / `schemaSnapshot` on
   `opportunity-atlas-tract-outcomes`) so a silent upstream change is still detectable without
   downloading the 2.47GB body. The derived rows actually used by the product (72,014 tracts × 11
   outcome fields, not the raw 7,897-column file) already live in
   `bb_reference.opportunity_atlas_tracts` and are unaffected. **Operator action required:** delete
   `gs://black-book-efaaf-raw-sources/raw-sources/opportunity-atlas/tract_outcomes_early-2018/tract_outcomes_early.csv`
   from Cloud Storage — nothing in the product reads it anymore, and it no longer blocks the
   Firebase/GCP decommission. No other ingested dataset (census, ACS, NRHP) currently has any GCS
   raw-source archive reference in this table.
4. Wind-down GCS only after export + dual verification ([firebase-wind-down.md](./firebase-wind-down.md))

## Out of scope

- **Leftover / superseded (2026-07-21 owner note):** "App Hosting stays on Firebase." Public web
  hard-cut to Vercel on 2026-07-22. Do not treat that sentence as current hosting.
- Deleting GCS / Firebase project
