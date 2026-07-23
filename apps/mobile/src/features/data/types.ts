/**
 * Mobile-local types for the Data screen — mirror web `/data` (DataSections) contracts
 * without importing `@repo/domain` (ADR-021 / mobile isolation).
 */

export type DataValueUnit = 'usd' | 'percent' | 'per_100k' | 'months';

export type DataSourceRef = {
  readonly label: string;
  readonly url: string;
};

export type DataRacePairPoint = {
  readonly label: string;
  readonly value: number;
  readonly unit: DataValueUnit;
};

/** Two-slice juxtaposition for one place and period (wealth, justice, cost burden). */
export type DataRacePairSeries = {
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  readonly geographyLabel: string;
  readonly referencePeriod: string;
  readonly primary: DataRacePairPoint;
  readonly comparison: DataRacePairPoint;
  readonly ratioLabel?: string;
  readonly ratioValue?: number;
  readonly sources: readonly DataSourceRef[];
};

export type DataGroupedBarSeriesDef = {
  readonly id: string;
  readonly label: string;
};

export type DataGroupedBarPoint = {
  readonly period: string;
  readonly values: Readonly<Record<string, number>>;
};

/** Period × series values for homeownership, HMDA denial, USSC sentences. */
export type DataGroupedBarSeries = {
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  readonly geographyLabel: string;
  readonly unit: DataValueUnit;
  readonly series: readonly DataGroupedBarSeriesDef[];
  readonly points: readonly DataGroupedBarPoint[];
  readonly sources: readonly DataSourceRef[];
};

export type DataIndicatorBundle = {
  readonly wealthComparison: DataRacePairSeries;
  readonly imprisonmentComparison: DataRacePairSeries;
  readonly cookHomeownership: DataGroupedBarSeries;
  readonly hmdaDenialRates: DataGroupedBarSeries;
  readonly federalDrugSentences: DataGroupedBarSeries;
  readonly costBurdenComparison: DataRacePairSeries;
  readonly generatedAt: string;
  readonly servedFrom: 'fixture';
};

export type Phase1CoverageSummary = {
  readonly metricCount: number;
  readonly sampleObservationCount: number;
  readonly themes: readonly string[];
};

/** What the Data screen can show today (no live census timeline API on mobile). */
export type DataPageModel = {
  readonly indicators: DataIndicatorBundle;
  readonly phase1: Phase1CoverageSummary;
  /** Census national timeline is not served to mobile yet — always degraded for now. */
  readonly censusTimelineAvailable: false;
};
