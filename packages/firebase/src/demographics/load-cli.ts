
/**
 * Idempotent load/refresh CLI for the `censusCountyDecades` collection (black-book-vxz).
 *
 * Fetches total + Black population per county for each decennial vintage in
 * `CENSUS_DECENNIAL_VINTAGES` (2000 SF1, 2010 SF1, 2020 PL) via @blap/domain's
 * `fetchCountyPopulations`, and upserts one doc per county per decade. Structurally mirrors
 * `../jurisdictions/load-cli.ts`: every dependency (writer, fetch) is injected so
 * `runDemographicsLoad` is fully unit-testable, and only the `if (import.meta.url ...)` block
 * touches real infrastructure.
 *
 * Lane note: bead black-book-vxz suggested an operator-cli subcommand, but operator-cli's
 * promotion boundary (`commitOperatorIntake` only — see promotion-boundary.test.ts) forbids
 * direct Firestore bulk writes, so this follows the jurisdictions-loader lane instead: unit
 * tests against a fake writer; a human operator runs the live apply.
 *
 * Idempotency: `contentHash` covers only the stable statistic fields (not `retrievedAt`), so
 * an unchanged upstream row re-hashes identically and the writer reports `unchanged` without
 * touching the doc. Provenance: every doc satisfies `assertPublishedStatisticProvenance`
 * (public-numeric-policy category 3) and `sourceUrl` is always the Census Bureau
 * dataset landing page (owning-body surface). Machine fetch URLs stay on api.census.gov
 * and are never written into provenance.
 *
 * Run directly with tsx (CENSUS_API_KEY optional but recommended — keyless is capped):
 * CENSUS_API_KEY=... node --conditions development --import tsx \
 *   packages/firebase/src/demographics/load-cli.ts
 */
import {
  assertPublishedStatisticProvenance,
  buildProvenanceSourceUrl,
  fetchCountyPopulations,
  sha256Json,
  CENSUS_DECENNIAL_VINTAGES,
  type CensusDecennialVintage,
  type CountyDecadePopulation,
  type FetchLike,
} from '@blap/domain';
import { createServerFirebaseApp } from '../server.js';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import {
  censusCountyDecadeId,
  censusCountyDecadeSchema,
  parseCensusCountyDecadeDoc,
  type CensusCountyDecadeDoc,
} from './schema.js';

export type CensusCountyDecadeWriteOutcome = 'created' | 'updated' | 'unchanged';

export type CensusCountyDecadeWriter = {
  /** Upserts one doc idempotently (skip when `contentHash` matches) and reports the outcome. */
  upsert(doc: CensusCountyDecadeDoc): Promise<CensusCountyDecadeWriteOutcome>;
};

export type RunDemographicsLoadOptions = {
  readonly writer: CensusCountyDecadeWriter;
  readonly apiKey?: string;
  readonly fetchImpl?: FetchLike;
  readonly vintages?: readonly CensusDecennialVintage[];
  readonly now?: () => string;
};

export type RunDemographicsVintageSummary = {
  readonly decade: CensusDecennialVintage['decade'];
  readonly fetched: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: readonly string[];
};

export type RunDemographicsLoadSummary = {
  readonly vintages: readonly RunDemographicsVintageSummary[];
  readonly totalWritten: number;
};

/** The stable fields `contentHash` covers — everything except retrieval/write timestamps. */
export function censusCountyDecadeContentFields(
  row: CountyDecadePopulation,
  vintage: CensusDecennialVintage,
): Record<string, string | number> {
  return {
    fips5: row.fips5,
    decade: row.decade,
    countyName: row.countyName,
    totalPopulation: row.totalPopulation,
    blackPopulation: row.blackPopulation,
    source: vintage.sourceId,
    sourceUrl: buildProvenanceSourceUrl(vintage),
  };
}

export function buildCensusCountyDecadeDoc(
  row: CountyDecadePopulation,
  vintage: CensusDecennialVintage,
  nowIso: string,
): CensusCountyDecadeDoc {
  const doc: CensusCountyDecadeDoc = {
    id: censusCountyDecadeId(row.fips5, row.decade),
    fips5: row.fips5,
    stateFips: row.stateFips,
    countyFips: row.countyFips,
    countyName: row.countyName,
    decade: row.decade,
    totalPopulation: row.totalPopulation,
    blackPopulation: row.blackPopulation,
    source: vintage.sourceId,
    sourceUrl: buildProvenanceSourceUrl(vintage),
    retrievedAt: nowIso,
    contentHash: sha256Json(censusCountyDecadeContentFields(row, vintage)).digest,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  assertPublishedStatisticProvenance(doc);
  return censusCountyDecadeSchema.parse(doc);
}

export async function runDemographicsLoad(
  options: RunDemographicsLoadOptions,
): Promise<RunDemographicsLoadSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const vintages = options.vintages ?? CENSUS_DECENNIAL_VINTAGES;

  const summaries: RunDemographicsVintageSummary[] = [];
  let totalWritten = 0;

  for (const vintage of vintages) {
    const fetched = await fetchCountyPopulations(vintage, {
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const nowIso = now();

    for (const row of fetched.rows) {
      const doc = buildCensusCountyDecadeDoc(row, vintage, nowIso);
      const outcome = await options.writer.upsert(doc);
      if (outcome === 'created') created += 1;
      else if (outcome === 'updated') updated += 1;
      else unchanged += 1;
    }

    totalWritten += created + updated;
    summaries.push({
      decade: vintage.decade,
      fetched: fetched.rows.length,
      created,
      updated,
      unchanged,
      rejected: fetched.rejected,
    });
  }

  return { vintages: summaries, totalWritten };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { getFirestore } = await import('firebase-admin/firestore');

  const { app } = createServerFirebaseApp(process.env);
  const firestore = getFirestore(app);
  const collection = firestore.collection(FIRESTORE_ROOT.censusCountyDecades);

  const firestoreWriter: CensusCountyDecadeWriter = {
    async upsert(doc) {
      const snapshot = await collection.doc(doc.id).get();
      if (snapshot.exists) {
        const existing = parseCensusCountyDecadeDoc(snapshot.data());
        if (existing.contentHash === doc.contentHash) return 'unchanged';
        await collection.doc(doc.id).set({ ...doc, createdAt: existing.createdAt });
        return 'updated';
      }
      await collection.doc(doc.id).set(doc);
      return 'created';
    },
  };

  const summary = await runDemographicsLoad({
    writer: firestoreWriter,
    ...(process.env.CENSUS_API_KEY ? { apiKey: process.env.CENSUS_API_KEY } : {}),
  });

  console.log(JSON.stringify(summary, null, 2));
}
