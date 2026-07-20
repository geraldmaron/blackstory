
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

/** Coverage for the historical state lane (`censusStateDecades`, twps0056 Tables 15–65). */
export type HistoricalStatePopulationCoverage = {
  readonly rowCount: number;
  readonly stateCount: number;
  readonly decadeMin: string;
  readonly decadeMax: string;
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

/** Row/state/decade coverage for twps0056 state tables loaded into `censusStateDecades`. */
export async function getHistoricalStatePopulationCoverage(
  firestore: Firestore = getServerFirestore(),
): Promise<HistoricalStatePopulationCoverage | undefined> {
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

  // Bounded scan: ~900 docs — fine as Admin-SDK coverage, not a public client path.
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

  return {
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

/** Census state FIPS outside `US_STATES` (50 states + D.C.) — decennial county rollups still
 * include territories; public `/data` labels must not read as "State 72". */
export const US_TERRITORY_FIPS_NAMES: Readonly<Record<string, string>> = {
  '60': 'American Samoa',
  '66': 'Guam',
  '69': 'Northern Mariana Islands',
  '72': 'Puerto Rico',
  '78': 'U.S. Virgin Islands',
};

/** Merge domain `US_STATES` with territory FIPS for census rollups on `/data`. */
export function buildStateFipsNameMap(
  usStates: readonly { readonly fips: string; readonly name: string }[],
): Readonly<Record<string, string>> {
  return {
    ...Object.fromEntries(usStates.map((state) => [state.fips, state.name])),
    ...US_TERRITORY_FIPS_NAMES,
  };
}

export function resolveStateFipsName(
  stateFips: string,
  nameByFips: Readonly<Record<string, string>>,
): string {
  return nameByFips[stateFips] ?? `State ${stateFips}`;
}

/** Parallel per-year hate crime summaries — never sum incidents across years. */
export async function getHateCrimeYearSummaries(
  years: readonly string[],
  firestore: Firestore = getServerFirestore(),
): Promise<readonly HateCrimeYearSummary[]> {
  const results = await Promise.all(years.map((year) => getHateCrimeYearSummary(year, firestore)));
  return results
    .filter((row): row is HateCrimeYearSummary => row !== undefined)
    .sort((a, b) => Number(a.year) - Number(b.year));
}

/** Anti-Black share of reported incidents for one year — undefined when incidents are zero. */
export function hateCrimeAntiBlackShare(
  summary: Pick<HateCrimeYearSummary, 'incidents' | 'antiBlackIncidents'>,
): number | null {
  if (summary.incidents <= 0) {
    return null;
  }
  return summary.antiBlackIncidents / summary.incidents;
}

export type OpportunityAtlasOutcomeFieldCoverage = {
  readonly field: string;
  readonly label: string;
  readonly tractCount: number;
};

export type OpportunityAtlasHistogramBin = {
  readonly id: string;
  readonly label: string;
  readonly minInclusive: number;
  readonly maxExclusive: number;
  readonly tractCount: number;
};

export type OpportunityAtlasCoverageSummary = {
  readonly tractCount: number;
  readonly outcomeFieldCoverage: readonly OpportunityAtlasOutcomeFieldCoverage[];
  readonly kfrBlackP25Histogram: readonly OpportunityAtlasHistogramBin[];
  readonly source: string;
  readonly sourceUrl: string;
  readonly license: string;
};

/** Outcome fields surfaced on `/data` — counts only, never averaged percentile ranks. */
export const OPPORTUNITY_ATLAS_OUTCOME_FIELD_LABELS: Readonly<
  Record<
    | 'kfrPooledP25'
    | 'kfrPooledP75'
    | 'kfrBlackP25'
    | 'kfrWhiteP25'
    | 'jailBlackP25'
    | 'jailPooledP25',
    string
  >
> = {
  kfrPooledP25: 'Household income rank (pooled, parents p25)',
  kfrPooledP75: 'Household income rank (pooled, parents p75)',
  kfrBlackP25: 'Household income rank (Black children, parents p25)',
  kfrWhiteP25: 'Household income rank (white children, parents p25)',
  jailBlackP25: 'Incarceration rate (Black children, parents p25)',
  jailPooledP25: 'Incarceration rate (pooled, parents p25)',
};

/** Quintile bins on the Opportunity Atlas [0,1] percentile-rank scale for kfrBlackP25. */
export const KFR_BLACK_P25_HISTOGRAM_BINS: readonly Omit<OpportunityAtlasHistogramBin, 'tractCount'>[] =
  [
    { id: '0-20', label: '0–20th', minInclusive: 0, maxExclusive: 0.2 },
    { id: '20-40', label: '20–40th', minInclusive: 0.2, maxExclusive: 0.4 },
    { id: '40-60', label: '40–60th', minInclusive: 0.4, maxExclusive: 0.6 },
    { id: '60-80', label: '60–80th', minInclusive: 0.6, maxExclusive: 0.8 },
    { id: '80-100', label: '80–100th', minInclusive: 0.8, maxExclusive: 1.0000001 },
  ];

type OpportunityAtlasTractOutcomesLike = Partial<
  Record<keyof typeof OPPORTUNITY_ATLAS_OUTCOME_FIELD_LABELS, number>
>;

/** Pure aggregate for Opportunity Atlas coverage — histogram counts tracts, not people. */
export function aggregateOpportunityAtlasCoverage(
  tracts: readonly { readonly outcomes: OpportunityAtlasTractOutcomesLike }[],
): {
  readonly tractCount: number;
  readonly outcomeFieldCoverage: readonly OpportunityAtlasOutcomeFieldCoverage[];
  readonly kfrBlackP25Histogram: readonly OpportunityAtlasHistogramBin[];
} {
  const fieldCounts = Object.fromEntries(
    Object.keys(OPPORTUNITY_ATLAS_OUTCOME_FIELD_LABELS).map((field) => [field, 0]),
  ) as Record<keyof typeof OPPORTUNITY_ATLAS_OUTCOME_FIELD_LABELS, number>;
  const binCounts = Object.fromEntries(KFR_BLACK_P25_HISTOGRAM_BINS.map((bin) => [bin.id, 0])) as Record<
    string,
    number
  >;

  for (const tract of tracts) {
    for (const field of Object.keys(OPPORTUNITY_ATLAS_OUTCOME_FIELD_LABELS) as Array<
      keyof typeof OPPORTUNITY_ATLAS_OUTCOME_FIELD_LABELS
    >) {
      if (tract.outcomes[field] !== undefined) {
        fieldCounts[field] += 1;
      }
    }
    const rank = tract.outcomes.kfrBlackP25;
    if (rank !== undefined) {
      const bin =
        KFR_BLACK_P25_HISTOGRAM_BINS.find(
          (candidate) => rank >= candidate.minInclusive && rank < candidate.maxExclusive,
        ) ?? KFR_BLACK_P25_HISTOGRAM_BINS.at(-1);
      if (bin) {
        binCounts[bin.id] = (binCounts[bin.id] ?? 0) + 1;
      }
    }
  }

  return {
    tractCount: tracts.length,
    outcomeFieldCoverage: (
      Object.keys(OPPORTUNITY_ATLAS_OUTCOME_FIELD_LABELS) as Array<
        keyof typeof OPPORTUNITY_ATLAS_OUTCOME_FIELD_LABELS
      >
    ).map((field) => ({
      field,
      label: OPPORTUNITY_ATLAS_OUTCOME_FIELD_LABELS[field],
      tractCount: fieldCounts[field],
    })),
    kfrBlackP25Histogram: KFR_BLACK_P25_HISTOGRAM_BINS.map((bin) => ({
      ...bin,
      tractCount: binCounts[bin.id] ?? 0,
    })),
  };
}

const OPPORTUNITY_ATLAS_COVERAGE_CACHE_TTL_MS = 15 * 60 * 1000;
let opportunityAtlasCoverageCache:
  | { readonly expiresAt: number; readonly value: OpportunityAtlasCoverageSummary }
  | undefined;

/** Coverage counts + kfrBlackP25 distribution bins — never averages percentile ranks nationally. */
export async function getOpportunityAtlasCoverageSummary(
  firestore: Firestore = getServerFirestore(),
): Promise<OpportunityAtlasCoverageSummary | undefined> {
  if (
    opportunityAtlasCoverageCache &&
    opportunityAtlasCoverageCache.expiresAt > Date.now()
  ) {
    return opportunityAtlasCoverageCache.value;
  }

  const collection = firestore.collection('opportunityAtlasTracts');
  const [sample, snap] = await Promise.all([collection.limit(1).get(), collection.select('outcomes').get()]);
  if (sample.empty) return undefined;
  const doc = sample.docs[0]!.data() as { source?: string; sourceUrl?: string; license?: string };
  if (!doc.source || !doc.sourceUrl || !doc.license) return undefined;

  const tracts = snap.docs.map((row) => ({
    outcomes: (row.data().outcomes ?? {}) as OpportunityAtlasTractOutcomesLike,
  }));
  const aggregate = aggregateOpportunityAtlasCoverage(tracts);
  const value: OpportunityAtlasCoverageSummary = {
    tractCount: aggregate.tractCount,
    outcomeFieldCoverage: aggregate.outcomeFieldCoverage,
    kfrBlackP25Histogram: aggregate.kfrBlackP25Histogram,
    source: doc.source,
    sourceUrl: publicSourceUrl({ source: doc.source, sourceUrl: doc.sourceUrl }),
    license: doc.license,
  };
  opportunityAtlasCoverageCache = {
    expiresAt: Date.now() + OPPORTUNITY_ATLAS_COVERAGE_CACHE_TTL_MS,
    value,
  };
  return value;
}
