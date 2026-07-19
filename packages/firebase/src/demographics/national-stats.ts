
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
 *
 * Display remap: older Firestore docs may still store API/download URLs as `sourceUrl`.
 * `publicSourceUrl` rewrites those to owning-body landing pages for the UI until re-ingest
 * stamps the corrected provenance.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { AggregateField } from 'firebase-admin/firestore';
import { computeGrowthRecord } from '@repo/domain';
import { getServerFirestore } from '../server.js';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import {
  censusCountyDecadeSchema,
  type CensusCountyDecadeDecade,
  type CensusCountyDecadeDoc,
} from './schema.js';
import { hateCrimeCountyYearSchema, ucrStateParticipationSchema } from '../external/ucr-schema.js';

const CENSUS_HOMEPAGE_BY_DECADE: Readonly<Record<CensusCountyDecadeDecade, string>> = {
  '2000': 'https://www.census.gov/data/datasets/2000/dec/summary-file-1.html',
  '2010': 'https://www.census.gov/data/datasets/2010/dec/summary-file-1.html',
  '2020': 'https://www.census.gov/data/datasets/2020/dec/pl-94171.html',
};

const ACS_HOMEPAGE = 'https://www.census.gov/programs-surveys/acs';
const FBI_HATE_CRIME_HOMEPAGE = 'https://ucr.fbi.gov/hate-crime';
const OPPORTUNITY_ATLAS_HOMEPAGE = 'https://opportunityinsights.org/data/';

/**
 * Maps persisted provenance URLs (or source ids) to owning-body pages for public citations.
 * Machine API/download URLs must not appear as clickable sources in the UI.
 */
export function publicSourceUrl(input: {
  readonly source: string;
  readonly sourceUrl: string;
  readonly decade?: CensusCountyDecadeDecade;
}): string {
  const { source, sourceUrl, decade } = input;
  if (decade && CENSUS_HOMEPAGE_BY_DECADE[decade]) {
    return CENSUS_HOMEPAGE_BY_DECADE[decade];
  }
  if (
    source.startsWith('us-census-decennial') ||
    (sourceUrl.includes('api.census.gov/data/20') && sourceUrl.includes('/dec/'))
  ) {
    if (source.includes('2000') || sourceUrl.includes('/2000/')) return CENSUS_HOMEPAGE_BY_DECADE['2000'];
    if (source.includes('2010') || sourceUrl.includes('/2010/')) return CENSUS_HOMEPAGE_BY_DECADE['2010'];
    if (source.includes('2020') || sourceUrl.includes('/2020/')) return CENSUS_HOMEPAGE_BY_DECADE['2020'];
  }
  if (source.startsWith('us-census-acs') || sourceUrl.includes('/acs/acs')) {
    return ACS_HOMEPAGE;
  }
  if (
    source.includes('fbi-ucr') ||
    sourceUrl.includes('cde.ucr.cjis.gov') ||
    sourceUrl.includes('ucr.fbi.gov')
  ) {
    return FBI_HATE_CRIME_HOMEPAGE;
  }
  if (
    source.includes('opportunity') ||
    sourceUrl.includes('opportunityinsights') ||
    sourceUrl.includes('opportunityinsightsstatic')
  ) {
    return OPPORTUNITY_ATLAS_HOMEPAGE;
  }
  if (sourceUrl.includes('api.census.gov') || sourceUrl.includes('signedurl') || sourceUrl.includes('.amazonaws.com')) {
    // Fail closed toward known hubs rather than exposing a raw machine endpoint.
    if (sourceUrl.includes('census.gov')) return ACS_HOMEPAGE;
  }
  return sourceUrl;
}

export type NationalPopulationByDecade = {
  readonly decade: CensusCountyDecadeDecade;
  readonly countyCount: number;
  readonly totalPopulation: number;
  readonly blackPopulation: number;
  readonly source: string;
  readonly sourceUrl: string;
};

export type PopulationDecadeChange = {
  readonly fromDecade: CensusCountyDecadeDecade;
  readonly toDecade: CensusCountyDecadeDecade;
  readonly blackAbsoluteChange: number;
  readonly blackPercentChange: number | null;
  readonly shareFrom: number;
  readonly shareTo: number;
  readonly shareChangePp: number;
  readonly comparabilityNote: string;
  readonly source: string;
  readonly sourceUrl: string;
};

export type StatePopulationByDecade = {
  readonly stateFips: string;
  readonly decade: CensusCountyDecadeDecade;
  readonly countyCount: number;
  readonly totalPopulation: number;
  readonly blackPopulation: number;
};

export type StatePopulationChange = {
  readonly stateFips: string;
  readonly fromDecade: CensusCountyDecadeDecade;
  readonly toDecade: CensusCountyDecadeDecade;
  readonly blackAbsoluteChange: number;
  readonly blackPercentChange: number | null;
  readonly shareFrom: number;
  readonly shareTo: number;
  readonly shareChangePp: number;
  readonly blackPopulationFrom: number;
  readonly blackPopulationTo: number;
  readonly totalPopulationFrom: number;
  readonly totalPopulationTo: number;
};

export const POPULATION_DECADE_COMPARABILITY_NOTE =
  'Black alone (Census race table) across 2000–2020 SF1/PL vintages; county boundary changes can affect local Δ — see demographics comparability matrix.';

function blackPopulationShare(blackPopulation: number, totalPopulation: number): number {
  return totalPopulation === 0 ? 0 : (blackPopulation / totalPopulation) * 100;
}

/** Rolls county-decade rows up to state totals for one decennial vintage. */
export function aggregateCountiesByState(
  counties: readonly Pick<CensusCountyDecadeDoc, 'stateFips' | 'totalPopulation' | 'blackPopulation'>[],
  decade: CensusCountyDecadeDecade,
): StatePopulationByDecade[] {
  const byState = new Map<
    string,
    { countyCount: number; totalPopulation: number; blackPopulation: number }
  >();
  for (const county of counties) {
    const existing = byState.get(county.stateFips) ?? {
      countyCount: 0,
      totalPopulation: 0,
      blackPopulation: 0,
    };
    byState.set(county.stateFips, {
      countyCount: existing.countyCount + 1,
      totalPopulation: existing.totalPopulation + county.totalPopulation,
      blackPopulation: existing.blackPopulation + county.blackPopulation,
    });
  }
  return [...byState.entries()]
    .map(([stateFips, aggregate]) => ({
      stateFips,
      decade,
      countyCount: aggregate.countyCount,
      totalPopulation: aggregate.totalPopulation,
      blackPopulation: aggregate.blackPopulation,
    }))
    .sort((a, b) => a.stateFips.localeCompare(b.stateFips));
}

/** Pure helper for national or state rollups — uses domain growth math for Black population Δ. */
export function computePopulationDecadeChange(input: {
  readonly fromDecade: CensusCountyDecadeDecade;
  readonly toDecade: CensusCountyDecadeDecade;
  readonly blackPopulationFrom: number;
  readonly blackPopulationTo: number;
  readonly totalPopulationFrom: number;
  readonly totalPopulationTo: number;
  readonly source: string;
  readonly sourceUrl: string;
}): PopulationDecadeChange {
  const growth = computeGrowthRecord(
    { observationId: `us_${input.fromDecade}_black`, estimate: input.blackPopulationFrom },
    { observationId: `us_${input.toDecade}_black`, estimate: input.blackPopulationTo },
  );
  const shareFrom = blackPopulationShare(input.blackPopulationFrom, input.totalPopulationFrom);
  const shareTo = blackPopulationShare(input.blackPopulationTo, input.totalPopulationTo);
  return {
    fromDecade: input.fromDecade,
    toDecade: input.toDecade,
    blackAbsoluteChange: growth.absoluteChange,
    blackPercentChange: growth.percentChange,
    shareFrom,
    shareTo,
    shareChangePp: shareTo - shareFrom,
    comparabilityNote: POPULATION_DECADE_COMPARABILITY_NOTE,
    source: input.source,
    sourceUrl: input.sourceUrl,
  };
}

export function computeStatePopulationChange(
  from: StatePopulationByDecade,
  to: StatePopulationByDecade,
): StatePopulationChange {
  const growth = computeGrowthRecord(
    {
      observationId: `us_${from.stateFips}_${from.decade}_black`,
      estimate: from.blackPopulation,
    },
    {
      observationId: `us_${to.stateFips}_${to.decade}_black`,
      estimate: to.blackPopulation,
    },
  );
  const shareFrom = blackPopulationShare(from.blackPopulation, from.totalPopulation);
  const shareTo = blackPopulationShare(to.blackPopulation, to.totalPopulation);
  return {
    stateFips: from.stateFips,
    fromDecade: from.decade,
    toDecade: to.decade,
    blackAbsoluteChange: growth.absoluteChange,
    blackPercentChange: growth.percentChange,
    shareFrom,
    shareTo,
    shareChangePp: shareTo - shareFrom,
    blackPopulationFrom: from.blackPopulation,
    blackPopulationTo: to.blackPopulation,
    totalPopulationFrom: from.totalPopulation,
    totalPopulationTo: to.totalPopulation,
  };
}

export function computeNationalPopulationChangesFromDecades(
  rows: readonly NationalPopulationByDecade[],
): PopulationDecadeChange[] {
  const sorted = [...rows].sort((a, b) => Number(a.decade) - Number(b.decade));
  const changes: PopulationDecadeChange[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const from = sorted[index - 1]!;
    const to = sorted[index]!;
    changes.push(
      computePopulationDecadeChange({
        fromDecade: from.decade,
        toDecade: to.decade,
        blackPopulationFrom: from.blackPopulation,
        blackPopulationTo: to.blackPopulation,
        totalPopulationFrom: from.totalPopulation,
        totalPopulationTo: to.totalPopulation,
        source: to.source,
        sourceUrl: to.sourceUrl,
      }),
    );
  }
  return changes;
}

export function computeStatePopulationChangesFromDecades(
  rows: readonly StatePopulationByDecade[],
  fromDecade: CensusCountyDecadeDecade,
  toDecade: CensusCountyDecadeDecade,
): StatePopulationChange[] {
  const fromRows = new Map(
    rows.filter((row) => row.decade === fromDecade).map((row) => [row.stateFips, row]),
  );
  const toRows = new Map(
    rows.filter((row) => row.decade === toDecade).map((row) => [row.stateFips, row]),
  );
  const changes: StatePopulationChange[] = [];
  for (const [stateFips, fromRow] of fromRows) {
    const toRow = toRows.get(stateFips);
    if (!toRow) continue;
    changes.push(computeStatePopulationChange(fromRow, toRow));
  }
  return changes.sort(
    (a, b) => Math.abs(b.blackAbsoluteChange) - Math.abs(a.blackAbsoluteChange),
  );
}

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
      sourceUrl: publicSourceUrl({ source: sample.source, sourceUrl: sample.sourceUrl, decade }),
    });
  }
  return results;
}

/** Adjacent-decade national Black population change for 2000→2010 and 2010→2020. */
export async function getNationalPopulationChanges(
  firestore: Firestore = getServerFirestore(),
): Promise<readonly PopulationDecadeChange[]> {
  try {
    const byDecade = await getNationalPopulationByDecade(firestore);
    return computeNationalPopulationChangesFromDecades(byDecade);
  } catch {
    return [];
  }
}

/**
 * State rollups for each loaded decennial vintage. Firestore aggregate queries cannot group by
 * `stateFips`, so this streams county docs once per decade (~3k rows/vintage) and aggregates in
 * memory — acceptable for Admin SDK server reads on the public `/data` page.
 */
export async function getStatePopulationByDecade(
  firestore: Firestore = getServerFirestore(),
): Promise<readonly StatePopulationByDecade[]> {
  try {
    const decades: readonly CensusCountyDecadeDecade[] = ['2000', '2010', '2020'];
    const results: StatePopulationByDecade[] = [];
    for (const decade of decades) {
      const snap = await firestore
        .collection(FIRESTORE_ROOT.censusCountyDecades)
        .where('decade', '==', decade)
        .get();
      if (snap.empty) continue;
      const counties = snap.docs.map((doc) => censusCountyDecadeSchema.parse(doc.data()));
      results.push(...aggregateCountiesByState(counties, decade));
    }
    return results;
  } catch {
    return [];
  }
}

/** State-level decade change ranked by absolute Black population change (largest movers first). */
export async function getStatePopulationChanges(
  fromDecade: CensusCountyDecadeDecade,
  toDecade: CensusCountyDecadeDecade,
  firestore: Firestore = getServerFirestore(),
): Promise<readonly StatePopulationChange[]> {
  try {
    const rows = await getStatePopulationByDecade(firestore);
    return computeStatePopulationChangesFromDecades(rows, fromDecade, toDecade);
  } catch {
    return [];
  }
}

export type AcsCoverageSummary = {
  readonly vintage: string;
  readonly countyCount: number;
  readonly tractCount: number;
  readonly source: string;
  readonly sourceUrl: string;
};

/** County + tract coverage counts for the latest ACS 5-year vintage — a coverage summary,
 * not a per-county browser (that's the Explore map's job once the related workstream's choropleth
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
    sourceUrl: publicSourceUrl({ source: doc.source, sourceUrl: doc.sourceUrl }),
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
    sourceUrl: publicSourceUrl({ source: sample.source, sourceUrl: sample.sourceUrl }),
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
  return {
    tractCount: agg.data().n,
    source: doc.source,
    sourceUrl: publicSourceUrl({ source: doc.source, sourceUrl: doc.sourceUrl }),
    license: doc.license,
  };
}
