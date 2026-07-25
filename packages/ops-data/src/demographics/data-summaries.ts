/**
 * Materialized `/data` demographics summaries in `publicMeta`: state population rollups
 * (2000–2020), Opportunity Atlas coverage histogram, and twps0056 historical state-lane
 * coverage counts.
 *
 * Why snapshots: `/data` SSG was full-scanning `opportunityAtlasTracts` (~72k) and
 * `censusCountyDecades` (~9.6k) on every App Hosting build. Operators rebuild via this CLI or
 * ingest/load hooks; page render uses one point-get per summary (15 min process cache, no scan
 * fallback at request/build time).
 */
import type { Firestore } from 'firebase-admin/firestore';
import { sha256Json } from '@repo/domain';
import { getServerFirestore } from '../server.js';
import { FIRESTORE_ROOT, firestorePaths } from '../firestore/paths.js';
import { censusCountyDecadeSchema } from './schema.js';
import {
  aggregateCountiesByState,
  aggregateOpportunityAtlasCoverage,
  publicSourceUrl,
  type HistoricalStatePopulationCoverage,
  type OpportunityAtlasCoverageSummary,
  type StatePopulationByDecade,
} from './national-stats.js';

export type StatePopulationByDecadeSnapshot = {
  readonly rows: readonly StatePopulationByDecade[];
  readonly generatedAt: string;
  readonly contentHash: string;
};

export type OpportunityAtlasCoverageSnapshot = OpportunityAtlasCoverageSummary & {
  readonly generatedAt: string;
  readonly contentHash: string;
};

export type HistoricalStatePopulationCoverageSnapshot = HistoricalStatePopulationCoverage & {
  readonly generatedAt: string;
  readonly contentHash: string;
};

const SNAPSHOT_CACHE_TTL_MS = 15 * 60 * 1000;

type SnapshotCache<T> = { readonly expiresAt: number; readonly value: T | null } | undefined;

let statePopulationCache: SnapshotCache<StatePopulationByDecadeSnapshot>;
let opportunityAtlasCache: SnapshotCache<OpportunityAtlasCoverageSnapshot>;
let historicalStateCoverageCache: SnapshotCache<HistoricalStatePopulationCoverageSnapshot>;

async function writeSnapshotDoc<T extends { contentHash: string }>(
  refPath: string,
  snapshot: T,
  firestore: Firestore,
): Promise<'created' | 'updated' | 'unchanged'> {
  const ref = firestore.doc(refPath);
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

/** Operator-only: scans county-decade docs and rolls up state totals for 2000/2010/2020. */
export async function buildStatePopulationByDecadeSnapshot(
  firestore: Firestore = getServerFirestore(),
  now: () => string = () => new Date().toISOString(),
): Promise<StatePopulationByDecadeSnapshot> {
  const decades = ['2000', '2010', '2020'] as const;
  const rows: StatePopulationByDecade[] = [];
  for (const decade of decades) {
    const snap = await firestore
      .collection(FIRESTORE_ROOT.censusCountyDecades)
      .where('decade', '==', decade)
      .get();
    if (snap.empty) continue;
    const counties = snap.docs.map((doc) => censusCountyDecadeSchema.parse(doc.data()));
    rows.push(...aggregateCountiesByState(counties, decade));
  }
  const contentHash = sha256Json({ rows }).digest;
  return { rows, generatedAt: now(), contentHash };
}

export async function writeStatePopulationByDecadeSnapshot(
  snapshot: StatePopulationByDecadeSnapshot,
  firestore: Firestore = getServerFirestore(),
): Promise<'created' | 'updated' | 'unchanged'> {
  const outcome = await writeSnapshotDoc(
    firestorePaths.publicStatePopulationByDecade(),
    snapshot,
    firestore,
  );
  statePopulationCache = undefined;
  return outcome;
}

/** Point-get for `/data` — returns null when the snapshot has not been built yet. */
export async function getStatePopulationByDecadeSnapshot(
  firestore: Firestore = getServerFirestore(),
): Promise<StatePopulationByDecadeSnapshot | null> {
  if (statePopulationCache && statePopulationCache.expiresAt > Date.now()) {
    return statePopulationCache.value;
  }
  let value: StatePopulationByDecadeSnapshot | null;
  try {
    const snap = await firestore.doc(firestorePaths.publicStatePopulationByDecade()).get();
    value = snap.exists ? (snap.data() as StatePopulationByDecadeSnapshot) : null;
  } catch {
    value = null;
  }
  statePopulationCache = { expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS, value };
  return value;
}

/** Operator-only: scans all Opportunity Atlas tract outcome fields for coverage histograms. */
export async function buildOpportunityAtlasCoverageSnapshot(
  firestore: Firestore = getServerFirestore(),
  now: () => string = () => new Date().toISOString(),
): Promise<OpportunityAtlasCoverageSnapshot | undefined> {
  const collection = firestore.collection(FIRESTORE_ROOT.opportunityAtlasTracts);
  const [sample, snap] = await Promise.all([
    collection.limit(1).get(),
    collection.select('outcomes').get(),
  ]);
  if (sample.empty) return undefined;
  const doc = sample.docs[0]!.data() as { source?: string; sourceUrl?: string; license?: string };
  if (!doc.source || !doc.sourceUrl || !doc.license) return undefined;

  const tracts = snap.docs.map((row) => ({
    outcomes: (row.data().outcomes ?? {}) as Parameters<
      typeof aggregateOpportunityAtlasCoverage
    >[0][number]['outcomes'],
  }));
  const aggregate = aggregateOpportunityAtlasCoverage(tracts);
  const payload = {
    tractCount: aggregate.tractCount,
    outcomeFieldCoverage: aggregate.outcomeFieldCoverage,
    kfrBlackP25Histogram: aggregate.kfrBlackP25Histogram,
    source: doc.source,
    sourceUrl: publicSourceUrl({ source: doc.source, sourceUrl: doc.sourceUrl }),
    license: doc.license,
  };
  const contentHash = sha256Json(payload).digest;
  return { ...payload, generatedAt: now(), contentHash };
}

export async function writeOpportunityAtlasCoverageSnapshot(
  snapshot: OpportunityAtlasCoverageSnapshot,
  firestore: Firestore = getServerFirestore(),
): Promise<'created' | 'updated' | 'unchanged'> {
  const outcome = await writeSnapshotDoc(
    firestorePaths.publicOpportunityAtlasCoverage(),
    snapshot,
    firestore,
  );
  opportunityAtlasCache = undefined;
  return outcome;
}

export async function getOpportunityAtlasCoverageSnapshot(
  firestore: Firestore = getServerFirestore(),
): Promise<OpportunityAtlasCoverageSnapshot | null> {
  if (opportunityAtlasCache && opportunityAtlasCache.expiresAt > Date.now()) {
    return opportunityAtlasCache.value;
  }
  let value: OpportunityAtlasCoverageSnapshot | null;
  try {
    const snap = await firestore.doc(firestorePaths.publicOpportunityAtlasCoverage()).get();
    value = snap.exists ? (snap.data() as OpportunityAtlasCoverageSnapshot) : null;
  } catch {
    value = null;
  }
  opportunityAtlasCache = { expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS, value };
  return value;
}

/** Operator-only: bounded scan of twps0056 state-lane docs for coverage metadata. */
export async function buildHistoricalStatePopulationCoverageSnapshot(
  firestore: Firestore = getServerFirestore(),
  now: () => string = () => new Date().toISOString(),
): Promise<HistoricalStatePopulationCoverageSnapshot | undefined> {
  const { AggregateField } = await import('firebase-admin/firestore');
  const collection = firestore.collection(FIRESTORE_ROOT.censusStateDecades);
  const [countAgg, sample] = await Promise.all([
    collection.aggregate({ n: AggregateField.count() }).get(),
    collection.limit(1).get(),
  ]);
  const rowCount = countAgg.data().n;
  if (rowCount === 0 || sample.empty) return undefined;

  const sampleDoc = sample.docs[0]!.data() as {
    source?: string;
    sourceUrl?: string;
  };
  if (!sampleDoc.source || !sampleDoc.sourceUrl) return undefined;

  const snap = await collection.select('stateFips', 'decade').get();
  const states = new Set<string>();
  const decades = new Set<string>();
  for (const doc of snap.docs) {
    const data = doc.data() as { stateFips?: string; decade?: string };
    if (data.stateFips) states.add(data.stateFips);
    if (data.decade) decades.add(data.decade);
  }
  const sortedDecades = [...decades].sort();
  const decadeMin = sortedDecades[0];
  const decadeMax = sortedDecades.at(-1);
  if (!decadeMin || !decadeMax) return undefined;

  const payload = {
    rowCount,
    stateCount: states.size,
    decadeMin,
    decadeMax,
    source: sampleDoc.source,
    sourceUrl: publicSourceUrl({
      source: sampleDoc.source,
      sourceUrl: sampleDoc.sourceUrl,
    }),
  };
  const contentHash = sha256Json(payload).digest;
  return { ...payload, generatedAt: now(), contentHash };
}

export async function writeHistoricalStatePopulationCoverageSnapshot(
  snapshot: HistoricalStatePopulationCoverageSnapshot,
  firestore: Firestore = getServerFirestore(),
): Promise<'created' | 'updated' | 'unchanged'> {
  const outcome = await writeSnapshotDoc(
    firestorePaths.publicHistoricalStatePopulationCoverage(),
    snapshot,
    firestore,
  );
  historicalStateCoverageCache = undefined;
  return outcome;
}

export async function getHistoricalStatePopulationCoverageSnapshot(
  firestore: Firestore = getServerFirestore(),
): Promise<HistoricalStatePopulationCoverageSnapshot | null> {
  if (historicalStateCoverageCache && historicalStateCoverageCache.expiresAt > Date.now()) {
    return historicalStateCoverageCache.value;
  }
  let value: HistoricalStatePopulationCoverageSnapshot | null;
  try {
    const snap = await firestore
      .doc(firestorePaths.publicHistoricalStatePopulationCoverage())
      .get();
    value = snap.exists ? (snap.data() as HistoricalStatePopulationCoverageSnapshot) : null;
  } catch {
    value = null;
  }
  historicalStateCoverageCache = {
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
    value,
  };
  return value;
}

export type RebuildDataSummarySnapshotsResult = {
  readonly statePopulationByDecade: 'created' | 'updated' | 'unchanged' | 'skipped';
  readonly opportunityAtlasCoverage: 'created' | 'updated' | 'unchanged' | 'skipped';
  readonly historicalStatePopulationCoverage: 'created' | 'updated' | 'unchanged' | 'skipped';
};

/** Builds and writes all three `/data` summary snapshots (operator CLI + ingest hooks). */
export async function rebuildAllDataSummarySnapshots(
  firestore: Firestore = getServerFirestore(),
  now: () => string = () => new Date().toISOString(),
): Promise<RebuildDataSummarySnapshotsResult> {
  const stateSnapshot = await buildStatePopulationByDecadeSnapshot(firestore, now);
  const stateOutcome = await writeStatePopulationByDecadeSnapshot(stateSnapshot, firestore);

  const oaSnapshot = await buildOpportunityAtlasCoverageSnapshot(firestore, now);
  const oaOutcome = oaSnapshot
    ? await writeOpportunityAtlasCoverageSnapshot(oaSnapshot, firestore)
    : 'skipped';

  const histSnapshot = await buildHistoricalStatePopulationCoverageSnapshot(firestore, now);
  const histOutcome = histSnapshot
    ? await writeHistoricalStatePopulationCoverageSnapshot(histSnapshot, firestore)
    : 'skipped';

  return {
    statePopulationByDecade: stateOutcome,
    opportunityAtlasCoverage: oaOutcome,
    historicalStatePopulationCoverage: histOutcome,
  };
}

/** Test seam: clears module caches for all three summaries. */
export function __resetDataSummarySnapshotCaches(): void {
  statePopulationCache = undefined;
  opportunityAtlasCache = undefined;
  historicalStateCoverageCache = undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
    const { getFirestore } = await import('firebase-admin/firestore');
    const { createServerFirebaseApp } = await import('../server.js');
    const { app } = createServerFirebaseApp(process.env);
    const firestore = getFirestore(app);
    const result = await rebuildAllDataSummarySnapshots(firestore);
    console.log(JSON.stringify(result, null, 2));
  })();
}
