/**
 * Builds deterministic NRHP summary text from captured registry fields and reports invalid
 * lengths. This is index-derived prose, not independent research. Default dry-run; writes
 * require DRY_RUN=0 and NRHP_SUMMARY_BACKFILL_APPLY=1.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  NRHP_SUMMARY_FILLER,
  NRHP_SUMMARY_TRAILER,
  formatNrhpListedDate,
  humanizeAreas,
} from './lib/nrhp-area-labels.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_DIR = join(REPO_ROOT, '.cache/landscape-intake');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.NRHP_SUMMARY_BACKFILL_APPLY === '1';
const LANE = 'nrhp-black-heritage';
const MIN_LEN = 120;
const MAX_LEN = 400;

type Row = {
  readonly id: string;
  readonly display_name: string;
  readonly payload: {
    readonly category?: string;
    readonly city?: string;
    readonly county?: string;
    readonly state?: string;
    readonly areaOfSignificance?: string;
    readonly listedDateSerial?: string | null;
  };
};

const CATEGORY_LABELS: Record<string, string> = {
  BUILDING: 'building',
  DISTRICT: 'historic district',
  SITE: 'historic site',
  STRUCTURE: 'structure',
  OBJECT: 'landmark object',
};

/** Re-exported for callers that imported the date formatter from this script before it moved to
 *  lib/nrhp-area-labels.ts (shared with lib/incremental-publish.ts's claim/notabilityBasis text). */
export const formatListedDate = formatNrhpListedDate;

// Shared with the publish depth gate — see lib/nrhp-area-labels.ts for why they live there.
const TRAILER = NRHP_SUMMARY_TRAILER;
const FILLER = NRHP_SUMMARY_FILLER;

function coreSentence(displayName: string, payload: Row['payload'], areas: string): string {
  const categoryLabel =
    CATEGORY_LABELS[(payload.category ?? '').toUpperCase()] ?? 'historic property';
  const place = [payload.city, payload.county ? `${payload.county} County` : null, payload.state]
    .filter(Boolean)
    .join(', ');
  const listedDate = formatListedDate(payload.listedDateSerial);
  return (
    `${displayName} is a ${categoryLabel}${place ? ` in ${place}` : ''} listed on the National Register ` +
    `of Historic Places${listedDate ? ` on ${listedDate}` : ''} for its significance in ${areas}.`
  );
}

export function buildSummary(displayName: string, payload: Row['payload']): string {
  const allAreas = (payload.areaOfSignificance ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  // Progressively shorten the area list until core + trailer fits MAX_LEN.
  for (let count = allAreas.length; count >= 1; count -= 1) {
    const areas = humanizeAreas(allAreas.slice(0, count).join('; '));
    const core = coreSentence(displayName, payload, areas);
    if ((core + TRAILER).length <= MAX_LEN) {
      const withTrailer = core + TRAILER;
      return withTrailer.length >= MIN_LEN ? withTrailer : withTrailer + FILLER;
    }
    if (count === 1 && core.length <= MAX_LEN) {
      return core.length >= MIN_LEN ? core : core + FILLER;
    }
  }
  // No area terms at all (shouldn't happen — filter guarantees at least "BLACK").
  const core = coreSentence(displayName, payload, 'African American heritage');
  return core.length <= MAX_LEN ? core : core.slice(0, MAX_LEN);
}

// REGENERATE_ALL=1 rebuilds existing summaries as well as empty ones, allowing corrected
// registry-vocabulary mapping to reach previously staged rows.
const REGENERATE_ALL = process.env.REGENERATE_ALL === '1';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const res = await pool.query<Row>(
    REGENERATE_ALL
      ? `SELECT id, display_name, payload
         FROM research.landscape_candidates
         WHERE lane = $1
         ORDER BY id`
      : `SELECT id, display_name, payload
         FROM research.landscape_candidates
         WHERE lane = $1 AND (summary IS NULL OR length(trim(summary)) = 0)
         ORDER BY id`,
    [LANE],
  );
  console.log(
    `Rows needing summary backfill (lane='${LANE}', regenerateAll=${REGENERATE_ALL}): ${res.rows.length}`,
  );

  const outOfBounds: { id: string; displayName: string; length: number }[] = [];
  const updates: { id: string; summary: string }[] = [];
  for (const row of res.rows) {
    const summary = buildSummary(row.display_name, row.payload);
    if (summary.length < MIN_LEN || summary.length > MAX_LEN) {
      outOfBounds.push({ id: row.id, displayName: row.display_name, length: summary.length });
      continue;
    }
    updates.push({ id: row.id, summary });
  }

  console.log(`Would update: ${updates.length}. Out-of-bounds (skipped): ${outOfBounds.length}.`);
  console.log('\nSample summaries:');
  console.table(
    updates.slice(0, 5).map((u) => ({ id: u.id, len: u.summary.length, summary: u.summary })),
  );
  if (outOfBounds.length > 0) {
    console.log('\nOut-of-bounds rows:');
    console.table(outOfBounds.slice(0, 10));
  }

  const generatedAt = new Date().toISOString();
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(
    REPORT_DIR,
    `nrhp-summary-backfill-${generatedAt.replace(/[:.]/gu, '-')}.json`,
  );
  writeFileSync(
    reportPath,
    JSON.stringify({ generatedAt, dryRun: DRY_RUN || !APPLY, updates, outOfBounds }, null, 2),
  );
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 NRHP_SUMMARY_BACKFILL_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const update of updates) {
      await client.query(
        `UPDATE research.landscape_candidates SET summary = $1, updated_at = now() WHERE id = $2`,
        [update.summary, update.id],
      );
    }
    await client.query('COMMIT');
    console.log(`Applied: updated summary on ${updates.length} row(s).`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
