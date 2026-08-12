/**
 * repo-r8qh — run the CURRENT publish depth gate over records that are ALREADY live.
 *
 * `assessLandscapeDepth` is applied at publish time, so it only ever protects records published
 * after it landed (2026-08-06, 8d4e1d3b). The nrhp-black-heritage corpus went out 2026-07-28 and
 * was republished 2026-08-03 by the repo-n7p6.1 correction pass — both before the gate existed.
 * Nothing has ever re-run it against what is live, so the size of the pre-gate population is
 * unmeasured rather than known to be small.
 *
 * READ-ONLY by construction: this script opens no write path, and deliberately reuses
 * `assessLandscapeDepth` itself rather than restating its rules, so an audit result and a publish
 * decision cannot drift apart. If the gate changes, this report changes with it.
 *
 * It also reports raw-registry-code leakage separately. That is a different defect from
 * shallowness — prose can be deep and still leak, or shallow and read cleanly — and conflating
 * them hides whichever is smaller. A record whose live summary says "ethnic heritage (Black)"
 * carries a raw NPS code the TEMPLATE path can no longer produce (`humanizeAreas` maps every live
 * code to a human phrase), so such text is usually pre-mapping prose no republish has reached.
 * "Usually", not "always": repo-lm6h showed the DRAFTING path can mint fresh leaks at any time by
 * copying the registry field verbatim into a researched sentence, where nothing substitutes a code
 * and so nothing humanizes one. Read the leak count below as the statement about live prose, and
 * the forward check at the end as a statement about republishing only.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/audit-live-depth-gate.ts [--lane=nrhp-black-heritage] [--samples=5]
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
 * repo-b4ad moved this reconstruction into `lib/incremental-publish.ts` — the publisher now needs
 * the same live-depth verdict this audit reports, and one copy is the only way the two can agree.
 */
const asDepthInput = buildLiveDepthEntry;

/**
 * A live summary leaks if it contains a raw NPS area code verbatim. The patterns moved to
 * `lib/nrhp-area-labels.ts` for repo-lm6h so the DRAFTING validator can refuse the same vocabulary
 * at draft time; one list means the two checks cannot disagree about what counts as a raw code.
 */
const leakedCodesIn = findRawRegistryVocabulary;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const activeRelease = await pool.query<{ release_id: string }>(
    'SELECT release_id FROM bb_public.v_active_release_id',
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
       FROM bb_public.release_entities re
       LEFT JOIN bb_research.landscape_candidates lc ON lc.id = re.entity_id
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
      `${totalLeak} live summary(ies) contain a raw NPS code. No current code path produces ` +
        `these — humanizeAreaCode maps every code present in the lane — so this text predates ` +
        `that mapping and no republish has reached it.\n`,
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
         FROM bb_research.landscape_candidates
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
    // Name the path this clears. repo-lm6h cost a verification cycle because "no" here was read as
    // "live prose is clean": it only ever proved that TEMPLATE republishing cannot reintroduce a
    // code, and said nothing about prose a drafter wrote by copying the registry field into a
    // sentence. The leak report above is the check that covers live prose, whatever its origin.
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
