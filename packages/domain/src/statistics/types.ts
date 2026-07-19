/**
 * Statistical data storage model (the related workstream).
 *
 * An external architecture review found that Census/ACS/FBI-hate-crime/Opportunity-Atlas-style
 * statistics were not modeled as a distinct concept from ordinary entity claims — folding them
 * in loses margin of error, geography vintage, source variable provenance, and the
 * observed/derived/modeled distinction. This module is the STORAGE MODEL for that data; it does
 * NOT duplicate the Census Geocoder adapter logic in `../adapters/census-geo/` (that adapter
 * resolves addresses/coordinates to jurisdictions — an entirely different concern from storing
 * a metric's time series of estimates).
 *
 * Three types, one lifecycle:
 *  - `StatisticalSeries` — the metric definition (what is measured, in what units, from which
 *    source variable, at what geography/estimate/period type). One series, many observations.
 *  - `StatisticalObservation` — a single as-reported estimate for a series at a jurisdiction and
 *    period, always `status: 'observed'`. `boundaryVersion` is the vintage/crosswalk key: bd
 *    memory records "Tract-keyed collections must carry explicit tractVintage: ACS 2020s
 *    releases use 2020 tracts, Opportunity Atlas uses 2010 tracts — never join without a
 *    crosswalk," and `boundaryVersion` generalizes that constraint to every geography type (not
 *    just tracts), so a combination rule can refuse to combine observations whose boundary
 *    versions differ.
 *  - `DerivedMeasurement` — a value computed from one or more observations (sums, rates,
 *    growth, model output). `status` is a required literal `'derived' | 'modeled'` — there is no
 *    way to construct one without picking a state, and no boolean/implicit-string stands in for
 *    the observed/derived/modeled axis.
 */

/** Stable id for a `StatisticalSeries` (the metric definition, not an individual reading). */
export type MetricId = string & { readonly __brand: 'MetricId' };

/** Stable id for a single `StatisticalObservation`. */
export type StatisticalObservationId = string & { readonly __brand: 'StatisticalObservationId' };

/** Stable id for a single `DerivedMeasurement`. */
export type DerivedMeasurementId = string & { readonly __brand: 'DerivedMeasurementId' };

function brandNonEmpty<T extends string>(value: string, label: string): T {
  if (!value.trim()) {
    throw new Error(`${label} must be non-empty`);
  }
  return value as T;
}

export function asMetricId(value: string): MetricId {
  return brandNonEmpty(value, 'MetricId');
}

export function asStatisticalObservationId(value: string): StatisticalObservationId {
  return brandNonEmpty(value, 'StatisticalObservationId');
}

export function asDerivedMeasurementId(value: string): DerivedMeasurementId {
  return brandNonEmpty(value, 'DerivedMeasurementId');
}

/**
 * Geography types a series can be published at. Mirrors `ExternalSourceGeography`
 * (`../external-data-sources.ts`) so a series' `geographyType` lines up with the same
 * vocabulary already used to register the datasets these series come from, rather than
 * inventing a second geography enum.
 */
export const STATISTICAL_GEOGRAPHY_TYPES = [
  'tract',
  'county',
  'block',
  'blockgroup',
  'address',
  'city',
  'school',
  'facility',
  'state',
] as const;

export type StatisticalGeographyType = (typeof STATISTICAL_GEOGRAPHY_TYPES)[number];

export function isStatisticalGeographyType(value: string): value is StatisticalGeographyType {
  return (STATISTICAL_GEOGRAPHY_TYPES as readonly string[]).includes(value);
}

/** Whether a series' values are counted as-is, or normalized against a denominator/universe. */
export const STATISTICAL_ESTIMATE_TYPES = [
  'count',
  'percentage',
  'rate',
  'ratio',
  'median',
  'mean',
  'index',
] as const;

export type StatisticalEstimateType = (typeof STATISTICAL_ESTIMATE_TYPES)[number];

export function isStatisticalEstimateType(value: string): value is StatisticalEstimateType {
  return (STATISTICAL_ESTIMATE_TYPES as readonly string[]).includes(value);
}

/** The reference-period shape a series is published on (single year vs. rolling estimate, etc). */
export const STATISTICAL_PERIOD_TYPES = [
  'point-in-time',
  '1-year-estimate',
  '5-year-estimate',
  'annual',
  'decennial',
  'custom-range',
] as const;

export type StatisticalPeriodType = (typeof STATISTICAL_PERIOD_TYPES)[number];

export function isStatisticalPeriodType(value: string): value is StatisticalPeriodType {
  return (STATISTICAL_PERIOD_TYPES as readonly string[]).includes(value);
}

/**
 * A metric definition: what is measured, from which source table/variable, at what
 * geography/estimate/period type. Does not carry any single reading — see
 * `StatisticalObservation` for that.
 */
export type StatisticalSeries = {
  readonly metricId: MetricId;
  /** Human-readable description of what this metric measures. */
  readonly metricDefinition: string;
  /** The population/denominator this measures (e.g. "households", "population 25+"). */
  readonly universe: string;
  readonly unit: string;
  /** e.g. "ACS 5-Year Detailed Tables", "FBI Hate Crime Statistics". */
  readonly sourceDataset: string;
  /** e.g. "B19013", "Table 6". */
  readonly sourceTable: string;
  /** e.g. "B19013_001E". */
  readonly sourceVariable: string;
  readonly geographyType: StatisticalGeographyType;
  readonly estimateType: StatisticalEstimateType;
  readonly periodType: StatisticalPeriodType;
};

/**
 * A single as-reported estimate for a series at one jurisdiction and reference period.
 * Always `status: 'observed'` — an observation is never derived or modeled, it is a
 * transcription of what the source dataset reported.
 *
 * `boundaryVersion` is the vintage/crosswalk key (generalizes the tractVintage constraint —
 * see module doc). Two observations may only be safely combined when their `boundaryVersion`
 * values match; combining across boundary versions requires an explicit crosswalk step this
 * module does not perform.
 */
export type StatisticalObservation = {
  readonly seriesId: MetricId;
  readonly jurisdictionId: string;
  /** Geography vintage/crosswalk key, e.g. "tract-2020", "tract-2010", "county-2020". */
  readonly boundaryVersion: string;
  /** The period this estimate covers, e.g. "2022", "2018-2022". */
  readonly referencePeriod: string;
  /** The source dataset's own release/vintage label, e.g. "ACS 2022 5-Year". */
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly marginOfError?: number;
  readonly standardError?: number;
  readonly numerator?: number;
  readonly denominator?: number;
  /** Provenance link back to the source item this reading was transcribed from. */
  readonly sourceItemId: string;
  /** ISO 8601 timestamp of when this reading was captured. */
  readonly retrievedAt: string;
  readonly status: 'observed';
};

/**
 * A value computed from one or more observations — a sum, a rate, a growth figure, or a
 * model's output. `status` distinguishes plain arithmetic combination (`'derived'`, e.g. a
 * validated sum or a growth calculation) from a modeled/estimated/imputed value (`'modeled'`,
 * e.g. small-area estimation or a projection) — the two carry very different confidence and
 * must never be presented identically. There is no default: every `DerivedMeasurement` must
 * pick one explicitly.
 */
export type DerivedMeasurement = {
  readonly methodId: string;
  readonly methodVersion: string;
  readonly inputObservationIds: readonly string[];
  readonly value: number;
  readonly uncertainty?: number;
  /** Human-readable description of how `value` was computed — not executable code. */
  readonly formula: string;
  readonly assumptions: readonly string[];
  /** ISO 8601 timestamp of when this measurement was computed. */
  readonly generatedAt: string;
  readonly status: 'derived' | 'modeled';
};
