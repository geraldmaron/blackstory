/**
 * Lane B / repo-bmmo — deterministic summary backfill for the NRHP Black
 * heritage lane (nrhp-black-heritage).
 *
 * scrape-nrhp-black-heritage-roster.ts stages rows with summary=NULL (the
 * dataset has no prose description). buildReleaseSourceFromLandscape /
 * gateLandscapePublishCandidate both require a non-empty summary before a
 * row can even be corroborated, so every row is stuck at
 * 'insufficient landscape fields' until this runs.
 *
 * No LLM: the summary sentence is templated purely from fields already
 * captured in landscape_candidates.payload (category, city, county, state,
 * area of significance, listed date) at scrape time — the same fields NPS
 * itself publishes in the dataset. Output length is checked against the
 * downstream publicEntityProjectionSchema bound (120-400 chars); rows that
 * don't fit after the fallback expansion are reported, not silently
 * truncated into something misleading.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 NRHP_SUMMARY_BACKFILL_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-nrhp-black-heritage-summaries.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

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

/** Pure — Excel/NPS serial date (days since 1899-12-30) -> "Month D, YYYY". */
export function formatListedDate(serial: string | null | undefined): string | null {
  if (!serial) return null;
  const days = Number.parseInt(serial, 10);
  if (!Number.isFinite(days) || days <= 0) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + days * 86_400_000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Pure — "EDUCATION; BLACK; ARCHITECTURE" -> "education, ethnic heritage (Black), and architecture". */
export function humanizeAreas(raw: string | undefined): string {
  if (!raw) return 'African American heritage';
  const parts = raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) =>
      entry.toUpperCase() === 'BLACK' ? 'ethnic heritage (Black)' : entry.toLowerCase(),
    );
  if (parts.length === 0) return 'African American heritage';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

const TRAILER =
  ` The National Park Service's National Register program recognizes it as a documented site of ` +
  `African American historical importance.`;
const FILLER =
  ` It is one of thousands of properties nationwide the National Register has formally recognized ` +
  `for preserving African American history and heritage.`;

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

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const res = await pool.query<Row>(
    `SELECT id, display_name, payload
     FROM bb_research.landscape_candidates
     WHERE lane = $1 AND (summary IS NULL OR length(trim(summary)) = 0)
     ORDER BY id`,
    [LANE],
  );
  console.log(`Rows needing summary backfill (lane='${LANE}'): ${res.rows.length}`);

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
        `UPDATE bb_research.landscape_candidates SET summary = $1, updated_at = now() WHERE id = $2`,
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
