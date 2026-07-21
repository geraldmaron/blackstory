#!/usr/bin/env node
/**
 * Copy GCS public-media objects into Supabase Storage `public-media` (ADR-020 blob cutover).
 *
 * Default is dry-run (list + plan only). Live upload requires:
 *   SUPABASE_URL (default project URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_STORAGE_COPY=1
 *
 * GCS source remains untouched. Paths are preserved under the Supabase bucket.
 *
 * Run:
 *   node scripts/copy-gcs-public-media-to-supabase.mjs
 *   SUPABASE_STORAGE_COPY=1 SUPABASE_SERVICE_ROLE_KEY=… node scripts/copy-gcs-public-media-to-supabase.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_GCS_BUCKET = 'black-book-efaaf-public-media';
const DEFAULT_SUPABASE_URL = 'https://twykhihqkcldpreuovay.supabase.co';
const SUPABASE_BUCKET = 'public-media';
const PREFIX = 'public/';

function printUsage() {
  console.log(`Usage: node scripts/copy-gcs-public-media-to-supabase.mjs [options]

Options:
  --dry-run          List objects and plan only (default)
  --limit <n>        Cap objects to copy (after listing)
  --prefix <path>    GCS prefix under bucket (default: public/)
  -h, --help

Environment:
  SUPABASE_URL                 Project URL (default: ${DEFAULT_SUPABASE_URL})
  SUPABASE_SERVICE_ROLE_KEY    Required for live upload
  SUPABASE_STORAGE_COPY=1      Required for live upload (safety latch)
  GCS_PUBLIC_MEDIA_BUCKET      Override source bucket (default: ${DEFAULT_GCS_BUCKET})
`);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ dryRun: boolean, limit: number | null, prefix: string, help: boolean }} */
  const options = {
    dryRun: true,
    limit: null,
    prefix: PREFIX,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--limit') {
      const next = argv[++i];
      const n = Number.parseInt(next ?? '', 10);
      if (!Number.isFinite(n) || n < 1) throw new Error('--limit must be a positive integer');
      options.limit = n;
    } else if (arg === '--prefix') {
      options.prefix = argv[++i] ?? PREFIX;
    } else if (arg === '-h' || arg === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (process.env.SUPABASE_STORAGE_COPY === '1') {
    options.dryRun = false;
  }
  return options;
}

/**
 * @param {string} bucket
 * @param {string} prefix
 * @returns {string[]}
 */
function listGcsObjects(bucket, prefix) {
  const result = spawnSync(
    'gsutil',
    ['ls', '-r', `gs://${bucket}/${prefix}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`gsutil ls failed: ${result.stderr || result.stdout}`);
  }
  return (result.stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`gs://${bucket}/`) && !line.endsWith(':'));
}

/**
 * @param {string} gcsUri
 * @param {string} bucket
 */
function objectPathFromGcsUri(gcsUri, bucket) {
  const marker = `gs://${bucket}/`;
  if (!gcsUri.startsWith(marker)) {
    throw new Error(`Unexpected GCS URI: ${gcsUri}`);
  }
  return gcsUri.slice(marker.length);
}

/**
 * @param {string} gcsUri
 * @param {string} destFile
 */
function downloadGcsObject(gcsUri, destFile) {
  const result = spawnSync('gsutil', ['cp', gcsUri, destFile], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`gsutil cp failed for ${gcsUri}: ${result.stderr || result.stdout}`);
  }
}

/**
 * @param {string} supabaseUrl
 * @param {string} authKey
 * @param {string} objectPath
 * @param {string} localFile
 * @param {string} contentType
 */
async function uploadToSupabase(supabaseUrl, authKey, objectPath, localFile, contentType) {
  const base = supabaseUrl.replace(/\/$/, '');
  const url = `${base}/storage/v1/object/${SUPABASE_BUCKET}/${objectPath}`;
  const body = readFileSync(localFile);
  let lastError = /** @type {Error | null} */ (null);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
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
      if (response.ok) return;
      const text = await response.text();
      // Already exists without upsert support — try PUT
      if (response.status === 400 || response.status === 409) {
        const put = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authKey}`,
            apikey: authKey,
            'Content-Type': contentType,
            'Content-Length': String(body.byteLength),
          },
          body,
        });
        if (put.ok) return;
        lastError = new Error(`Upload failed ${put.status} for ${objectPath}: ${await put.text()}`);
      } else {
        lastError = new Error(`Upload failed ${response.status} for ${objectPath}: ${text}`);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    await sleep(250 * attempt * attempt);
  }
  throw lastError ?? new Error(`Upload failed for ${objectPath}`);
}

/**
 * @param {string} supabaseUrl
 * @param {string} objectPath
 */
async function alreadyPublic(supabaseUrl, objectPath) {
  const base = supabaseUrl.replace(/\/$/, '');
  const url = `${base}/storage/v1/object/public/${SUPABASE_BUCKET}/${objectPath}`;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * @param {string} objectPath
 */
function guessContentType(objectPath) {
  const lower = objectPath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const gcsBucket = process.env.GCS_PUBLIC_MEDIA_BUCKET || DEFAULT_GCS_BUCKET;
  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const authKey = serviceRoleKey || anonKey;

  console.log('GCS → Supabase public-media copy');
  console.log(`Source: gs://${gcsBucket}/${options.prefix}`);
  console.log(`Dest:   ${supabaseUrl}/storage/v1/object/public/${SUPABASE_BUCKET}/…`);
  console.log(`Mode:   ${options.dryRun ? 'dry-run' : 'LIVE UPLOAD'}`);

  let objects = listGcsObjects(gcsBucket, options.prefix);
  if (options.limit !== null) {
    objects = objects.slice(0, options.limit);
  }
  console.log(`Objects: ${objects.length}`);

  if (options.dryRun) {
    for (const uri of objects.slice(0, 20)) {
      console.log(`  would copy ${uri}`);
    }
    if (objects.length > 20) console.log(`  … and ${objects.length - 20} more`);
    console.log('\nDry-run complete. Re-run with SUPABASE_STORAGE_COPY=1 and SUPABASE_SERVICE_ROLE_KEY set for live upload.');
    return;
  }

  if (!authKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required for live upload');
  }

  const workDir = mkdtempSync(path.join(tmpdir(), 'bb-media-copy-'));
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  try {
    for (const uri of objects) {
      const objectPath = objectPathFromGcsUri(uri, gcsBucket);
      if (await alreadyPublic(supabaseUrl, objectPath)) {
        skipped += 1;
        ok += 1;
        continue;
      }
      const localFile = path.join(workDir, path.basename(objectPath) || 'blob');
      try {
        downloadGcsObject(uri, localFile);
        await uploadToSupabase(
          supabaseUrl,
          authKey,
          objectPath,
          localFile,
          guessContentType(objectPath),
        );
        ok += 1;
        if (ok % 25 === 0) console.log(`  uploaded/skipped ${ok}/${objects.length}`);
      } catch (err) {
        failed += 1;
        console.error(`  FAIL ${objectPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  console.log(`Done. ok=${ok} skipped=${skipped} failed=${failed} total=${objects.length}`);
  console.log('GCS source was not modified.');
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
