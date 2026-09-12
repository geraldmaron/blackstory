#!/usr/bin/env node
/**
 * Copy the last legacy GCS raw-source blobs into Supabase Storage's private `raw-sources`
 * bucket, so bb_evidence.source_captures.storage_object stops pointing at the wound-down
 * Firebase/GCP project (repo-ks7t / repo-t4bw).
 *
 * This is a precisely-scoped one-time migration, not a general tool: the manifest below is the
 * exact 4 rows a live query against bb_evidence.source_captures found still carrying a
 * gs://black-book-efaaf-raw-sources ref (verified 2026-09-12; every other row in that table has
 * no storage_object reference to migrate at all). One entry — the Opportunity Atlas tract-level
 * CSV — is ~2.47 GiB, over the raw-sources bucket's configured file_size_limit (500 MiB), and is
 * deliberately SKIPPED here rather than silently failing; see repo-ks7t.1 for that decision.
 *
 * Default is dry-run (list + plan only, no download, no upload). Live copy requires:
 *   SUPABASE_URL, SUPABASE_SECRET_KEY (from apps/web/.env.local)
 *   SUPABASE_STORAGE_COPY=1
 *
 * This script only moves bytes and verifies content-hash integrity. It does NOT write
 * bb_evidence.source_captures — rewriting storage_object is a separate, explicit step so a
 * partial/failed copy can never leave the DB pointing at an object that isn't actually there.
 *
 * Run:
 *   node scripts/copy-gcs-raw-sources-to-supabase.mjs
 *   set -a && source apps/web/.env.local && set +a
 *   SUPABASE_STORAGE_COPY=1 node scripts/copy-gcs-raw-sources-to-supabase.mjs
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SUPABASE_BUCKET = 'raw-sources';
const BUCKET_FILE_SIZE_LIMIT = 524_288_000; // storage.buckets.file_size_limit for raw-sources

/** id = bb_evidence.source_captures.id; sha256 = its content_hash_digest (integrity check). */
const MANIFEST = [
  {
    id: 'cap_fbi_ucr_hate_crime_6d24e053',
    sourceItemId: 'item_fbi_ucr_hate_crime',
    gcsUri:
      'gs://black-book-efaaf-raw-sources/raw-sources/fbi-ucr-hate-crime/1991-2024/hate_crime.zip',
    sha256: '6d24e053b340e74e62d0fcf8b237ac470f5ccafc908ba661581f99c2daa9d189',
    contentType: 'application/zip',
  },
  {
    id: 'cap_fbi_ucr_participation_a0a1a5ea',
    sourceItemId: 'item_fbi_ucr_participation',
    gcsUri:
      'gs://black-book-efaaf-raw-sources/raw-sources/fbi-ucr-participation/1991-2024/ucr_participation_1960_2024.csv',
    sha256: 'a0a1a5ea2c31f2b530672c85a4ad1787b4a2abf196b3681b1b23c366002cfab0',
    contentType: 'text/csv',
  },
  {
    id: 'cap_mapping_inequality_holc_17f3b75e',
    sourceItemId: 'item_mapping_inequality_holc',
    gcsUri:
      'gs://black-book-efaaf-raw-sources/raw-sources/mapping-inequality/2023-full-download/mappinginequality.json',
    sha256: '17f3b75e7485b27e48cfe17c93bd234e1ad4b025a24fc0cd0eab00cf812d6ff0',
    contentType: 'application/json',
  },
  {
    id: 'cap_opportunity_atlas_tract_outcomes_ec4d9ee5',
    sourceItemId: 'item_opportunity_atlas_tract_outcomes',
    gcsUri:
      'gs://black-book-efaaf-raw-sources/raw-sources/opportunity-atlas/tract_outcomes_early-2018/tract_outcomes_early.csv',
    sha256: 'ec4d9ee5bcf0282261762f454226e0b7bc5513bc81644583647028da4305d6df',
    contentType: 'text/csv',
    skip: 'exceeds raw-sources bucket file_size_limit (500 MiB) — see repo-ks7t.1',
  },
];

function extFromContentType(contentType) {
  if (contentType === 'application/zip') return 'zip';
  if (contentType === 'application/json') return 'json';
  if (contentType === 'text/csv') return 'csv';
  return 'bin';
}

function parseArgs(argv) {
  const options = { dryRun: true, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (process.env.SUPABASE_STORAGE_COPY === '1') options.dryRun = false;
  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/copy-gcs-raw-sources-to-supabase.mjs [--dry-run] [-h|--help]

Environment:
  SUPABASE_URL, SUPABASE_SECRET_KEY   Required for live upload
  SUPABASE_STORAGE_COPY=1             Required for live upload (safety latch)
`);
}

function downloadGcsObject(gcsUri, destFile) {
  const result = spawnSync('gsutil', ['cp', gcsUri, destFile], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`gsutil cp failed for ${gcsUri}: ${result.stderr || result.stdout}`);
  }
}

function sha256OfFile(localFile) {
  return createHash('sha256').update(readFileSync(localFile)).digest('hex');
}

async function uploadToSupabase(supabaseUrl, authKey, objectPath, localFile, contentType) {
  const base = supabaseUrl.replace(/\/+$/, '');
  const url = `${base}/storage/v1/object/${SUPABASE_BUCKET}/${objectPath}`;
  const body = readFileSync(localFile);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authKey}`,
      apikey: authKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'Content-Length': String(body.byteLength),
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upload failed ${response.status} for ${objectPath}: ${text.slice(0, 300)}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const authKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const active = MANIFEST.filter((item) => !item.skip);
  const skipped = MANIFEST.filter((item) => item.skip);

  console.log('GCS raw-sources → Supabase Storage private copy');
  console.log(`Dest bucket: ${SUPABASE_BUCKET} (file_size_limit=${BUCKET_FILE_SIZE_LIMIT} bytes)`);
  console.log(`Mode: ${options.dryRun ? 'dry-run' : 'LIVE UPLOAD'}`);
  console.log(`Active: ${active.length}, skipped: ${skipped.length}`);
  for (const item of skipped) {
    console.log(`  SKIP ${item.sourceItemId}: ${item.skip}`);
  }

  if (options.dryRun) {
    for (const item of active) {
      const objectPath = `captures/${item.sha256}.${extFromContentType(item.contentType)}`;
      console.log(`  would copy ${item.gcsUri} -> ${SUPABASE_BUCKET}/${objectPath}`);
    }
    console.log(
      '\nDry-run complete. Re-run with SUPABASE_STORAGE_COPY=1 (and SUPABASE_URL/SUPABASE_SECRET_KEY set) for live upload.',
    );
    return;
  }

  if (!supabaseUrl || !authKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required for live upload',
    );
  }

  const workDir = mkdtempSync(path.join(tmpdir(), 'bb-raw-sources-copy-'));
  const results = [];
  try {
    for (const item of active) {
      const localFile = path.join(workDir, item.sourceItemId);
      console.log(`\n${item.sourceItemId}: downloading ${item.gcsUri} ...`);
      downloadGcsObject(item.gcsUri, localFile);
      const size = statSync(localFile).size;
      const actualSha256 = sha256OfFile(localFile);
      if (actualSha256 !== item.sha256) {
        throw new Error(
          `integrity check failed for ${item.sourceItemId}: expected sha256 ${item.sha256}, got ${actualSha256}`,
        );
      }
      if (size > BUCKET_FILE_SIZE_LIMIT) {
        throw new Error(
          `${item.sourceItemId} is ${size} bytes, over the bucket's ${BUCKET_FILE_SIZE_LIMIT}-byte limit — should have been in the skip list`,
        );
      }
      const objectPath = `captures/${item.sha256}.${extFromContentType(item.contentType)}`;
      console.log(
        `  sha256 verified (${size} bytes). Uploading to ${SUPABASE_BUCKET}/${objectPath} ...`,
      );
      await uploadToSupabase(supabaseUrl, authKey, objectPath, localFile, item.contentType);
      console.log('  uploaded.');
      results.push({
        id: item.id,
        sourceItemId: item.sourceItemId,
        bucket: SUPABASE_BUCKET,
        path: objectPath,
        sha256: item.sha256,
        byteLength: size,
        contentType: item.contentType,
      });
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  console.log(
    '\nDone. New storage_object values (apply these to bb_evidence.source_captures separately):',
  );
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
