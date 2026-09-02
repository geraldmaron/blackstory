/**
 * Pin-and-serve Commons primary images (repo-4vuf, WS5 / architecture repo-n7p6.7.1).
 *
 * Turns one or more auto_propose plan files — dry-run-commons-qid-leftover.ts's output
 * (people/institutions) and/or resolve-nrhp-commons-images.ts's output (NRHP places) — into a
 * pin plan: a 960px Special:FilePath thumbnail URL the reader's browser fetches directly from
 * Wikimedia at view time. Never downloads or stores the original image bytes.
 *
 * Applies the same gates as the source dry-run scripts (DIGNITY_CLASSES + `lynching_`
 * entity-id prefix), re-derived independently rather than trusted from the input file (see
 * scripts/lib/pin-commons-primary-images-plan.ts). Skips `kind: 'place'` rows unless
 * `--allow-places` is passed — the architecture decision (repo-n7p6.7.1) is that places are
 * never auto-photographed by default, but the NRHP lane is all places and is meant to run with
 * this flag.
 *
 * sha1 pinning: a row already carries `sha1` when its source plan fetched Commons imageinfo
 * (both dry-run-commons-qid-leftover.ts and resolve-nrhp-commons-images.ts do, via the shared
 * evaluateCommonsMediaPropose). Only rows without one get a metadata fetch here, sequentially,
 * 1 request/second — or none at all if `--sha1-cache=<path>` points at a JSON file of
 * `{ [fileTitle]: sha1 }` already covering every such row.
 *
 * Supabase Postgres is the sole source of truth (bb_public.release_entities.projection is what
 * the web reads; docs/data/firebase-wind-down.md) — this script writes there, not Firestore.
 *
 * --dry-run (default): writes the plan JSON only. Also runs the read-only Postgres checks
 *   (existing primaryImage per candidate) so the report is accurate before anything is applied.
 * --apply: for each gated-in, sha1-resolved row, in one transaction per row:
 *     1. UPDATE bb_public.release_entities SET projection = jsonb_set(projection,
 *        '{primaryImage}', $primaryImage, true) WHERE release_id = $releaseId AND
 *        entity_id = $entityId
 *     2. UPSERT bb_canonical.entity_media (entity_id, role='primary', ...) — the canonical copy
 *   primaryImage is built by buildPrimaryImageForRelease (lib/entity-media-row.ts) then run
 *   through sanitizePrimaryImageForRelease, so a row that fails the publication gate (missing
 *   alt/credit/rights) is dropped, not written. A row whose entity already has a primaryImage
 *   in Postgres is skipped, never overwritten.
 *   Requires DRY_RUN=0 and PIN_COMMONS_APPLY=1 in the environment (in addition to --apply) —
 *   orchestrator-run only, never from this script's tests.
 *
 * Usage (repo root):
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/pin-commons-primary-images.ts \
 *     --from=.cache/commons-qid-leftover-dry-run.json \
 *     --from=.cache/landscape-intake/nrhp-commons-images-2026-09-02.json --allow-places \
 *     --out=.cache/commons-pin-plan.json
 *
 * Apply (writes; requires credentials — orchestrator-run only, never from this script's tests):
 *   set -a && . apps/web/.env.local && set +a
 *   DRY_RUN=0 PIN_COMMONS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/pin-commons-primary-images.ts \
 *     --from=.cache/commons-pin-plan.json --apply --release-id=rel_xxx
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import {
  commonsPinThumbnailUrl,
  createCommonsMediaClient,
  sanitizePrimaryImageForRelease,
} from '@repo/domain';
import { buildEntityMediaRow, buildPrimaryImageForRelease } from './lib/entity-media-row.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildPinPlanRow,
  dignityHoldFor,
  evaluatePinGate,
  mergeCandidatePayloads,
  type CommonsAutoProposeRow,
  type CommonsPinSourcePayload,
  type PinPlanRow,
} from './lib/pin-commons-primary-images-plan.ts';

/** Default is dry-run. Production writes need BOTH the --apply flag and these two env vars —
 * matches backfill-nrhp-addresses.ts's DRY_RUN=0 + <script>_APPLY=1 double-guard. */
const DRY_RUN_ENV = process.env.DRY_RUN !== '0';
const APPLY_ENV = process.env.PIN_COMMONS_APPLY === '1';

function args(name: string): readonly string[] {
  const prefix = `--${name}=`;
  return process.argv.filter((a) => a.startsWith(prefix)).map((a) => a.slice(prefix.length));
}

function arg(name: string): string | undefined {
  return args(name)[0];
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Read every `--from` file's JSON and hand the parsed payloads to mergeCandidatePayloads. */
function loadMergedCandidates(fromPaths: readonly string[]): readonly CommonsAutoProposeRow[] {
  const payloads: CommonsPinSourcePayload[] = [];
  for (const fromPath of fromPaths) {
    const resolved = resolve(fromPath);
    if (!existsSync(resolved)) {
      console.error(`Missing input file: ${resolved}`);
      process.exit(2);
    }
    payloads.push(JSON.parse(readFileSync(resolved, 'utf8')) as CommonsPinSourcePayload);
  }
  return mergeCandidatePayloads(payloads);
}

/**
 * Sequential, polite sha1 fetch — 1 request/second, in the order the plan needs them.
 * Wikimedia asks for descriptive User-Agent + low concurrency; see
 * commons-media-client.ts's WIKIMEDIA_USER_AGENT.
 */
async function fetchSha1sSequentially(
  fileTitles: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const client = createCommonsMediaClient({ batchSize: 1, batchDelayMs: 0 });
  const out = new Map<string, string>();
  for (let i = 0; i < fileTitles.length; i += 1) {
    const fileTitle = fileTitles[i]!;
    const metadata = await client.fetchCommonsImageMetadata([fileTitle]);
    const sha1 = metadata.get(fileTitle)?.sha1;
    if (sha1) out.set(fileTitle, sha1);
    if (i < fileTitles.length - 1) {
      await sleep(1000);
    }
  }
  return out;
}

/** Read-only: which of these entity ids already have a primaryImage in the given release's
 * projection. Used for both the dry-run report and the apply-time skip check. Returns an empty
 * set (and warns) rather than throwing when no database connection is configured, so a
 * dry-run still produces a plan file without credentials. */
async function loadEntitiesWithExistingPrimaryImage(
  entityIds: readonly string[],
  releaseId: string | undefined,
): Promise<{ readonly ids: ReadonlySet<string>; readonly releaseId: string | undefined }> {
  const databaseUrl =
    process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl || entityIds.length === 0) {
    return { ids: new Set(), releaseId };
  }
  const client = new pg.Client(normalizePgConnectionString(databaseUrl));
  await client.connect();
  try {
    const resolvedReleaseId =
      releaseId ??
      (
        await client.query<{ release_id: string }>(
          `SELECT release_id FROM bb_public.active_release LIMIT 1`,
        )
      ).rows[0]?.release_id;
    if (!resolvedReleaseId) return { ids: new Set(), releaseId: undefined };
    const { rows } = await client.query<{ entity_id: string }>(
      `SELECT entity_id FROM bb_public.release_entities
        WHERE release_id = $1 AND entity_id = ANY($2) AND projection->'primaryImage' IS NOT NULL`,
      [resolvedReleaseId, entityIds],
    );
    return { ids: new Set(rows.map((r) => r.entity_id)), releaseId: resolvedReleaseId };
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const applyRequested = flag('apply');
  const dryRun = !applyRequested;
  const allowPlaces = flag('allow-places');
  const fromPaths = args('from');
  if (fromPaths.length === 0) fromPaths.push('.cache/commons-qid-leftover-dry-run.json');
  const outPath = resolve(arg('out') ?? '.cache/commons-pin-plan.json');
  const sha1CachePath = arg('sha1-cache');
  const releaseIdArg = arg('release-id');

  const candidates = loadMergedCandidates(fromPaths);

  const candidatesByKind: Record<string, number> = {};
  for (const row of candidates) {
    const kind = row.kind ?? 'unknown';
    candidatesByKind[kind] = (candidatesByKind[kind] ?? 0) + 1;
  }

  const gated: { readonly row: CommonsAutoProposeRow }[] = [];
  const held: { readonly entityId: string; readonly reason: string }[] = [];
  const dignityHoldsByClass: Record<string, number> = {};
  const licenseHoldsByOutcome: Record<string, number> = {};
  for (const row of candidates) {
    const result = evaluatePinGate(row, { allowPlaces });
    if (result.ok) {
      gated.push({ row });
      continue;
    }
    held.push({ entityId: row.entityId, reason: result.reason });
    if (result.reason === 'dignity_hold') {
      const dignityClass = dignityHoldFor(row) ?? 'unknown';
      dignityHoldsByClass[dignityClass] = (dignityHoldsByClass[dignityClass] ?? 0) + 1;
    } else if (
      result.reason === 'incomplete_row' &&
      row.outcome !== 'auto_propose' &&
      row.outcome.includes('license')
    ) {
      licenseHoldsByOutcome[row.outcome] = (licenseHoldsByOutcome[row.outcome] ?? 0) + 1;
    }
  }

  const sha1Cache: Record<string, string> = sha1CachePath
    ? (JSON.parse(readFileSync(resolve(sha1CachePath), 'utf8')) as Record<string, string>)
    : {};

  // A row's own sha1 (fetched by its source plan) always wins; sha1Cache and the network fetch
  // below are fallbacks only for rows that arrive without one.
  const missingSha1Titles = [
    ...new Set(
      gated
        .filter(({ row }) => row.sha1 === undefined)
        .map(({ row }) => row.fileTitle!)
        .filter((title) => sha1Cache[title] === undefined),
    ),
  ];
  const fetchedSha1s =
    missingSha1Titles.length > 0
      ? await fetchSha1sSequentially(missingSha1Titles)
      : new Map<string, string>();

  const plan: PinPlanRow[] = [];
  const rightsStatusByEntityId = new Map<string, 'public_domain' | 'licensed' | 'fair_use'>();
  const skippedMissingSha1: string[] = [];
  for (const { row } of gated) {
    const fileTitle = row.fileTitle!;
    const sha1 = row.sha1 ?? sha1Cache[fileTitle] ?? fetchedSha1s.get(fileTitle);
    if (!sha1) {
      skippedMissingSha1.push(row.entityId);
      continue;
    }
    plan.push(
      buildPinPlanRow({
        row,
        thumbUrl: commonsPinThumbnailUrl(fileTitle),
        sha1,
      }),
    );
    if (row.rightsStatus) {
      rightsStatusByEntityId.set(row.entityId, row.rightsStatus);
    }
  }

  const { ids: alreadyHasPrimaryImage, releaseId: resolvedReleaseId } =
    await loadEntitiesWithExistingPrimaryImage(
      plan.map((p) => p.entityId),
      releaseIdArg,
    );

  const outPayload = {
    generatedAt: new Date().toISOString(),
    sources: fromPaths,
    allowPlaces,
    candidateCount: candidates.length,
    candidatesByKind,
    heldCount: held.length,
    held,
    dignityHoldsByClass,
    licenseHoldsByOutcome,
    skippedMissingSha1,
    alreadyHasPrimaryImage: [...alreadyHasPrimaryImage],
    releaseId: resolvedReleaseId,
    planCount: plan.length,
    plan,
  };
  writeFileSync(outPath, `${JSON.stringify(outPayload, null, 2)}\n`);
  console.log(
    `Wrote plan: ${outPath} (${plan.length} pinned, ${held.length} held, ` +
      `${skippedMissingSha1.length} missing sha1, ${alreadyHasPrimaryImage.size} already have a primaryImage)`,
  );
  console.log('Candidates by kind:', candidatesByKind);
  console.log('Dignity holds by class:', dignityHoldsByClass);
  console.log('License holds by outcome:', licenseHoldsByOutcome);

  if (dryRun) {
    console.log('Dry-run only — nothing written to Postgres. Pass --apply to publish.');
    return;
  }

  if (DRY_RUN_ENV || !APPLY_ENV) {
    console.error('Refusing to write: set DRY_RUN=0 and PIN_COMMONS_APPLY=1 to use --apply');
    process.exit(2);
  }
  const releaseId = releaseIdArg ?? resolvedReleaseId;
  if (!releaseId) {
    console.error('Missing required --release-id= for --apply (no active release resolved either)');
    process.exit(2);
  }
  const databaseUrl =
    process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL / SUPABASE_DB_URL) is required for --apply');
    process.exit(2);
  }

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  let promoted = 0;
  let skippedExisting = 0;
  let rejectedByGate = 0;
  const pinnedAt = new Date().toISOString();
  for (const row of plan) {
    if (alreadyHasPrimaryImage.has(row.entityId)) {
      skippedExisting += 1;
      continue;
    }
    const rightsStatus = rightsStatusByEntityId.get(row.entityId);
    if (!rightsStatus) {
      rejectedByGate += 1;
      continue;
    }
    const primaryImage = sanitizePrimaryImageForRelease(
      buildPrimaryImageForRelease(row, rightsStatus, pinnedAt),
    );
    if (!primaryImage) {
      rejectedByGate += 1;
      continue;
    }
    const mediaRow = buildEntityMediaRow(row.entityId, primaryImage);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bb_public.release_entities
            SET projection = jsonb_set(projection, '{primaryImage}', $1::jsonb, true)
          WHERE release_id = $2 AND entity_id = $3`,
        [JSON.stringify(primaryImage), releaseId, row.entityId],
      );
      await client.query(
        `INSERT INTO bb_canonical.entity_media
           (entity_id, role, source_system, file_title, sha1, source_page_url, license, credit,
            alt, url, pinned_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         ON CONFLICT (entity_id, role) DO UPDATE SET
           source_system = excluded.source_system,
           file_title = excluded.file_title,
           sha1 = excluded.sha1,
           source_page_url = excluded.source_page_url,
           license = excluded.license,
           credit = excluded.credit,
           alt = excluded.alt,
           url = excluded.url,
           pinned_at = excluded.pinned_at,
           updated_at = now()`,
        [
          mediaRow.entityId,
          mediaRow.role,
          mediaRow.sourceSystem,
          mediaRow.fileTitle,
          mediaRow.sha1,
          mediaRow.sourcePageUrl,
          mediaRow.license,
          mediaRow.credit,
          mediaRow.alt,
          mediaRow.url,
          mediaRow.pinnedAt,
        ],
      );
      await client.query('COMMIT');
      promoted += 1;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`FAILED ${row.entityId}:`, error);
    } finally {
      client.release();
    }
  }

  console.log(
    `Applied: promoted=${promoted} skippedExisting=${skippedExisting} rejectedByGate=${rejectedByGate}`,
  );
  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
