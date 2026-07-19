/**
 * The national population timeline SNAPSHOT: a single materialized projection doc
 * (`publicMeta/nationalPopulationTimeline`) holding the merged 1790–2020 Black-population
 * timeline plus precomputed adjacent-decade changes and source citations.
 *
 * Why a snapshot instead of live aggregation: this data changes about once a decade (plus rare
 * revisions), so paying N Firestore aggregate queries on every `/data` and homepage render is
 * waste. The builder (`buildNationalPopulationTimelineSnapshot`) runs as an operator command or
 * a semi-annual scheduled job; the page reads one small doc (`getNationalPopulationTimelineSnapshot`).
 *
 * Two disjoint lanes merge here (no double-counted or conflicting decade):
 *  - 1790–1990: the `censusNationalDecades` collection (twps0056, public domain), read whole —
 *    ~21 tiny docs, a bounded read, never a large scan.
 *  - 2000–2020: `getNationalPopulationByDecade` (national totals summed from `censusCountyDecades`).
 *
 * Every row carries its comparability metadata from the @repo/domain decade registry so the UI
 * can segment the 2000 measurement-regime boundary, stack free/enslaved for 1790–1860, and flag
 * the 1870 Southern undercount — without re-deriving any of that in the browser.
 */
import type { Firestore } from 'firebase-admin/firestore';
import {
  blackShareOfTotalPct,
  computeNationalPopulationChanges,
  getDecadeRaceCategoryBand,
  getPopulationDecadeMeta,
  sha256Json,
  type NationalPopulationChange,
  type NationalPopulationTimelineRow,
  type PopulationDecade,
} from '@repo/domain';
import { getServerFirestore } from '../server.js';
import { FIRESTORE_ROOT, firestorePaths } from '../firestore/paths.js';
import { censusNationalDecadeSchema } from './schema.js';
import { getNationalPopulationByDecade } from './national-stats.js';

/** A deduplicated citation surfaced with the timeline. */
export type NationalTimelineSource = {
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly label: string;
};

export type NationalPopulationTimelineSnapshot = {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly changes: readonly NationalPopulationChange[];
  readonly sources: readonly NationalTimelineSource[];
  /** Legitimate build-time instant (a materialized artifact, not a render-time read). */
  readonly generatedAt: string;
  /** sha256 of rows+changes (excludes generatedAt) — a rebuild over unchanged data hashes equal. */
  readonly contentHash: string;
};

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  'us-census-historical-race-1790-1990':
    'U.S. Census Bureau, Working Paper 56 (Historical Census Statistics on Population Totals by Race, 1790–1990)',
};

function labelForSource(sourceId: string): string {
  return SOURCE_LABELS[sourceId] ?? 'U.S. Census Bureau, Decennial Census';
}

/** Reads the historical lane (1790–1990) whole — a bounded ~21-doc read. */
export async function readHistoricalNationalRows(
  firestore: Firestore,
): Promise<NationalPopulationTimelineRow[]> {
  const snap = await firestore.collection(FIRESTORE_ROOT.censusNationalDecades).get();
  const rows: NationalPopulationTimelineRow[] = [];
  for (const docSnap of snap.docs) {
    const doc = censusNationalDecadeSchema.parse(docSnap.data());
    const meta = getPopulationDecadeMeta(doc.decade);
    if (!meta) continue;
    rows.push({
      decade: doc.decade as PopulationDecade,
      year: meta.year,
      totalPopulation: doc.totalPopulation,
      blackPopulation: doc.blackPopulation,
      freeBlackPopulation: doc.freeBlackPopulation ?? null,
      enslavedBlackPopulation: doc.enslavedBlackPopulation ?? null,
      blackShareOfTotalPct: blackShareOfTotalPct(doc.blackPopulation, doc.totalPopulation),
      raceCategoryLabel: getDecadeRaceCategoryBand(doc.decade)?.raceCategoryLabel ?? 'Black',
      nationalSource: meta.nationalSource,
      sourceId: doc.source,
      sourceUrl: doc.sourceUrl,
      opensDefinitionBoundary: meta.opensDefinitionBoundary,
      southernUndercountCaveat: meta.southernUndercountCaveat,
      hasFreeEnslavedSplit: meta.hasFreeEnslavedSplit,
    });
  }
  return rows;
}

/** Maps the modern county-sum lane (2000–2020) into timeline rows. */
export async function readModernNationalRows(
  firestore: Firestore,
): Promise<NationalPopulationTimelineRow[]> {
  const byDecade = await getNationalPopulationByDecade(firestore);
  const rows: NationalPopulationTimelineRow[] = [];
  for (const entry of byDecade) {
    const meta = getPopulationDecadeMeta(entry.decade);
    if (!meta) continue;
    rows.push({
      decade: entry.decade as PopulationDecade,
      year: meta.year,
      totalPopulation: entry.totalPopulation,
      blackPopulation: entry.blackPopulation,
      freeBlackPopulation: null,
      enslavedBlackPopulation: null,
      blackShareOfTotalPct: blackShareOfTotalPct(entry.blackPopulation, entry.totalPopulation),
      raceCategoryLabel:
        getDecadeRaceCategoryBand(entry.decade)?.raceCategoryLabel ??
        'Black or African American alone',
      nationalSource: meta.nationalSource,
      sourceId: entry.source,
      sourceUrl: entry.sourceUrl,
      opensDefinitionBoundary: meta.opensDefinitionBoundary,
      southernUndercountCaveat: meta.southernUndercountCaveat,
      hasFreeEnslavedSplit: meta.hasFreeEnslavedSplit,
    });
  }
  return rows;
}

/** Merges both lanes into an ascending, deduplicated timeline (later lane never overwrites — the
 * lanes are disjoint by construction; a same-decade collision is a data error and is dropped
 * toward the historical lane deterministically). */
export function mergeTimelineRows(
  historical: readonly NationalPopulationTimelineRow[],
  modern: readonly NationalPopulationTimelineRow[],
): NationalPopulationTimelineRow[] {
  const byDecade = new Map<string, NationalPopulationTimelineRow>();
  for (const row of historical) byDecade.set(row.decade, row);
  for (const row of modern) if (!byDecade.has(row.decade)) byDecade.set(row.decade, row);
  return [...byDecade.values()].sort((a, b) => a.year - b.year);
}

function dedupeSources(rows: readonly NationalPopulationTimelineRow[]): NationalTimelineSource[] {
  const byId = new Map<string, NationalTimelineSource>();
  for (const row of rows) {
    if (!byId.has(row.sourceId)) {
      byId.set(row.sourceId, {
        sourceId: row.sourceId,
        sourceUrl: row.sourceUrl,
        label: labelForSource(row.sourceId),
      });
    }
  }
  return [...byId.values()];
}

/** Assembles the full snapshot (rows + changes + sources + deterministic contentHash). */
export async function buildNationalPopulationTimelineSnapshot(
  firestore: Firestore = getServerFirestore(),
  now: () => string = () => new Date().toISOString(),
): Promise<NationalPopulationTimelineSnapshot> {
  const [historical, modern] = await Promise.all([
    readHistoricalNationalRows(firestore),
    readModernNationalRows(firestore),
  ]);
  const rows = mergeTimelineRows(historical, modern);
  const changes = computeNationalPopulationChanges(rows);
  const sources = dedupeSources(rows);
  const contentHash = sha256Json({ rows, changes }).digest;
  return { rows, changes, sources, generatedAt: now(), contentHash };
}

/** Writes the single materialized snapshot doc (idempotent: skips write when contentHash matches). */
export async function writeNationalPopulationTimelineSnapshot(
  snapshot: NationalPopulationTimelineSnapshot,
  firestore: Firestore = getServerFirestore(),
): Promise<'created' | 'updated' | 'unchanged'> {
  const ref = firestore.doc(firestorePaths.publicNationalPopulationTimeline());
  const existing = await ref.get();
  if (
    existing.exists &&
    (existing.data() as { contentHash?: string }).contentHash === snapshot.contentHash
  ) {
    return 'unchanged';
  }
  await ref.set(snapshot);
  return existing.exists ? 'updated' : 'created';
}

const SNAPSHOT_CACHE_TTL_MS = 15 * 60 * 1000;
let snapshotCache:
  | { readonly expiresAt: number; readonly value: NationalPopulationTimelineSnapshot | null }
  | undefined;

/**
 * Reads the materialized snapshot doc (one small read, module-cached for 15 min). Returns null
 * when the snapshot has not been built yet — callers render an empty state rather than falling
 * back to a live full aggregation.
 */
export async function getNationalPopulationTimelineSnapshot(
  firestore: Firestore = getServerFirestore(),
): Promise<NationalPopulationTimelineSnapshot | null> {
  if (snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.value;
  }
  let value: NationalPopulationTimelineSnapshot | null;
  try {
    const ref = firestore.doc(firestorePaths.publicNationalPopulationTimeline());
    const snap = await ref.get();
    value = snap.exists ? (snap.data() as NationalPopulationTimelineSnapshot) : null;
  } catch {
    value = null;
  }
  snapshotCache = { expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS, value };
  return value;
}

/** Test seam: clears the module cache. */
export function __resetNationalTimelineSnapshotCache(): void {
  snapshotCache = undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { getFirestore } = await import('firebase-admin/firestore');
  const { createServerFirebaseApp } = await import('../server.js');
  const { app } = createServerFirebaseApp(process.env);
  const firestore = getFirestore(app);
  const snapshot = await buildNationalPopulationTimelineSnapshot(firestore);
  const outcome = await writeNationalPopulationTimelineSnapshot(snapshot, firestore);
  console.log(
    JSON.stringify(
      {
        outcome,
        rows: snapshot.rows.length,
        changes: snapshot.changes.length,
        contentHash: snapshot.contentHash,
      },
      null,
      2,
    ),
  );
}
