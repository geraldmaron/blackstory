/**
 * Read-only evaluation of already-published records using the shared current depth gate.
 * Reports raw registry-code leakage separately because prose can be deep yet contain codes, or
 * shallow without them. Template safety alone does not establish live prose quality.
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  assessLandscapeDepth,
  buildLiveDepthEntry,
  type LandscapePublishRow,
} from './lib/incremental-publish.ts';
import {
  humanizeAreaCode,
  findRawRegistryVocabulary,
  RAW_REGISTRY_VOCABULARY_PATTERNS,
} from './lib/nrhp-area-labels.ts';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const LANE_FILTER = flag('lane', '');
const SAMPLES = Number.parseInt(flag('samples', '5'), 10);

type LiveRow = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly summary: string | null;
  readonly claims: unknown;
  readonly projection: Record<string, unknown> | null;
  readonly lane: string | null;
  readonly canonical_url: string | null;
  readonly kind: string | null;
  readonly payload: Record<string, unknown> | null;
};

/**
 * Reuses the publisher's live-depth reconstruction so audit and publication decisions share one
 * implementation.
 */
const asDepthInput = buildLiveDepthEntry;

/**
 * Uses the same raw NPS vocabulary detector as draft validation.
 */
const leakedCodesIn = findRawRegistryVocabulary;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const activeRelease = await pool.query<{ release_id: string }>(
    'SELECT release_id FROM published.v_active_release_id',
  );
  const releaseId = activeRelease.rows[0]?.release_id;
  if (releaseId === undefined) throw new Error('no active release');
  console.log(`Active release: ${releaseId}`);

  const params: unknown[] = [releaseId];
  let laneClause = '';
  if (LANE_FILTER.length > 0) {
    params.push(LANE_FILTER);
    laneClause = `AND lc.lane = $${params.length}`;
  }

  // LEFT JOIN: a live record whose landscape row was since deleted still needs auditing, and
  // dropping it would understate the population — the exact failure this script exists to avoid.
  const rows = await pool.query<LiveRow>(
    `SELECT re.entity_id, re.display_name, re.summary, re.claims, re.projection,
            lc.lane, lc.canonical_url, lc.kind, lc.payload
       FROM published.release_entities re
       LEFT JOIN research.landscape_candidates lc ON lc.id = re.entity_id
      WHERE re.release_id = $1 ${laneClause}
      ORDER BY re.entity_id`,
    params,
  );
  console.log(
    `Auditing ${rows.rows.length} live record(s)${LANE_FILTER ? ` in lane ${LANE_FILTER}` : ''}.\n`,
  );

  type RejectBucket = { count: number; reasons: Map<string, number>; samples: string[] };
  type LeakBucket = { count: number; samples: string[] };
  const rejectedByLane = new Map<string, RejectBucket>();
  const leakByLane = new Map<string, LeakBucket>();
  let deep = 0;

  for (const row of rows.rows) {
    const lane = row.lane ?? '(no landscape row)';

    const landscapeRow = {
      id: row.entity_id,
      lane,
      kind: row.kind ?? 'unknown',
      display_name: row.display_name,
      summary: row.summary,
      lat: null,
      lng: null,
      canonical_url: row.canonical_url,
      source_item_id: '',
      provenance: {},
      payload: row.payload ?? {},
    } satisfies LandscapePublishRow;

    const depth = assessLandscapeDepth(asDepthInput(row), landscapeRow);
    if (depth.deep) {
      deep += 1;
    } else {
      const bucket: RejectBucket = rejectedByLane.get(lane) ?? {
        count: 0,
        reasons: new Map<string, number>(),
        samples: [],
      };
      bucket.count += 1;
      // Collapse the parenthetical detail so counts group by KIND of shallowness, not by which
      // template phrase or source URL happened to appear.
      const reasonKey = depth.detail.replace(/\s*\(.*\)\s*$/u, '').replace(/\(.*?\)/gu, '(…)');
      bucket.reasons.set(reasonKey, (bucket.reasons.get(reasonKey) ?? 0) + 1);
      if (bucket.samples.length < SAMPLES)
        bucket.samples.push(`${row.entity_id} — ${row.display_name.trim()}`);
      rejectedByLane.set(lane, bucket);
    }

    const leaks = leakedCodesIn(row.summary ?? '');
    if (leaks.length > 0) {
      const bucket = leakByLane.get(lane) ?? { count: 0, samples: [] };
      bucket.count += 1;
      if (bucket.samples.length < SAMPLES)
        bucket.samples.push(`${row.entity_id} — ${row.display_name.trim()}`);
      leakByLane.set(lane, bucket);
    }
  }

  const totalRejected = [...rejectedByLane.values()].reduce((sum, b) => sum + b.count, 0);
  console.log('=== DEPTH GATE (assessLandscapeDepth) ===');
  console.log(`deep: ${deep}   would-be-rejected: ${totalRejected}\n`);
  for (const [lane, bucket] of [...rejectedByLane].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`${lane}: ${bucket.count} would be rejected today`);
    for (const [reason, n] of [...bucket.reasons].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(5)}  ${reason}`);
    }
    for (const sample of bucket.samples) console.log(`      e.g. ${sample}`);
    console.log('');
  }

  const totalLeak = [...leakByLane.values()].reduce((sum, b) => sum + b.count, 0);
  console.log('=== RAW REGISTRY-CODE LEAKAGE IN LIVE SUMMARIES ===');
  if (totalLeak === 0) {
    console.log('none\n');
  } else {
    console.log(
      `${totalLeak} live summary(ies) contain a raw NPS code. Two different origins, and the ` +
        `fix differs:\n` +
        `  - TEMPLATE text that predates humanizeAreaCode and no republish has reached ` +
        `(republishing fixes it);\n` +
        `  - DRAFTED prose that copied the registry field into a sentence (repo-lm6h) — ` +
        `republishing preserves it, only a re-draft clears it.\n` +
        `Check whether the summary reads as a generated template before assuming the first.\n`,
    );
    for (const [lane, bucket] of [...leakByLane].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`${lane}: ${bucket.count}`);
      for (const sample of bucket.samples) console.log(`      e.g. ${sample}`);
    }
    console.log('');
  }

  // Sanity check that the mapping this script trusts is in fact total over the live lane. If a
  // code is unmapped, leakage is not merely historical and republishing would reintroduce it.
  if (LANE_FILTER.length > 0) {
    const codes = await pool.query<{ code: string }>(
      `SELECT DISTINCT trim(unnest(string_to_array(payload->>'areaOfSignificance', ';'))) AS code
         FROM research.landscape_candidates
        WHERE lane = $1 AND payload->>'areaOfSignificance' IS NOT NULL`,
      [LANE_FILTER],
    );
    const stillRaw = codes.rows
      .map((r) => r.code)
      .filter((c) => c.length > 0)
      .filter((c) => {
        const label = humanizeAreaCode(c);
        return label !== null && RAW_REGISTRY_VOCABULARY_PATTERNS.some((p) => p.test(label));
      });
    // This result covers template generation only. The separate live-prose report also catches
    // raw codes copied into drafted narrative.
    console.log(
      '=== FORWARD CHECK (TEMPLATE PATH ONLY): would a republish reintroduce a raw code? ===',
    );
    console.log(
      stillRaw.length === 0
        ? 'no — every live code maps to a human phrase.\n' +
            '  Scope: the template/backfill path only. Drafted prose can still carry registry\n' +
            '  vocabulary verbatim (repo-lm6h) — the leak count above, not this line, is the\n' +
            '  statement about what is live.\n'
        : `YES: ${stillRaw.join(', ')}\n`,
    );
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
