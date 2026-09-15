/**
 * Builds the static Lives Across the Decades snapshots (bead repo-0clax.21): one
 * `bb_public.materialized_snapshots` row per area (`livesArea:<slug>`) holding the built bundle, so
 * /lives pages never query the reference tables at request time. Rebuild after loading figures, count
 * notes or rules; unchanged content is left alone.
 *
 * Usage (repo root):
 *   set -a && . apps/web/.env.local && set +a
 *   node --conditions development --import tsx packages/ops-data/scripts/build-lives-snapshots.ts
 *   DRY_RUN=0 BUILD_LIVES_SNAPSHOTS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/build-lives-snapshots.ts
 */
import pg from 'pg';
import { sha256Json } from '@repo/domain';
import {
  LIVES_AREAS,
  LIVES_NATIONAL,
  LIVES_SNAPSHOT_VERSION,
  buildLivesAreaBundle,
  livesSnapshotName,
  livesStateJurisdictionId,
  type LivesAreaBundle,
  type LivesAreaSnapshot,
  type LivesCellState,
  type LivesRuleEntityRef,
} from '@repo/domain/statistics/lives';
import {
  APPLICABILITY_SQL,
  COUNT_NOTES_SQL,
  COVERAGE_SQL,
  JURISDICTIONS_SQL,
  OBSERVATIONS_SQL,
  mapApplicabilityRow,
  mapCountNoteRow,
  mapCoverageRow,
  mapObservationRow,
  type ApplicabilityRow,
  type CountNoteRow,
  type CoverageRow,
  type ObservationRow,
} from '../src/lives/snapshot-inputs.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.BUILD_LIVES_SNAPSHOTS_APPLY === '1';

function tallyCells(bundle: LivesAreaBundle): Record<LivesCellState, number> {
  const tally: Record<LivesCellState, number> = {
    published: 0,
    wide_margin: 0,
    suppressed: 0,
    not_measured: 0,
    pending: 0,
  };
  for (const decade of bundle.decades) {
    for (const buckets of Object.values(decade.classShares)) {
      for (const cell of Object.values(buckets)) tally[cell.state] += 1;
    }
    for (const condition of decade.conditions) {
      for (const cell of Object.values(condition.cells)) tally[cell.state] += 1;
    }
  }
  return tally;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool(normalizePgConnectionString(url));
  try {
    const notes = (await pool.query<CountNoteRow>(COUNT_NOTES_SQL)).rows.flatMap(
      (row) => mapCountNoteRow(row) ?? [],
    );
    const report: Record<string, unknown>[] = [];
    for (const area of LIVES_AREAS) {
      const ids = [
        ...new Set([LIVES_NATIONAL.id, ...area.memberStateFips.map(livesStateJurisdictionId)]),
      ];
      const [jurisdictions, observations, coverage, applicability] = await Promise.all([
        pool.query<{ id: string; name: string }>(JURISDICTIONS_SQL, [ids]),
        pool.query<ObservationRow>(OBSERVATIONS_SQL, [ids]),
        pool.query<CoverageRow>(COVERAGE_SQL, [area.id]),
        pool.query<ApplicabilityRow>(APPLICABILITY_SQL, [ids]),
      ]);
      const bundle = buildLivesAreaBundle({
        area,
        jurisdictions: jurisdictions.rows,
        observations: observations.rows.map(mapObservationRow),
        coverage: coverage.rows.flatMap(mapCoverageRow),
        countNotes: notes,
        applicability: applicability.rows.map(mapApplicabilityRow),
        frames: [],
      });
      const ruleEntities: Record<string, LivesRuleEntityRef> = {};
      for (const row of applicability.rows) {
        ruleEntities[row.entity_id] = { kind: row.kind, displayName: row.display_name };
      }
      const contentHash = sha256Json({ bundle, ruleEntities }).digest;
      const name = livesSnapshotName(area.slug);
      const prior = await pool.query<{ payload: { contentHash?: string } }>(
        'SELECT payload FROM bb_public.materialized_snapshots WHERE name = $1',
        [name],
      );
      const priorHash = prior.rows[0]?.payload?.contentHash;
      const outcome = priorHash === contentHash ? 'unchanged' : priorHash ? 'updated' : 'created';
      const snapshot: LivesAreaSnapshot = {
        version: LIVES_SNAPSHOT_VERSION,
        areaSlug: area.slug,
        generatedAt: new Date().toISOString(),
        contentHash,
        bundle,
        ruleEntities,
      };
      const payload = JSON.stringify(snapshot);
      report.push({
        name,
        outcome,
        observations: observations.rowCount,
        rules: applicability.rowCount,
        bytes: payload.length,
        cells: tallyCells(bundle),
      });
      if (apply && outcome !== 'unchanged') {
        await pool.query(
          `INSERT INTO bb_public.materialized_snapshots (name, payload, updated_at)
           VALUES ($1, $2::jsonb, now())
           ON CONFLICT (name) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
          [name, payload],
        );
      }
    }
    console.log(JSON.stringify({ apply, notes: notes.length, areas: report }, null, 2));
    if (!apply) console.log('Dry run. Set DRY_RUN=0 BUILD_LIVES_SNAPSHOTS_APPLY=1 to write.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
