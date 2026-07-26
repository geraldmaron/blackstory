/**
 * Public `/data` indicator series — chart-ready bundles aligned with Phase 1 / theme-impact
 * metric ids. Pure types and builders; apps/web reads Postgres or falls back to fixtures.
 */
import type { ThemeImpactThemeId } from './theme-impact-questions.js';

export type DataPageSourceRef = {
  readonly label: string;
  readonly url: string;
};

export type DataPageValueUnit = 'usd' | 'percent' | 'per_100k' | 'months';

export type DataPageRacePairPoint = {
  readonly label: string;
  readonly value: number;
  readonly unit: DataPageValueUnit;
};

/** Horizontal juxtaposition of two race slices for one place and period. */
export type DataPageRacePairSeries = {
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  readonly geographyLabel: string;
  readonly referencePeriod: string;
  readonly primary: DataPageRacePairPoint;
  readonly comparison: DataPageRacePairPoint;
  readonly ratioLabel?: string;
  readonly ratioValue?: number;
  readonly sources: readonly DataPageSourceRef[];
  readonly themeId?: ThemeImpactThemeId;
  readonly themeQuestionId?: string;
};

export type DataPageGroupedBarSeriesDef = {
  readonly id: string;
  readonly label: string;
  readonly fill: string;
};

export type DataPageGroupedBarPoint = {
  readonly period: string;
  readonly values: Readonly<Record<string, number>>;
};

/** Grouped vertical bars across periods (homeownership, HMDA denial, USSC sentences). */
export type DataPageGroupedBarSeries = {
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  readonly geographyLabel: string;
  readonly unit: DataPageValueUnit;
  readonly yAxisLabel: string;
  readonly series: readonly DataPageGroupedBarSeriesDef[];
  readonly points: readonly DataPageGroupedBarPoint[];
  readonly sources: readonly DataPageSourceRef[];
  readonly themeId?: ThemeImpactThemeId;
  readonly themeQuestionId?: string;
};

export type DataPageIndicatorBundle = {
  readonly wealthComparison: DataPageRacePairSeries;
  readonly wealthTrend?: DataPageGroupedBarSeries;
  readonly imprisonmentComparison: DataPageRacePairSeries;
  readonly cookHomeownership: DataPageGroupedBarSeries;
  readonly hmdaDenialRates: DataPageGroupedBarSeries;
  readonly federalDrugSentences: DataPageGroupedBarSeries;
  readonly costBurdenComparison: DataPageRacePairSeries;
  readonly generatedAt: string;
  readonly servedFrom: 'postgres' | 'fixture';
};

/** Minimal observation row for merging live warehouse reads into chart bundles. */
export type DataPageObservationRow = {
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly source: string;
  readonly sourceUrl: string;
};

const FEDERAL_RESERVE_SCF = {
  label: 'Board of Governors of the Federal Reserve System, Survey of Consumer Finances',
  url: 'https://www.federalreserve.gov/econres/scfindex.htm',
} as const;

const BJS_NPS = {
  label: 'Bureau of Justice Statistics, National Prisoner Statistics',
  url: 'https://bjs.ojp.gov/data-collection/nps',
} as const;

const NHGIS = {
  label: 'IPUMS NHGIS / U.S. Census decennial county tables',
  url: 'https://www.nhgis.org/citing-nhgis',
} as const;

const HMDA = {
  label: 'FFIEC Home Mortgage Disclosure Act Data Browser',
  url: 'https://ffiec.cfpb.gov/data-browser/',
} as const;

const HUD_CHAS = {
  label: 'HUD CHAS via Cook County Consolidated Plan Table 20',
  url: 'https://www.cookcountyil.gov/sites/g/files/ywwepo161/files/documents/2025-09/Cook%20County%20Consolidated%20Plan%202025-2029%20September%202025.pdf',
} as const;

const USSC = {
  label: 'United States Sentencing Commission Quick Facts',
  url: 'https://www.ussc.gov/research/quick-facts',
} as const;

/** Verified from Phase 1 reference fixtures via domain mappers (2026-07-22). */
export const DATA_PAGE_INDICATOR_FIXTURE_BUNDLE: DataPageIndicatorBundle = {
  generatedAt: '2026-07-22T00:00:00.000Z',
  servedFrom: 'fixture',
  wealthComparison: {
    id: 'wealth-scf-median-nation',
    title: 'Median family net worth, Black vs White',
    caption:
      'National median family net worth from the Survey of Consumer Finances, latest survey wave, in 2022 dollars. Wealth is measured at a point in time — not income — and reflects decades of policy and market context.',
    geographyLabel: 'United States',
    referencePeriod: '2022',
    primary: { label: 'Black families', value: 44_900, unit: 'usd' },
    comparison: { label: 'White non-Hispanic families', value: 285_000, unit: 'usd' },
    ratioLabel: 'White-to-Black wealth ratio',
    ratioValue: 6.3,
    sources: [FEDERAL_RESERVE_SCF],
    themeId: 'wealth_gap',
    themeQuestionId: 'Q3',
  },
  wealthTrend: {
    id: 'wealth-scf-median-trend-nation',
    title: 'Median family net worth since 1989',
    caption:
      'Every Survey of Consumer Finances wave, in 2022 dollars. The gap never closes: Black family wealth loses its 1990s and 2000s gains to the Great Recession and only passes its 2007 level after 2019. The Fed cautions that the 1989 Black sample is small — read that first pair as rough.',
    geographyLabel: 'United States',
    unit: 'usd',
    yAxisLabel: 'Median net worth (2022 dollars)',
    series: [
      { id: 'black', label: 'Black families', fill: 'var(--ds-viz-1)' },
      { id: 'white', label: 'White non-Hispanic families', fill: 'var(--ds-viz-2)' },
    ],
    points: [
      { period: '1989', values: { black: 9_200, white: 164_030 } },
      { period: '1992', values: { black: 20_510, white: 144_420 } },
      { period: '1995', values: { black: 21_130, white: 148_330 } },
      { period: '1998', values: { black: 28_260, white: 174_750 } },
      { period: '2001', values: { black: 32_450, white: 205_530 } },
      { period: '2004', values: { black: 32_090, white: 221_470 } },
      { period: '2007', values: { black: 30_140, white: 245_110 } },
      { period: '2010', values: { black: 21_800, white: 178_280 } },
      { period: '2013', values: { black: 16_780, white: 180_680 } },
      { period: '2016', values: { black: 21_090, white: 210_940 } },
      { period: '2019', values: { black: 27_970, white: 218_140 } },
      { period: '2022', values: { black: 44_900, white: 285_000 } },
    ],
    sources: [FEDERAL_RESERVE_SCF],
    themeId: 'wealth_gap',
    themeQuestionId: 'Q3',
  },
  imprisonmentComparison: {
    id: 'justice-bjs-imprisonment-md',
    title: 'State imprisonment rate, Black vs White residents',
    caption:
      'Maryland prisoners under state jurisdiction per 100,000 non-Hispanic Black and White residents — derived from BJS National Prisoner Statistics counts and Census population estimates. Rates are context for policy eras — not proof that any single law caused the gap.',
    geographyLabel: 'Maryland',
    referencePeriod: '2023',
    primary: { label: 'Black residents', value: 648, unit: 'per_100k' },
    comparison: { label: 'White residents', value: 119, unit: 'per_100k' },
    ratioLabel: 'Black-to-White rate ratio',
    ratioValue: 5.4,
    sources: [BJS_NPS],
    themeId: 'drug_policy_state',
    themeQuestionId: 'Q6',
  },
  cookHomeownership: {
    id: 'housing-nhgis-homeownership-cook',
    title: 'Homeownership by householder race, Cook County',
    caption:
      'Decennial Census county tenure tables: owner-occupied units divided by occupied units for Black alone and White alone householders. Labels changed across decades; bars show published counts, not interpolated gaps.',
    geographyLabel: 'Cook County, Illinois',
    unit: 'percent',
    yAxisLabel: 'Homeownership rate',
    series: [
      { id: 'black', label: 'Black householder', fill: 'var(--ds-viz-1)' },
      { id: 'white', label: 'White householder', fill: 'var(--ds-viz-2)' },
    ],
    points: [
      { period: '1990', values: { black: 37.1, white: 63.8 } },
      { period: '2000', values: { black: 42, white: 66.7 } },
      { period: '2010', values: { black: 41.2, white: 67.2 } },
    ],
    sources: [NHGIS],
    themeId: 'redlining',
    themeQuestionId: 'Q3',
  },
  hmdaDenialRates: {
    id: 'credit-hmda-denial-cook',
    title: 'Mortgage denial rate by applicant race, Cook County',
    caption:
      'Share of home mortgage applications denied — denials divided by originations, approvals not accepted, and denials (HMDA actions taken 1–3), all loan purposes — for Black and White applicants. County aggregates — not individual lending decisions.',
    geographyLabel: 'Cook County, Illinois',
    unit: 'percent',
    yAxisLabel: 'Denial rate',
    series: [
      { id: 'black', label: 'Black applicants', fill: 'var(--ds-viz-1)' },
      { id: 'white', label: 'White applicants', fill: 'var(--ds-viz-2)' },
    ],
    points: [
      { period: '2018', values: { black: 41.5, white: 22.8 } },
      { period: '2019', values: { black: 37.1, white: 18.3 } },
      { period: '2020', values: { black: 29.1, white: 12.7 } },
      { period: '2021', values: { black: 29.1, white: 12.4 } },
      { period: '2022', values: { black: 35.1, white: 18.5 } },
      { period: '2023', values: { black: 39, white: 22.1 } },
    ],
    sources: [HMDA],
    themeId: 'redlining',
    themeQuestionId: 'Q3',
  },
  federalDrugSentences: {
    id: 'justice-ussc-crack-powder-nation',
    title: 'Federal cocaine trafficking sentences, crack vs powder',
    caption:
      'Average sentence length in months for federal crack and powder cocaine trafficking offenses (USSC Quick Facts). The 100-to-1 powder–crack weight ratio era is history; gaps narrowed but did not vanish overnight.',
    geographyLabel: 'United States (federal)',
    unit: 'months',
    yAxisLabel: 'Average sentence (months)',
    series: [
      { id: 'crack', label: 'Crack cocaine', fill: 'var(--ds-viz-1)' },
      { id: 'powder', label: 'Powder cocaine', fill: 'var(--ds-viz-2)' },
    ],
    points: [
      { period: 'FY2016', values: { crack: 79, powder: 70 } },
      { period: 'FY2020', values: { crack: 74, powder: 66 } },
      { period: 'FY2023', values: { crack: 60, powder: 68 } },
    ],
    sources: [USSC],
    themeId: 'drug_policy_state',
    themeQuestionId: 'Q6',
  },
  costBurdenComparison: {
    id: 'housing-chas-cost-burden-cook',
    title: 'Cost-burdened households, Black vs White',
    caption:
      'Share of occupied households paying more than 30% of income on housing (HUD CHAS Table 20, suburban Cook jurisdiction in the Consolidated Plan). Place-specific affordability context — not a national average.',
    geographyLabel: 'Suburban Cook County, Illinois',
    referencePeriod: '2016–2020 ACS',
    primary: { label: 'Black non-Hispanic householders', value: 44.6, unit: 'percent' },
    comparison: { label: 'White non-Hispanic householders', value: 31.3, unit: 'percent' },
    ratioLabel: 'Black minus White burden gap',
    ratioValue: 13.3,
    sources: [HUD_CHAS],
    themeId: 'redlining',
    themeQuestionId: 'Q4',
  },
};

function sourceFromObservation(row: DataPageObservationRow): DataPageSourceRef {
  return { label: row.source, url: row.sourceUrl };
}

function mergeSources(
  base: readonly DataPageSourceRef[],
  extra: readonly DataPageSourceRef[],
): readonly DataPageSourceRef[] {
  const seen = new Set<string>();
  const out: DataPageSourceRef[] = [];
  for (const ref of [...base, ...extra]) {
    const key = ref.url.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

/**
 * Latest reference period present in BOTH metrics of a race pair. Warehouse rows
 * arrive in arbitrary period order; taking the first match silently rendered the
 * oldest survey wave (e.g. SCF 1989) as the "at a glance" number.
 */
function latestPairedObservations(
  rows: readonly DataPageObservationRow[],
  primaryMetricId: string,
  comparisonMetricId: string,
  jurisdictionId: string,
  pinnedPeriod?: string,
): { primary: DataPageObservationRow; comparison: DataPageObservationRow } | undefined {
  const primaryRows = observationsByMetric(rows, primaryMetricId, jurisdictionId);
  const comparisonRows = observationsByMetric(rows, comparisonMetricId, jurisdictionId);
  for (let index = primaryRows.length - 1; index >= 0; index -= 1) {
    const candidate = primaryRows[index];
    if (candidate === undefined) continue;
    if (pinnedPeriod !== undefined && candidate.referencePeriod !== pinnedPeriod) continue;
    const match = comparisonRows.find((row) => row.referencePeriod === candidate.referencePeriod);
    if (match) {
      return { primary: candidate, comparison: match };
    }
  }
  return undefined;
}

function observationsByMetric(
  rows: readonly DataPageObservationRow[],
  metricId: string,
  jurisdictionId?: string,
): readonly DataPageObservationRow[] {
  return rows
    .filter(
      (row) =>
        row.metricId === metricId &&
        (jurisdictionId === undefined || row.jurisdictionId === jurisdictionId),
    )
    .sort((a, b) => a.referencePeriod.localeCompare(b.referencePeriod));
}

/** Overlay live warehouse observations onto the fixture bundle when present. */
export function mergeDataPageIndicatorBundle(
  base: DataPageIndicatorBundle,
  rows: readonly DataPageObservationRow[],
): DataPageIndicatorBundle {
  if (rows.length === 0) {
    return base;
  }

  let wealth = base.wealthComparison;
  const scfPair = latestPairedObservations(
    rows,
    'scf-median-wealth-black-nation',
    'scf-median-wealth-white-nation',
    'nation:US',
  );
  if (scfPair) {
    const ratioValue =
      scfPair.primary.estimate > 0
        ? Math.round((scfPair.comparison.estimate / scfPair.primary.estimate) * 10) / 10
        : undefined;
    wealth = {
      ...wealth,
      referencePeriod: scfPair.primary.referencePeriod,
      primary: { ...wealth.primary, value: scfPair.primary.estimate },
      comparison: { ...wealth.comparison, value: scfPair.comparison.estimate },
      ...(ratioValue !== undefined ? { ratioValue } : {}),
      sources: mergeSources(wealth.sources, [
        sourceFromObservation(scfPair.primary),
        sourceFromObservation(scfPair.comparison),
      ]),
    };
  }

  let wealthTrend = base.wealthTrend;
  if (wealthTrend) {
    const scfBlackAll = observationsByMetric(rows, 'scf-median-wealth-black-nation', 'nation:US');
    const scfWhiteAll = observationsByMetric(rows, 'scf-median-wealth-white-nation', 'nation:US');
    if (scfBlackAll.length > 0 && scfWhiteAll.length > 0) {
      const whiteByPeriod = new Map(scfWhiteAll.map((row) => [row.referencePeriod, row]));
      const points = scfBlackAll
        .filter((row) => whiteByPeriod.has(row.referencePeriod))
        .map((row) => ({
          period: row.referencePeriod,
          values: {
            black: row.estimate,
            white: whiteByPeriod.get(row.referencePeriod)?.estimate ?? 0,
          },
        }));
      if (points.length > 0) {
        wealthTrend = {
          ...wealthTrend,
          points,
          sources: mergeSources(
            wealthTrend.sources,
            [...scfBlackAll, ...scfWhiteAll].map(sourceFromObservation),
          ),
        };
      }
    }
  }

  let imprisonment = base.imprisonmentComparison;
  const bjsPair = latestPairedObservations(
    rows,
    'imprisonment-rate-black-state',
    'imprisonment-rate-white-state',
    'state:24',
  );
  if (bjsPair) {
    const ratioValue =
      bjsPair.comparison.estimate > 0
        ? Math.round((bjsPair.primary.estimate / bjsPair.comparison.estimate) * 10) / 10
        : undefined;
    imprisonment = {
      ...imprisonment,
      referencePeriod: bjsPair.primary.referencePeriod,
      primary: { ...imprisonment.primary, value: bjsPair.primary.estimate },
      comparison: { ...imprisonment.comparison, value: bjsPair.comparison.estimate },
      ...(ratioValue !== undefined ? { ratioValue } : {}),
      sources: mergeSources(imprisonment.sources, [
        sourceFromObservation(bjsPair.primary),
        sourceFromObservation(bjsPair.comparison),
      ]),
    };
  }

  let cookHomeownership = base.cookHomeownership;
  const blackHo = observationsByMetric(
    rows,
    'nhgis-homeownership-rate-black-county',
    'county:17031',
  );
  const whiteHo = observationsByMetric(
    rows,
    'nhgis-homeownership-rate-white-county',
    'county:17031',
  );
  if (blackHo.length > 0 && whiteHo.length > 0) {
    const periods = [...new Set(blackHo.map((row) => row.referencePeriod))].sort();
    cookHomeownership = {
      ...cookHomeownership,
      points: periods.map((period) => ({
        period,
        values: {
          black: blackHo.find((row) => row.referencePeriod === period)?.estimate ?? 0,
          white: whiteHo.find((row) => row.referencePeriod === period)?.estimate ?? 0,
        },
      })),
      sources: mergeSources(
        cookHomeownership.sources,
        [...blackHo, ...whiteHo].map(sourceFromObservation),
      ),
    };
  }

  let hmdaDenialRates = base.hmdaDenialRates;
  const hmdaBlack = observationsByMetric(rows, 'hmda-denial-rate-black-county', 'county:17031');
  const hmdaWhite = observationsByMetric(rows, 'hmda-denial-rate-white-county', 'county:17031');
  if (hmdaBlack.length > 0 && hmdaWhite.length > 0) {
    const periods = [...new Set(hmdaBlack.map((row) => row.referencePeriod))].sort();
    hmdaDenialRates = {
      ...hmdaDenialRates,
      points: periods.map((period) => ({
        period,
        values: {
          black: hmdaBlack.find((row) => row.referencePeriod === period)?.estimate ?? 0,
          white: hmdaWhite.find((row) => row.referencePeriod === period)?.estimate ?? 0,
        },
      })),
      sources: mergeSources(
        hmdaDenialRates.sources,
        [...hmdaBlack, ...hmdaWhite].map(sourceFromObservation),
      ),
    };
  }

  let federalDrugSentences = base.federalDrugSentences;
  const crackSentences = observationsByMetric(
    rows,
    'ussc-average-sentence-months-crack-nation',
    'nation:US',
  );
  const powderSentences = observationsByMetric(
    rows,
    'ussc-average-sentence-months-powder-nation',
    'nation:US',
  );
  if (crackSentences.length > 0 && powderSentences.length > 0) {
    const crackPeriods = new Set(crackSentences.map((row) => row.referencePeriod));
    const sharedPeriods = powderSentences
      .map((row) => row.referencePeriod)
      .filter((period) => crackPeriods.has(period))
      .sort();
    if (sharedPeriods.length > 0) {
      federalDrugSentences = {
        ...federalDrugSentences,
        points: sharedPeriods.map((period) => ({
          period: period.startsWith('FY') ? period : `FY${period}`,
          values: {
            crack: crackSentences.find((row) => row.referencePeriod === period)?.estimate ?? 0,
            powder: powderSentences.find((row) => row.referencePeriod === period)?.estimate ?? 0,
          },
        })),
        sources: mergeSources(
          federalDrugSentences.sources,
          [...crackSentences, ...powderSentences].map(sourceFromObservation),
        ),
      };
    }
  }

  let costBurdenComparison = base.costBurdenComparison;
  // Pinned: the 2016-2020 vintage is the suburban-Cook Table 20 tabulation the card's
  // caption describes (and carries verifiable household counts). The 2017-2021 rows in
  // the warehouse are a different universe (all Cook County, CHAS Table 9) — do not mix.
  const chasPair = latestPairedObservations(
    rows,
    'hud-chas-cost-burden-black-county',
    'hud-chas-cost-burden-white-county',
    'county:17031',
    '2016-2020',
  );
  if (chasPair) {
    costBurdenComparison = {
      ...costBurdenComparison,
      primary: { ...costBurdenComparison.primary, value: chasPair.primary.estimate },
      comparison: { ...costBurdenComparison.comparison, value: chasPair.comparison.estimate },
      ratioValue:
        Math.round((chasPair.primary.estimate - chasPair.comparison.estimate) * 10) / 10,
      sources: mergeSources(costBurdenComparison.sources, [
        sourceFromObservation(chasPair.primary),
        sourceFromObservation(chasPair.comparison),
      ]),
    };
  }

  return {
    ...base,
    wealthComparison: wealth,
    ...(wealthTrend !== undefined ? { wealthTrend } : {}),
    imprisonmentComparison: imprisonment,
    cookHomeownership,
    hmdaDenialRates,
    federalDrugSentences,
    costBurdenComparison,
    servedFrom: 'postgres',
    generatedAt: new Date().toISOString(),
  };
}

export function isDataPageIndicatorBundle(value: unknown): value is DataPageIndicatorBundle {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as DataPageIndicatorBundle;
  return (
    typeof candidate.generatedAt === 'string' &&
    candidate.wealthComparison !== undefined &&
    candidate.cookHomeownership !== undefined &&
    Array.isArray(candidate.cookHomeownership.points)
  );
}
