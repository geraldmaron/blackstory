/**
 * Convert the two legacy discovery run artifacts into the bulk discovery fixture
 * shape so they load through the tested load-bulk-candidates-to-supabase.ts path.
 *
 * Neither is reproducible: gap-fill was written by find-catalog-entity-gaps.ts,
 * which no longer exists in the repo, and the wikidata run artifact is a merge of
 * prior runs. Their promoted candidates are already entities (149 gap_* rows are
 * in the active release), but the un-promoted remainder is the research backlog
 * and exists nowhere else, so it moves to bb_research.landscape_candidates before
 * the committed JSON is retired.
 *
 * Usage (repo root):
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/build-discovery-run-fixtures.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BulkFixtureCandidate, BulkFixtureFile } from './lib/bulk-candidates-supabase.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const FIXTURE_DIR = join(REPO_ROOT, 'packages/ops-data/fixtures/discovery-candidates');

type GapRow = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly discoveredAt: string;
  readonly gapFill?: Readonly<Record<string, unknown>>;
};

type RunRow = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly wikidataId?: string;
  readonly aliases?: readonly string[];
  readonly sourceQuery?: string;
  readonly canonicalUrl?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly discoveredAt: string;
};

function writeFixture(name: string, fixture: BulkFixtureFile): void {
  const out = join(FIXTURE_DIR, name);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`Wrote ${out} (${fixture.candidates.length} candidates)`);
}

// --- gap-fill -------------------------------------------------------------
const gapSource = JSON.parse(
  readFileSync(join(FIXTURE_DIR, 'gap-fill-2026-07-20T01-17-31-097Z.json'), 'utf8'),
) as { readonly candidates: readonly GapRow[]; readonly generatedBy?: string };

/**
 * Merge rows sharing an id. The generator slugified name variants to the same id
 * without merging them — "W.E.B. Du Bois" and "W. E. B. Du Bois" both became
 * gap_w_e_b_du_bois with disjoint mention sets. Keeping the first would silently
 * drop the other's mentions, so union the mention evidence instead.
 */
function mergeGapRows(rows: readonly GapRow[]): readonly GapRow[] {
  const byId = new Map<string, GapRow>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, row);
      continue;
    }
    const union = (key: string): readonly unknown[] => [
      ...new Set([
        ...((existing.gapFill?.[key] as readonly unknown[] | undefined) ?? []),
        ...((row.gapFill?.[key] as readonly unknown[] | undefined) ?? []),
      ]),
    ];
    const mentionedByEntityIds = union('mentionedByEntityIds');
    byId.set(row.id, {
      ...existing,
      summary: `Mentioned by ${mentionedByEntityIds.length} catalog record(s), merged from ${existing.displayName} / ${row.displayName}.`,
      gapFill: {
        ...existing.gapFill,
        mentionedByEntityIds,
        mentionContexts: union('mentionContexts'),
        mergedDisplayNames: [existing.displayName, row.displayName],
      },
    });
  }
  return [...byId.values()];
}

const gapCandidates: BulkFixtureCandidate[] = mergeGapRows(gapSource.candidates).map((row) => ({
  id: row.id,
  kind: row.kind,
  displayName: row.displayName,
  summary: row.summary,
  discoveredAt: row.discoveredAt,
  researchLaneOnly: true,
  provenance: {
    generatedBy: gapSource.generatedBy ?? 'find-catalog-entity-gaps.ts',
    ...(row.gapFill ? { gapFill: row.gapFill } : {}),
  },
}));

writeFixture('bulk-gapfill-2026-07-20.json', {
  generatedAt: '2026-07-20T01:17:31.097Z',
  metadata: {
    sourceProgramId: 'catalog-gap-fill',
    sourceProgramName: 'Catalog entity gap fill (wave 1)',
    retrievedAt: '2026-07-20T01:17:31.097Z',
    count: gapCandidates.length,
    droppedCount: 0,
    methodologyNotes: [
      'Candidates derived from entity mentions inside existing catalog records.',
      'Generator find-catalog-entity-gaps.ts has since been removed; not reproducible.',
      'Research lane only — promotion is a separate reviewed decision.',
    ],
  },
  summary: { rowsFetched: gapCandidates.length, newCandidates: gapCandidates.length },
  candidates: gapCandidates,
});

// --- wikidata network expansion run ---------------------------------------
const runSource = JSON.parse(
  readFileSync(join(FIXTURE_DIR, 'run-2026-07-22T05-23-52-222Z.json'), 'utf8'),
) as {
  readonly candidates: readonly RunRow[];
  readonly generatedAt?: string;
  readonly summary?: Readonly<Record<string, unknown>>;
};

const runCandidates: BulkFixtureCandidate[] = runSource.candidates.map((row) => ({
  id: row.id,
  kind: row.kind,
  displayName: row.displayName,
  summary: row.summary,
  ...(row.canonicalUrl ? { canonicalUrl: row.canonicalUrl } : {}),
  ...(typeof row.lat === 'number' ? { lat: row.lat } : {}),
  ...(typeof row.lng === 'number' ? { lng: row.lng } : {}),
  discoveredAt: row.discoveredAt,
  researchLaneOnly: true,
  provenance: {
    ...(row.wikidataId ? { wikidataId: row.wikidataId } : {}),
    ...(row.aliases?.length ? { aliases: row.aliases } : {}),
    ...(row.sourceQuery ? { sourceQuery: row.sourceQuery } : {}),
  },
}));

writeFixture('bulk-wikidata-run-2026-07-22.json', {
  generatedAt: runSource.generatedAt ?? '2026-07-22T05:23:52.222Z',
  metadata: {
    sourceProgramId: 'wikidata-network-expansion',
    sourceProgramName: 'Wikidata network expansion (2026-07-22 merged run)',
    canonicalUrl: 'https://www.wikidata.org/',
    license: 'CC0-1.0',
    attribution: 'Wikidata contributors',
    retrievedAt: runSource.generatedAt ?? '2026-07-22T05:23:52.222Z',
    count: runCandidates.length,
    droppedCount: 0,
    methodologyNotes: [
      'Merged discovery run output; carries prior-run candidates plus newly found rows.',
      'Research lane only — promotion is a separate reviewed decision.',
    ],
  },
  summary: { rowsFetched: runCandidates.length, newCandidates: runCandidates.length },
  candidates: runCandidates,
});
