/**
 * Metric catalog for Lives Across the Decades: which measures exist, in which decades the census
 * asked for them, and how their series ids are formed. Tier or class bucket is part of the metric
 * id; the group lives in `race_ethnicity_slice`. Method: docs/methodology/lives-across-decades.md.
 */
import type { LivesDecade, LivesMeasurementRegime } from './lives-regimes.js';

/** Class buckets a group's population is split into. `unclassified` exists only before 1940. */
export const LIVES_CLASS_BUCKETS = ['lower', 'middle', 'upper', 'unclassified'] as const;

export type LivesClassBucket = (typeof LIVES_CLASS_BUCKETS)[number];

/** Tiers a condition can be read within: everyone in the group, or one class tier. */
export const LIVES_TIER_KEYS = ['all', 'lower', 'middle', 'upper'] as const;

export type LivesTierKey = (typeof LIVES_TIER_KEYS)[number];

export type LivesMetricKey =
  | 'class_share'
  | 'median_adjusted_income'
  | 'homeownership'
  | 'employed'
  | 'literacy'
  | 'high_school'
  | 'household_size'
  | 'southern_born'
  | 'foreign_born';

export type LivesMetricUnit = 'percent' | 'usd_2024' | 'persons';

export type LivesMetricDefinition = {
  readonly key: LivesMetricKey;
  /** Series id stem; the tier or class bucket is appended. */
  readonly idStem: string;
  readonly unit: LivesMetricUnit;
  /** `share` values are percentages; `level` values are medians or means. */
  readonly kind: 'share' | 'level';
  readonly universe: string;
  /** Whether the census recorded what this metric needs in the decade. */
  readonly measuredIn: (decade: LivesDecade) => boolean;
};

const recorded = (decade: LivesDecade) => decade !== 1890;

export const LIVES_CLASS_SHARE_METRIC: LivesMetricDefinition = {
  key: 'class_share',
  idStem: 'ipums-lives-class-share',
  unit: 'percent',
  kind: 'share',
  universe: 'Adults 18 and over living in households',
  measuredIn: recorded,
};

/** Conditions shown on each decade card, in display order. */
export const LIVES_CONDITION_METRICS: readonly LivesMetricDefinition[] = [
  {
    key: 'median_adjusted_income',
    idStem: 'ipums-lives-median-adjusted-income-2024usd',
    unit: 'usd_2024',
    kind: 'level',
    universe: 'Adults 18 and over living in households',
    measuredIn: (decade) => decade >= 1940,
  },
  {
    key: 'homeownership',
    idStem: 'ipums-lives-homeownership',
    unit: 'percent',
    kind: 'share',
    universe: 'Adults 18 and over living in households',
    measuredIn: (decade) => decade >= 1900,
  },
  {
    key: 'employed',
    idStem: 'ipums-lives-employed',
    unit: 'percent',
    kind: 'share',
    universe: 'Adults 18 to 64 living in households',
    measuredIn: (decade) => decade >= 1940,
  },
  {
    key: 'literacy',
    idStem: 'ipums-lives-literacy',
    unit: 'percent',
    kind: 'share',
    universe: 'Adults 18 and over living in households',
    measuredIn: (decade) => decade <= 1930 && recorded(decade),
  },
  {
    key: 'high_school',
    idStem: 'ipums-lives-high-school-completion',
    unit: 'percent',
    kind: 'share',
    universe: 'Adults 25 and over living in households',
    measuredIn: (decade) => decade >= 1940,
  },
  {
    key: 'household_size',
    idStem: 'ipums-lives-mean-household-size',
    unit: 'persons',
    kind: 'level',
    universe: 'Adults 18 and over living in households',
    measuredIn: recorded,
  },
  {
    key: 'southern_born',
    idStem: 'ipums-lives-southern-born',
    unit: 'percent',
    kind: 'share',
    universe: 'Adults 18 and over living in households',
    measuredIn: recorded,
  },
  {
    key: 'foreign_born',
    idStem: 'ipums-lives-foreign-born',
    unit: 'percent',
    kind: 'share',
    universe: 'Adults 18 and over living in households',
    measuredIn: recorded,
  },
];

export function livesMetricId(
  metric: LivesMetricDefinition,
  bucket: LivesTierKey | LivesClassBucket,
): string {
  return `${metric.idStem}-${bucket}`;
}

/** Reader-facing label, which depends on what the decade's regime actually measured. */
export function livesMetricLabel(key: LivesMetricKey, regime: LivesMeasurementRegime): string {
  switch (key) {
    case 'class_share':
      return regime === 'occupational_strata' ? 'Share by kind of work' : 'Share by income tier';
    case 'median_adjusted_income':
      return regime === 'earnings'
        ? 'Median wage earnings, adjusted for household size (2024 dollars)'
        : 'Median household income, adjusted for household size (2024 dollars)';
    case 'homeownership':
      return 'Living in a home their household owned';
    case 'employed':
      return 'Working at a job';
    case 'literacy':
      return 'Able to read and write';
    case 'high_school':
      return 'Finished high school';
    case 'household_size':
      return 'People in the household, on average';
    case 'southern_born':
      return 'Born in the South';
    case 'foreign_born':
      return 'Born outside the United States';
  }
}
