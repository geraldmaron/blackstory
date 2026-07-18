
/**
 * National-rollup readers for the public `/data` page (apps/web). Every function here
 * computes an aggregate (never a per-record dump) via Firestore's server-side
 * `AggregateField` sum/count so a page render never scans tens of thousands of docs.
 *
 * These are Admin-SDK reads (`getServerFirestore`), which is why collections that stay
 * CLOSED to the client SDK in firestore.rules (acsTractProfiles, hateCrimeCountyYears,
 * opportunityAtlasTracts) are still readable here — Admin SDK bypasses security rules.
 * `holcAreas` is deliberately NOT read by anything in this file: its vector dataset is
 * CC BY-NC-SA (see launch-corpora.ts's corrected mapping-inequality-holc entry) and stays
 * off every public surface until a rights review clears a specific treatment.
 *
 * FBI hate crime data (`getHateCrimeYearSummary`) NEVER returns a bare incident count —
 * every value ships with `reportingAgencyCount` and the matching year's state-participation
 * rows, per the no-false-absence rule documented in `../external/ucr-schema.ts`. Callers
 * must render both together; there is no "just the number" export.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { AggregateField } from 'firebase-admin/firestore';
import { getServerFirestore } from '../server.js';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import { censusCountyDecadeSchema, type CensusCountyDecadeDecade } from './schema.js';
import { hateCrimeCountyYearSchema, ucrStateParticipationSchema } from '../external/ucr-schema.js';

export type NationalPopulationByDecade = {
  readonly decade: CensusCountyDecadeDecade;
  readonly countyCount: number;
  readonly totalPopulation: number;
  readonly blackPopulation: number;
  readonly source: string;
  readonly sourceUrl: string;
};

/** One sum-aggregation query per decade — reads zero full documents. */
export async function getNationalPopulationByDecade(
  firestore: Firestore = getServerFirestore(),
): Promise<readonly NationalPopulationByDecade[]> {
  const decades: readonly CensusCountyDecadeDecade[] = ['2000', '2010', '2020'];
  const results: NationalPopulationByDecade[] = [];
  for (const decade of decades) {
    const collection = firestore
      .collection(FIRESTORE_ROOT.censusCountyDecades)
      .where('decade', '==', decade);
    const [aggregateSnap, sampleSnap] = await Promise.all([
      collection
        .aggregate({
          countyCount: AggregateField.count(),
          totalPopulation: AggregateField.sum('totalPopulation'),
          blackPopulation: AggregateField.sum('blackPopulation'),
        })
        .get(),
      collection.limit(1).get(),
    ]);
    if (aggregateSnap.data().countyCount === 0 || sampleSnap.empty) continue;
    const sample = censusCountyDecadeSchema.parse(sampleSnap.docs[0]!.data());
    results.push({
      decade,
      countyCount: aggregateSnap.data().countyCount,
      totalPopulation: aggregateSnap.data().totalPopulation ?? 0,
      blackPopulation: aggregateSnap.data().blackPopulation ?? 0,
      source: sample.source,
      sourceUrl: sample.sourceUrl,
    });
  }
  return results;
}

export type AcsCoverageSummary = {
  readonly vintage: string;
  readonly countyCount: number;
  readonly tractCount: number;
  readonly source: string;
  readonly sourceUrl: string;
};

/** County + tract coverage counts for the latest ACS 5-year vintage — a coverage summary,
 * not a per-county browser (that's the Explore map's job once black-book-vxz's choropleth
 * layer lands). */
export async function getAcsCoverageSummary(
  firestore: Firestore = getServerFirestore(),
): Promise<AcsCoverageSummary | undefined> {
  const countyCollection = firestore.collection(FIRESTORE_ROOT.acsCountyProfiles);
  const tractCollection = firestore.collection(FIRESTORE_ROOT.acsTractProfiles);
  const [countyAgg, tractAgg, sample] = await Promise.all([
    countyCollection.aggregate({ n: AggregateField.count() }).get(),
    tractCollection.aggregate({ n: AggregateField.count() }).get(),
    countyCollection.limit(1).get(),
  ]);
  if (sample.empty) return undefined;
  const doc = sample.docs[0]!.data() as { vintage?: string; source?: string; sourceUrl?: string };
  if (!doc.vintage || !doc.source || !doc.sourceUrl) return undefined;
  return {
    vintage: doc.vintage,
    countyCount: countyAgg.data().n,
    tractCount: tractAgg.data().n,
    source: doc.source,
    sourceUrl: doc.sourceUrl,
  };
}

export type HateCrimeYearSummary = {
  readonly year: string;
  readonly incidents: number;
  readonly antiBlackIncidents: number;
  /** Distinct county-years with at least one reporting agency this year — a coverage
   * signal, not a severity signal. */
  readonly reportingCountyYears: number;
  /** National participation rate for the year, when the FBI participation table publishes
   * one; undefined (never 0) when the year isn't covered by ucrStateParticipation. */
  readonly nationalParticipatingAgenciesPct?: number;
  readonly source: string;
  readonly sourceUrl: string;
};

/** Summarizes ONE year at a time, always paired with that year's participation rate — the
 * no-false-absence contract from ../external/ucr-schema.ts's module doc. Never call this for
 * a range and sum the incident counts across years: participation coverage changed so much
 * over 1991–2024 that a cumulative total would read as a trend line for a reporting-coverage
 * artifact, not for underlying incidents. */
export async function getHateCrimeYearSummary(
  year: string,
  firestore: Firestore = getServerFirestore(),
): Promise<HateCrimeYearSummary | undefined> {
  const yearCollection = firestore
    .collection(FIRESTORE_ROOT.hateCrimeCountyYears)
    .where('year', '==', year);
  const [aggregateSnap, sampleSnap, participationSnap] = await Promise.all([
    yearCollection
      .aggregate({
        countyYears: AggregateField.count(),
        incidents: AggregateField.sum('incidents'),
        antiBlackIncidents: AggregateField.sum('antiBlackIncidents'),
      })
      .get(),
    yearCollection.limit(1).get(),
    firestore.collection(FIRESTORE_ROOT.ucrStateParticipation).where('year', '==', year).get(),
  ]);
  if (aggregateSnap.data().countyYears === 0 || sampleSnap.empty) return undefined;
  const sample = hateCrimeCountyYearSchema.parse(sampleSnap.docs[0]!.data());

  const participationRows = participationSnap.docs
    .map((snap) => ucrStateParticipationSchema.parse(snap.data()))
    .filter((row) => row.totalAgencies !== undefined && row.participatingAgencies !== undefined);
  const totalAgencies = participationRows.reduce((sum, row) => sum + (row.totalAgencies ?? 0), 0);
  const participatingAgencies = participationRows.reduce(
    (sum, row) => sum + (row.participatingAgencies ?? 0),
    0,
  );
  const nationalParticipatingAgenciesPct =
    totalAgencies > 0 ? Math.round((participatingAgencies / totalAgencies) * 1000) / 10 : undefined;

  return {
    year,
    incidents: aggregateSnap.data().incidents ?? 0,
    antiBlackIncidents: aggregateSnap.data().antiBlackIncidents ?? 0,
    reportingCountyYears: aggregateSnap.data().countyYears,
    ...(nationalParticipatingAgenciesPct !== undefined ? { nationalParticipatingAgenciesPct } : {}),
    source: sample.source,
    sourceUrl: sample.sourceUrl,
  };
}

export type OpportunityAtlasCoverageSummary = {
  readonly tractCount: number;
  readonly source: string;
  readonly sourceUrl: string;
  readonly license: string;
};

/** Coverage count only — percentile-rank outcome data is not something this file averages
 * into a national figure (averaging ranks across differently-populated tracts would itself
 * be a fabricated statistic; see the module doc on ../external/schema.ts). */
export async function getOpportunityAtlasCoverageSummary(
  firestore: Firestore = getServerFirestore(),
): Promise<OpportunityAtlasCoverageSummary | undefined> {
  const collection = firestore.collection('opportunityAtlasTracts');
  const [agg, sample] = await Promise.all([
    collection.aggregate({ n: AggregateField.count() }).get(),
    collection.limit(1).get(),
  ]);
  if (sample.empty) return undefined;
  const doc = sample.docs[0]!.data() as { source?: string; sourceUrl?: string; license?: string };
  if (!doc.source || !doc.sourceUrl || !doc.license) return undefined;
  return { tractCount: agg.data().n, source: doc.source, sourceUrl: doc.sourceUrl, license: doc.license };
}
