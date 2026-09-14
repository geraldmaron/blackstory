/**
 * repo-2t04.8.1 — turns research-workflow output (one JSON object per town, matching the
 * sundown-sub220-research workflow's FINDINGS_SCHEMA) into:
 *   1. bb_research.entity_evidence rows (manual capture — no automated collector targets
 *      justice.tougaloo.edu yet) for every 'draft' outcome.
 *   2. a BulkFixtureFile fixture (same shape build-sundown-towns-fixture.ts produces) for
 *      load-bulk-candidates-to-supabase.ts to create the missing bb_research.landscape_candidates
 *      row per entity (these 31 entities are already LIVE in bb_public.release_entities but were
 *      never staged through landscape_candidates, so apply-enrichment-to-landscape.ts's plain
 *      UPDATE would otherwise match zero rows).
 *   3. answers.jsonl for session-enrich-apply.ts ({entityId, rawContent}).
 *   4. a refusals summary (printed only — NOT fed to session-enrich-apply's --refusals-file,
 *      because that records a terminal no-lane-significance status, and README-fanout-drafting.md
 *      is explicit that sundown refusals route to human/editorial review instead).
 *
 * This script only WRITES the fixture/answers files and PRINTS the evidence-insert plan; it does
 * not touch the database. Run insert-sundown-evidence.mts separately to apply the evidence rows.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-sundown-wave2.mts --in=<results.json> --out-dir=<dir>
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BulkFixtureCandidate, BulkFixtureFile } from './lib/bulk-candidates-supabase.ts';

function flag(name: string, fallback?: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = hit === undefined ? fallback : hit.slice(name.length + 3);
  if (value === undefined) throw new Error(`--${name}= is required`);
  return value;
}

const IN = flag('in');
const OUT_DIR = flag('out-dir');
mkdirSync(OUT_DIR, { recursive: true });

type Citation = { readonly source: 'primary' | 'corroborating'; readonly quote: string };
type Finding = {
  readonly entityId: string;
  readonly outcome: 'draft' | 'refuse' | 'defer';
  readonly refusalReason: string | null;
  readonly primarySourceUrl: string | null;
  readonly primarySourceTitle: string | null;
  readonly primarySourceText: string | null;
  readonly corroboratingSourceUrl: string | null;
  readonly corroboratingSourceTitle: string | null;
  readonly corroboratingSourceTier: string | null;
  readonly corroboratingSourceText: string | null;
  readonly summary: string | null;
  readonly summaryCitations: readonly Citation[];
  readonly historicalContext: string | null;
  readonly historicalContextCitations: readonly Citation[];
  readonly topicIds: readonly string[];
  readonly eraBuckets: readonly string[];
  readonly keywords: readonly string[];
  readonly bestEffort: boolean;
  readonly bestEffortReason: string | null;
};

const findings = JSON.parse(readFileSync(IN, 'utf8')) as readonly Finding[];

/** Already-live display name + coordinates (bb_public.release_entities), carried through so the
 * new landscape_candidates row doesn't regress either — this loader's ON CONFLICT overwrites both. */
const KNOWN: Readonly<
  Record<string, { readonly displayName: string; readonly lat: number; readonly lng: number }>
> = {
  sundown_ada_oklahoma: { displayName: 'Ada, Oklahoma', lat: 34.76361111, lng: -96.66833333 },
  sundown_altoona_kansas: { displayName: 'Altoona, Kansas', lat: 37.52666667, lng: -95.66194444 },
  sundown_bibb_texas: { displayName: 'Bibb, Texas', lat: 31.95, lng: -98.56 },
  sundown_blackwell_oklahoma: {
    displayName: 'Blackwell, Oklahoma',
    lat: 36.80138889,
    lng: -97.30083333,
  },
  sundown_bonanza_arkansas: {
    displayName: 'Bonanza, Arkansas',
    lat: 35.23333333,
    lng: -94.41638889,
  },
  sundown_craighead_county_arkansas: {
    displayName: 'Craighead County, Arkansas',
    lat: 35.81111111,
    lng: -90.69694444,
  },
  sundown_culver_city_california: {
    displayName: 'Culver City, California',
    lat: 34.00777778,
    lng: -118.40083333,
  },
  sundown_doniphan_missouri: {
    displayName: 'Doniphan, Missouri',
    lat: 36.62333333,
    lng: -90.82222222,
  },
  sundown_elmo_texas: { displayName: 'Elmo, Texas', lat: 32.72472222, lng: -96.15333333 },
  sundown_fleming_texas: { displayName: 'Fleming, Texas', lat: 31.95, lng: -98.56 },
  sundown_granite_city_illinois: {
    displayName: 'Granite City, Illinois',
    lat: 38.75833333,
    lng: -90.11833333,
  },
  sundown_greensburg_indiana: {
    displayName: 'Greensburg, Indiana',
    lat: 39.35277778,
    lng: -85.50333333,
  },
  sundown_greer_county_oklahoma: { displayName: 'Greer County, Oklahoma', lat: 34.93, lng: -99.56 },
  sundown_hickory_ridge_arkansas: {
    displayName: 'Hickory Ridge, Arkansas',
    lat: 35.40083333,
    lng: -90.99777778,
  },
  sundown_howard_kansas: { displayName: 'Howard, Kansas', lat: 37.46944444, lng: -96.26305556 },
  sundown_kiowa_kansas: { displayName: 'Kiowa, Kansas', lat: 37.0175, lng: -98.48472222 },
  sundown_lenox_iowa: { displayName: 'Lenox, Iowa', lat: 40.87777778, lng: -94.5575 },
  sundown_levittown_new_york: {
    displayName: 'Levittown, New York',
    lat: 40.72444444,
    lng: -73.51111111,
  },
  sundown_linton_indiana: { displayName: 'Linton, Indiana', lat: 39.03555556, lng: -87.15722222 },
  sundown_minden_nevada: { displayName: 'Minden, Nevada', lat: 38.95611111, lng: -119.76916667 },
  sundown_palos_verdes_estates_california: {
    displayName: 'Palos Verdes Estates, California',
    lat: 33.78694444,
    lng: -118.39666667,
  },
  sundown_prescott_arizona: {
    displayName: 'Prescott, Arizona',
    lat: 34.58527778,
    lng: -112.44694444,
  },
  sundown_sheridan_arkansas: { displayName: 'Sheridan, Arkansas', lat: 34.3118, lng: -92.4079 },
  sundown_st_john_missouri: {
    displayName: 'St. John, Missouri',
    lat: 38.71472222,
    lng: -90.34638889,
  },
  sundown_stone_county_missouri: { displayName: 'Stone County, Missouri', lat: 36.74, lng: -93.47 },
  sundown_taney_county_missouri: { displayName: 'Taney County, Missouri', lat: 36.65, lng: -93.04 },
  sundown_utica_ohio: { displayName: 'Utica, Ohio', lat: 40.23361111, lng: -82.44111111 },
  sundown_valparaiso_indiana: {
    displayName: 'Valparaiso, Indiana',
    lat: 41.47611111,
    lng: -87.04027778,
  },
  sundown_washington_county_indiana: {
    displayName: 'Washington County, Indiana',
    lat: 38.6,
    lng: -86.11,
  },
  sundown_waverly_ohio: { displayName: 'Waverly, Ohio', lat: 39.12555556, lng: -82.9875 },
  sundown_whittville_texas: { displayName: 'Whittville, Texas', lat: 31.95, lng: -98.56 },
};

function evidenceId(entityId: string, collector: string, sourceUrl: string): string {
  const hash = createHash('sha1').update(`${entityId}|${collector}|${sourceUrl}`).digest('hex');
  return `ev_${hash.slice(0, 24)}`;
}
function contentHash(text: string): string {
  const collapsed = text.replace(/\s+/gu, ' ').trim();
  return createHash('sha256').update(collapsed).digest('hex');
}

const RETRIEVED_AT = new Date().toISOString();

const drafts = findings.filter((f) => f.outcome === 'draft');
const refused = findings.filter((f) => f.outcome === 'refuse');
const deferred = findings.filter((f) => f.outcome === 'defer');

console.log(
  `Findings: ${findings.length} total — draft ${drafts.length}, refuse ${refused.length}, defer ${deferred.length}`,
);

// --- 1. Evidence insert plan (JSON consumed by insert-sundown-evidence.mts) ---
type EvidenceInsertRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly lane: string;
  readonly collector: string;
  readonly source_url: string;
  readonly source_tier: string;
  readonly title: string | null;
  readonly content_text: string;
  readonly content_hash: string;
  readonly char_count: number;
};
const evidenceRows: EvidenceInsertRow[] = [];
const missingSource: string[] = [];

for (const f of drafts) {
  if (!f.primarySourceUrl || !f.primarySourceText) {
    missingSource.push(`${f.entityId}: missing primary source despite draft outcome`);
    continue;
  }
  evidenceRows.push({
    id: evidenceId(f.entityId, 'manual-tougaloo-research', f.primarySourceUrl),
    entity_id: f.entityId,
    lane: 'other',
    collector: 'manual-tougaloo-research',
    source_url: f.primarySourceUrl,
    source_tier: 'tier1',
    title: f.primarySourceTitle,
    content_text: f.primarySourceText,
    content_hash: contentHash(f.primarySourceText),
    char_count: f.primarySourceText.length,
  });
  if (f.corroboratingSourceUrl && f.corroboratingSourceText) {
    evidenceRows.push({
      id: evidenceId(f.entityId, 'manual-corroboration-research', f.corroboratingSourceUrl),
      entity_id: f.entityId,
      lane: 'other',
      collector: 'manual-corroboration-research',
      source_url: f.corroboratingSourceUrl,
      source_tier: f.corroboratingSourceTier === 'tier1' ? 'tier1' : 'tier2',
      title: f.corroboratingSourceTitle,
      content_text: f.corroboratingSourceText,
      content_hash: contentHash(f.corroboratingSourceText),
      char_count: f.corroboratingSourceText.length,
    });
  } else {
    missingSource.push(
      `${f.entityId}: draft has no corroborating source text (only ${f.corroboratingSourceUrl ?? 'none'})`,
    );
  }
}
if (missingSource.length > 0) {
  console.log('\nWARNING — entities with source gaps (review before proceeding):');
  missingSource.forEach((m) => console.log('  ', m));
}
writeFileSync(join(OUT_DIR, 'evidence-rows.json'), `${JSON.stringify(evidenceRows, null, 2)}\n`);
console.log(`Wrote ${evidenceRows.length} evidence rows -> ${join(OUT_DIR, 'evidence-rows.json')}`);

// --- 2. Landscape candidates fixture ---
const candidates: BulkFixtureCandidate[] = drafts.map((f) => {
  const primaryId = evidenceId(f.entityId, 'manual-tougaloo-research', f.primarySourceUrl!);
  const corroboratingId = f.corroboratingSourceUrl
    ? evidenceId(f.entityId, 'manual-corroboration-research', f.corroboratingSourceUrl)
    : null;
  const known = KNOWN[f.entityId];
  if (!known) throw new Error(`${f.entityId}: no known displayName/lat/lng — add it to KNOWN`);
  return {
    id: f.entityId,
    kind: 'place',
    displayName: known.displayName,
    summary: `Sundown-town sub-220 remediation candidate — staged for session-enrich apply.`,
    canonicalUrl: f.primarySourceUrl ?? undefined,
    lat: known.lat,
    lng: known.lng,
    discoveredAt: RETRIEVED_AT,
    researchLaneOnly: true,
    provenance: {
      wave: 'repo-2t04.8.1-2026-09',
      primarySourceUrl: f.primarySourceUrl,
      primarySourceEvidenceId: primaryId,
      corroboratingSourceUrl: f.corroboratingSourceUrl,
      corroboratingSourceEvidenceId: corroboratingId,
    },
  };
});

const fixture: BulkFixtureFile = {
  generatedAt: RETRIEVED_AT,
  metadata: {
    sourceProgramId: 'sundown-sub220-wave2',
    sourceProgramName: 'Sundown sub-220 remediation wave 2 (repo-2t04.8.1)',
    custodian: 'BlackStory editorial',
    license: 'research-use',
    attribution: 'Tougaloo College Historical Database of Sundown Towns',
    retrievedAt: RETRIEVED_AT,
    count: candidates.length,
    droppedCount: 0,
    methodologyNotes: [
      'repo-2t04.8.1: entities already live in bb_public.release_entities under 220 chars, ' +
        'staged into landscape_candidates for the first time so apply-enrichment-to-landscape.ts ' +
        'and publish-release-entities-incremental.ts --republish can update them in place.',
    ],
  },
  summary: {
    rowsFetched: findings.length,
    newCandidates: candidates.length,
    skippedUnusable: findings.length - candidates.length,
  },
  candidates,
};
const fixturePath = join(OUT_DIR, 'sundown-wave2-landscape-fixture.json');
writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Wrote ${candidates.length} landscape candidates -> ${fixturePath}`);

// --- 3. answers.jsonl for session-enrich-apply.ts ---
const answerLines: string[] = [];
for (const f of drafts) {
  const primaryId = evidenceId(f.entityId, 'manual-tougaloo-research', f.primarySourceUrl!);
  const corroboratingId = f.corroboratingSourceUrl
    ? evidenceId(f.entityId, 'manual-corroboration-research', f.corroboratingSourceUrl)
    : null;
  const resolveId = (source: 'primary' | 'corroborating'): string | null =>
    source === 'primary' ? primaryId : corroboratingId;

  const draft = {
    summary: f.summary,
    bestEffort: f.bestEffort,
    bestEffortReason: f.bestEffortReason,
    summaryCitations: f.summaryCitations
      .map((c) => ({ evidenceId: resolveId(c.source), quote: c.quote }))
      .filter((c): c is { evidenceId: string; quote: string } => c.evidenceId !== null),
    historicalContext: f.historicalContext,
    historicalContextCitations: f.historicalContextCitations
      .map((c) => ({ evidenceId: resolveId(c.source), quote: c.quote }))
      .filter((c): c is { evidenceId: string; quote: string } => c.evidenceId !== null),
    topicIds: f.topicIds,
    eraBuckets: f.eraBuckets,
    keywords: f.keywords,
  };
  answerLines.push(JSON.stringify({ entityId: f.entityId, rawContent: JSON.stringify(draft) }));
}
const answersPath = join(OUT_DIR, 'answers.jsonl');
writeFileSync(answersPath, `${answerLines.join('\n')}\n`);
console.log(`Wrote ${answerLines.length} answers -> ${answersPath}`);

// --- 4. Refusal / defer summary (for human review, not auto-terminal) ---
if (refused.length > 0) {
  console.log(
    '\nREFUSED (route to human/editorial review, repo-qrkv pattern — record NOT touched):',
  );
  refused.forEach((f) => console.log(`  ${f.entityId}: ${f.refusalReason ?? '(no reason given)'}`));
}
if (deferred.length > 0) {
  console.log('\nDEFERRED (re-offer next wave — record NOT touched):');
  deferred.forEach((f) =>
    console.log(`  ${f.entityId}: ${f.refusalReason ?? '(no reason given)'}`),
  );
}
writeFileSync(
  join(OUT_DIR, 'refused-deferred.json'),
  `${JSON.stringify({ refused, deferred }, null, 2)}\n`,
);
