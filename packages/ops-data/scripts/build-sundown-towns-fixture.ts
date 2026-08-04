/**
 * Convert the wave-1 sundown-towns research JSON into the bulk discovery fixture
 * shape so it loads through the existing, tested
 * load-bulk-candidates-to-supabase.ts path rather than a bespoke inserter.
 *
 * The research file is a bare array of curated town records (Tougaloo College
 * primary citation, optional corroborating sources, documented period, confidence).
 * Every record keeps its citations in `provenance`, so nothing is lost when the
 * committed research JSON is retired.
 *
 * Usage (repo root):
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/build-sundown-towns-fixture.ts
 *
 *   DRY_RUN=0 LOAD_BULK_CANDIDATES_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/load-bulk-candidates-to-supabase.ts \
 *     --lane=other --fixture=packages/ops-data/fixtures/discovery-candidates/bulk-sundown-towns-2026-07-28.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BulkFixtureCandidate, BulkFixtureFile } from './lib/bulk-candidates-supabase.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const SOURCE = join(
  REPO_ROOT,
  'packages/ops-data/fixtures/sundown-towns-research/wave-1-candidates.json',
);
const OUT = join(
  REPO_ROOT,
  'packages/ops-data/fixtures/discovery-candidates/bulk-sundown-towns-2026-07-28.json',
);
const RETRIEVED_AT = '2026-07-28T00:00:00.000Z';

type Citation = { readonly sourceLabel: string; readonly href: string };
type ResearchRow = {
  readonly townName: string;
  readonly county: string;
  readonly state: string;
  readonly tougalooConfidence: 'surely' | 'probable' | 'possible';
  readonly primaryCitation: Citation;
  readonly corroboratingCitations?: readonly Citation[];
  readonly documentedPeriod: string;
  readonly notes?: string;
  readonly confidenceCaveat?: string;
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const rows = Object.values(JSON.parse(readFileSync(SOURCE, 'utf8')) as Record<string, ResearchRow>);

const seen = new Set<string>();
const candidates: BulkFixtureCandidate[] = rows.map((row) => {
  const id = `sundown_${slug(row.townName)}_${slug(row.state)}`;
  if (seen.has(id)) throw new Error(`duplicate candidate id ${id}`);
  seen.add(id);
  if (!row.primaryCitation?.href) {
    throw new Error(`${row.townName}, ${row.state} has no primary citation`);
  }
  return {
    id,
    kind: 'place',
    displayName: `${row.townName}, ${row.state}`,
    summary:
      `Sundown town candidate (${row.tougalooConfidence}), documented ${row.documentedPeriod}` +
      `${row.county ? ` — ${row.county}` : ''}.`,
    canonicalUrl: row.primaryCitation.href,
    discoveredAt: RETRIEVED_AT,
    // Research lane only: a sundown-town designation is a contested historical
    // claim and must never auto-publish to a public surface.
    researchLaneOnly: true,
    provenance: {
      townName: row.townName,
      county: row.county,
      state: row.state,
      tougalooConfidence: row.tougalooConfidence,
      documentedPeriod: row.documentedPeriod,
      primaryCitation: row.primaryCitation,
      corroboratingCitations: row.corroboratingCitations ?? [],
      ...(row.notes ? { notes: row.notes } : {}),
      ...(row.confidenceCaveat ? { confidenceCaveat: row.confidenceCaveat } : {}),
    },
  };
});

const fixture: BulkFixtureFile = {
  generatedAt: RETRIEVED_AT,
  metadata: {
    sourceProgramId: 'tougaloo-sundown-towns',
    sourceProgramName: 'Tougaloo College Historical Database of Sundown Towns (wave 1)',
    custodian: 'Tougaloo College',
    license: 'research-use',
    attribution: 'Tougaloo College Historical Database of Sundown Towns',
    canonicalUrl: 'https://justice.tougaloo.edu/sundowntowns/',
    retrievedAt: RETRIEVED_AT,
    count: candidates.length,
    droppedCount: 0,
    methodologyNotes: [
      'Wave-1 curation; see fixtures/sundown-towns-research/wave-1-methodology.md.',
      'tougalooConfidence (surely/probable/possible) is carried per candidate in provenance.',
      'Research lane only — never auto-published.',
    ],
  },
  summary: { rowsFetched: rows.length, newCandidates: candidates.length, skippedUnusable: 0 },
  candidates,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Wrote ${OUT} (${candidates.length} candidates from ${rows.length} research rows)`);
