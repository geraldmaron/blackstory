/**
 * One bounded corroboration pass for pending landscape intake below the 0.75 publish gate.
 * Fetches each row's canonical_url, finds an independent Tier-1/Tier-2 source via
 * lib/corroborate-source.ts, and writes provenance.sourceUrl on the landscape row.
 * Never publishes — run publish-release-entities-incremental.ts after review.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/enrich-landscape-pending-corroboration.ts
 *
 * Apply DB updates:
 *   DRY_RUN=0 LANDSCAPE_ENRICH_APPLY=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/enrich-landscape-pending-corroboration.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { findCorroboratingTier1Source } from './lib/corroborate-source.ts';
import { fetchPage } from './lib/fetch-page.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  gateLandscapePublishCandidate,
  type LandscapePublishRow,
} from './lib/incremental-publish.ts';
import { mapPool } from '../../operator-cli/src/map-pool.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_PATH = join(REPO_ROOT, '.cache/landscape-intake/enrichment-corroboration-report.json');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.LANDSCAPE_ENRICH_APPLY === '1';

const PENDING_BELOW_GATE_SQL = `
WITH active AS (
  SELECT release_id FROM bb_public.active_release LIMIT 1
)
SELECT
  lc.id,
  lc.lane,
  lc.kind,
  lc.display_name,
  lc.summary,
  lc.lat,
  lc.lng,
  lc.canonical_url,
  lc.source_item_id,
  lc.provenance,
  lc.payload,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN bb_public.release_entities re
      ON re.release_id = a.release_id
      AND (re.entity_id = lc.id OR re.entity_id = lc.source_item_id)
  ) AS exact_in_release,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN bb_public.release_entities re
      ON re.release_id = a.release_id
      AND lower(re.display_name) = lower(lc.display_name)
      AND re.entity_id <> lc.id
      AND re.entity_id <> lc.source_item_id
  ) AS name_overlap
FROM bb_research.landscape_candidates lc
WHERE lc.status = 'pending'
  AND lc.kind <> 'person'
  AND COALESCE(lc.provenance->>'sourceCategory', lc.payload->'provenance'->>'sourceCategory') <> 'People'
ORDER BY lc.id
`;

function readArg(prefix: string): string | undefined {
  const hit = process.argv.find((entry) => entry.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function readLimit(): number | undefined {
  const raw = readArg('--limit=');
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Readonly<Record<string, unknown>>;
  }
  return {};
}

/** Program-level bulk URLs (ArcGIS layer, data.gov catalog) are not independent corroboration. */
const PROGRAM_SOURCE_HOSTS = [
  'services.arcgis.com',
  'catalog.data.gov',
  'historicsites.dcpreservation.org',
] as const;

function isProgramSourceUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return PROGRAM_SOURCE_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

type PendingRow = LandscapePublishRow & {
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly payload: Readonly<Record<string, unknown>>;
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }

  const limit = readLimit();
  const { connectionString, ssl } = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({ connectionString, ...(ssl ? { ssl } : {}) });
  const client = await pool.connect();

  try {
    const pendingBefore = await client.query(
      `SELECT COUNT(*)::text AS n FROM bb_research.landscape_candidates WHERE status = 'pending'`,
    );
    const releaseBefore = await client.query(
      `SELECT COUNT(*)::text AS n
       FROM bb_public.release_entities re
       JOIN bb_public.active_release ar ON ar.release_id = re.release_id`,
    );
    const activeRelease = await client.query(`SELECT release_id FROM bb_public.active_release LIMIT 1`);
    const releaseId = activeRelease.rows[0]?.release_id as string | undefined;
    if (!releaseId) {
      console.error('No active release');
      process.exit(2);
    }

    const result = await client.query(PENDING_BELOW_GATE_SQL);
    let rows = result.rows as PendingRow[];
    if (limit !== undefined) rows = rows.slice(0, limit);

    const generatedAt = new Date().toISOString();
    let attempted = 0;
    let corroborated = 0;
    let alreadyClearsGate = 0;
    let unchanged = 0;
    let wouldClearGate = 0;
    const updates: Array<{
      readonly id: string;
      readonly displayName: string;
      readonly beforeConfidence?: number;
      readonly afterConfidence?: number;
      readonly corroboratingUrl?: string;
      readonly method?: string;
      readonly status: 'updated' | 'unchanged' | 'already_had' | 'clears_gate';
    }> = [];

    await mapPool(
      rows,
      async (row) => {
        attempted += 1;
        const beforeGate = gateLandscapePublishCandidate({
          row,
          releaseId,
          generatedAt,
        });
        if (beforeGate.eligible) {
          alreadyClearsGate += 1;
          updates.push({
            id: row.id,
            displayName: row.display_name,
            afterConfidence: beforeGate.confidence,
            status: 'clears_gate',
          });
          return;
        }
        const beforeDetail = beforeGate.detail;

        const canonicalUrl = row.canonical_url?.trim() ?? '';
        let originalPage: Awaited<ReturnType<typeof fetchPage>>;
        if (canonicalUrl) {
          originalPage = await fetchPage(canonicalUrl);
        }
        const corroboration = await findCorroboratingTier1Source(row.display_name, {
          ...(canonicalUrl
            ? originalPage
              ? { url: canonicalUrl, html: originalPage.html, text: originalPage.text }
              : { url: canonicalUrl }
            : {}),
        });

        if (!corroboration || isProgramSourceUrl(corroboration.url)) {
          unchanged += 1;
          updates.push({
            id: row.id,
            displayName: row.display_name,
            status: 'unchanged',
            ...(beforeDetail ? { beforeDetail } : {}),
          });
          return;
        }

        corroborated += 1;
        const nextProvenance = {
          ...asRecord(row.provenance),
          sourceUrl: corroboration.url,
          corroborationMethod: corroboration.method,
          corroborationEnrichedAt: generatedAt,
        };
        const nextPayload = {
          ...asRecord(row.payload),
          provenance: {
            ...asRecord(asRecord(row.payload).provenance),
            sourceUrl: corroboration.url,
            corroborationMethod: corroboration.method,
            corroborationEnrichedAt: generatedAt,
          },
          enrichment: {
            ...asRecord(asRecord(row.payload).enrichment),
            corroboratingSourceUrl: corroboration.url,
            corroborationMethod: corroboration.method,
            enrichedAt: generatedAt,
          },
        };

        const enrichedRow: PendingRow = {
          ...row,
          provenance: nextProvenance,
          payload: nextPayload,
        };
        const afterGate = gateLandscapePublishCandidate({
          row: enrichedRow,
          releaseId,
          generatedAt,
        });
        const afterConfidence = afterGate.eligible ? afterGate.confidence : undefined;
        const clearsGate = afterGate.eligible;
        if (clearsGate) wouldClearGate += 1;

        if (APPLY && !DRY_RUN) {
          await client.query(
            `UPDATE bb_research.landscape_candidates
             SET provenance = provenance || $2::jsonb,
                 payload = payload || $3::jsonb
             WHERE id = $1 AND status = 'pending'`,
            [row.id, JSON.stringify(nextProvenance), JSON.stringify(nextPayload)],
          );
        }

        updates.push({
          id: row.id,
          displayName: row.display_name,
          afterConfidence,
          corroboratingUrl: corroboration.url,
          method: corroboration.method,
          status: clearsGate ? 'clears_gate' : 'updated',
          ...(beforeDetail ? { beforeDetail } : {}),
        });
      },
      { concurrency: Number(process.env.LANDSCAPE_ENRICH_CONCURRENCY ?? '4') },
    );

    const pendingAfter =
      APPLY && !DRY_RUN
        ? await client.query(
            `SELECT COUNT(*)::text AS n FROM bb_research.landscape_candidates WHERE status = 'pending'`,
          )
        : pendingBefore;
    const releaseAfter =
      APPLY && !DRY_RUN
        ? await client.query(
            `SELECT COUNT(*)::text AS n
             FROM bb_public.release_entities re
             JOIN bb_public.active_release ar ON ar.release_id = re.release_id`,
          )
        : releaseBefore;

    const report = {
      generatedAt,
      dryRun: DRY_RUN || !APPLY,
      attempted,
      corroborated,
      alreadyClearsGate,
      unchanged,
      wouldClearGate,
      pendingBefore: Number(pendingBefore.rows[0]?.n ?? 0),
      pendingAfter: Number(pendingAfter.rows[0]?.n ?? 0),
      releaseEntitiesBefore: Number(releaseBefore.rows[0]?.n ?? 0),
      releaseEntitiesAfter: Number(releaseAfter.rows[0]?.n ?? 0),
      updates,
    };

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

    console.log('=== Landscape pending corroboration enrichment ===');
    console.log(`Attempted: ${attempted}`);
    console.log(`Corroborated: ${corroborated}`);
    console.log(`Already clears gate: ${alreadyClearsGate}`);
    console.log(`Unchanged (no corroboration found): ${unchanged}`);
    console.log(`Would clear 0.75 gate: ${wouldClearGate}`);
    console.log(`Report: ${REPORT_PATH}`);
    if (DRY_RUN || !APPLY) {
      console.log('DRY_RUN=1 (default): no database writes. Set DRY_RUN=0 LANDSCAPE_ENRICH_APPLY=1 to apply.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
