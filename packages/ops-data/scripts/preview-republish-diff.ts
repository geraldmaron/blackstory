/**
 * Read-only preview of what a republish would change, field by field.
 *
 * The incremental publish script's dry run answers "which rows are eligible"; it does not say
 * what the rebuilt projection would differ ON. This runs the same landscape query, the same depth
 * assessment, the same gate and the same `buildArtifactsForEntry` builder the publish path uses,
 * then diffs the built projection against what is live in the active release.
 *
 * It opens no write path — there is no apply flag to forget.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/preview-republish-diff.ts --lane=nrhp-black-heritage
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  assessLandscapeDepth,
  buildArtifactsForEntry,
  buildLiveDepthEntry,
  gateLandscapePublishCandidate,
  parseCanonicalStatusSnapshot,
  type LandscapePublishRow,
  type LivePublishedRow,
} from './lib/incremental-publish.ts';

const lane = (process.argv.find((a) => a.startsWith('--lane=')) ?? '').split('=')[1];
if (!lane) {
  console.error('Pass --lane=<lane>');
  process.exit(2);
}
const databaseUrl = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

/** Same shape the publish script reads, including the two computed release-overlap flags. */
const LANDSCAPE_BY_LANE_SQL = `
WITH active AS (SELECT release_id FROM bb_public.active_release LIMIT 1)
SELECT lc.id, lc.lane, lc.kind, lc.display_name, lc.summary, lc.lat, lc.lng, lc.canonical_url,
       lc.source_item_id, lc.provenance, lc.payload,
       EXISTS (
         SELECT 1 FROM active a
         JOIN bb_public.release_entities re ON re.release_id = a.release_id
          AND re.entity_id = ANY(ARRAY[lc.id, lc.source_item_id])
       ) AS exact_in_release,
       EXISTS (
         SELECT 1 FROM active a
         JOIN bb_public.release_entities re ON re.release_id = a.release_id
          AND lower(re.display_name) = lower(lc.display_name)
          AND re.entity_id <> lc.id AND re.entity_id <> lc.source_item_id
       ) AS name_overlap
FROM bb_research.landscape_candidates lc
WHERE lc.lane = $1
ORDER BY lc.id
`;

const conn = normalizePgConnectionString(databaseUrl);
const pool = new pg.Pool({
  connectionString: conn.connectionString,
  max: 2,
  ...(conn.ssl ? { ssl: conn.ssl } : {}),
});
const client = await pool.connect();

const tally = (t: Record<string, number>, k: string) => {
  t[k] = (t[k] ?? 0) + 1;
};

try {
  const releaseId = (
    await client.query<{ release_id: string }>(
      `SELECT release_id FROM bb_public.active_release LIMIT 1`,
    )
  ).rows[0]?.release_id;
  if (!releaseId) throw new Error('no active release pointer');

  const { rows } = await client.query<LandscapePublishRow>(LANDSCAPE_BY_LANE_SQL, [lane]);
  const ids = rows.map((r) => r.id);

  const canonicalById = new Map(
    (
      await client.query(
        `SELECT id AS entity_id, living_status, status_history, kind_detail
           FROM bb_canonical.entities WHERE id = ANY($1::text[])`,
        [ids],
      )
    ).rows.map((row) => [row.entity_id as string, parseCanonicalStatusSnapshot(row)]),
  );
  const liveById = new Map(
    (
      await client.query<LivePublishedRow & { readonly entity_id: string }>(
        `SELECT e.entity_id, e.summary, e.claims, e.projection
           FROM bb_public.release_entities e
           JOIN bb_public.active_release a ON a.release_id = e.release_id
          WHERE e.entity_id = ANY($1::text[])`,
        [ids],
      )
    ).rows.map((r) => [r.entity_id, r]),
  );

  const generatedAt = new Date().toISOString();
  const statusMoves: Record<string, number> = {};
  const eraMoves: Record<string, number> = {};
  const gateRejects: Record<string, number> = {};
  const eraSamples: string[] = [];
  let built = 0;
  let notLive = 0;

  for (const row of rows) {
    const live = liveById.get(row.id);
    if (!live) {
      notLive++;
      continue;
    }
    const canonicalStatus = canonicalById.get(row.id);
    const liveDepth = assessLandscapeDepth(buildLiveDepthEntry(live), row);
    const gate = gateLandscapePublishCandidate({
      row,
      releaseId,
      generatedAt,
      allowRepublish: true,
      liveDepth,
      ...(canonicalStatus !== undefined ? { canonicalStatus } : {}),
    });
    if (!gate.eligible) {
      tally(gateRejects, gate.reason);
      continue;
    }
    const result = buildArtifactsForEntry({
      entry: gate.entry,
      releaseId,
      generatedAt,
      ...(canonicalStatus !== undefined ? { canonicalStatus } : {}),
    });
    if (!result.ok) {
      tally(gateRejects, `build:${result.reason}`);
      continue;
    }
    built++;

    const before = (live.projection ?? {}) as Record<string, unknown>;
    const after = result.entityRow.projection as unknown as Record<string, unknown>;

    const beforeStatus = (before.status as string) ?? '(none)';
    const afterStatus = (after.status as string) ?? '(none)';
    if (beforeStatus !== afterStatus) tally(statusMoves, `${beforeStatus} -> ${afterStatus}`);

    const beforeEra = ((before.eraBuckets as string[]) ?? []).join(',');
    const afterEra = ((after.eraBuckets as string[]) ?? []).join(',');
    if (beforeEra !== afterEra) {
      tally(eraMoves, `${beforeEra === '' ? 'none' : 'set'} -> ${afterEra === '' ? 'none' : 'set'}`);
      if (eraSamples.length < 8) {
        eraSamples.push(`${row.id}: [${beforeEra || '—'}] -> [${afterEra || '—'}]`);
      }
    }
  }

  console.log(`lane=${lane} | landscape rows: ${rows.length} | live: ${rows.length - notLive}`);
  console.log(`built through the real gate: ${built}\n`);
  console.log('gate/build rejections:');
  const gr = Object.entries(gateRejects).sort((a, b) => b[1] - a[1]);
  gr.length === 0 ? console.log('  (none)') : gr.forEach(([k, n]) => console.log(String(n).padStart(6), k));
  console.log('\nSTATUS changes:');
  const st = Object.entries(statusMoves).sort((a, b) => b[1] - a[1]);
  st.length === 0 ? console.log('  (none)') : st.forEach(([k, n]) => console.log(String(n).padStart(6), k));
  console.log('\nERA BUCKET changes:');
  const er = Object.entries(eraMoves).sort((a, b) => b[1] - a[1]);
  er.length === 0 ? console.log('  (none)') : er.forEach(([k, n]) => console.log(String(n).padStart(6), k));
  if (eraSamples.length > 0) {
    console.log('\nera samples:');
    eraSamples.forEach((s) => console.log('  -', s));
  }
} finally {
  client.release();
  await pool.end();
}
