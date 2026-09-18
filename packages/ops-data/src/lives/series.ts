/**
 * `reference.statistical_series` rows for the Lives Across the Decades series. Every era's loader
 * upserts through this one definition so a later loader never rewrites a series another wrote.
 * Method: docs/methodology/lives-across-decades.md.
 */
import {
  LIVES_SERIES,
  parseIncomeBracketSeriesId,
  workClassSeriesId,
} from '@repo/domain/statistics/lives';

export type LivesSeriesRow = {
  readonly metricId: string;
  readonly metricDefinition: string;
  readonly universe: string;
  readonly unit: 'percent' | 'dollars';
  readonly estimateType: 'percentage' | 'median';
};

const RATE_SERIES: Readonly<
  Record<string, Omit<LivesSeriesRow, 'metricId' | 'unit' | 'estimateType'>>
> = {
  [LIVES_SERIES.population]: {
    metricDefinition: 'Residents in the group as a share of everyone living in the area',
    universe: 'total population',
  },
  [LIVES_SERIES.urban]: {
    metricDefinition: 'Residents in the group living in urban places',
    universe: 'population in the group',
  },
  [LIVES_SERIES.homeownership]: {
    metricDefinition: 'Occupied homes owned by the household, by race of the household head',
    universe: 'occupied housing units',
  },
  [LIVES_SERIES.literacy]: {
    metricDefinition: 'People able to read and write',
    universe: 'population 10 years and older',
  },
  [LIVES_SERIES.schoolAttendance]: {
    metricDefinition: 'School-age children attending school',
    universe: 'school-age population',
  },
  [LIVES_SERIES.highSchool]: {
    metricDefinition: 'Adults who finished high school',
    universe: 'population 25 years and older',
  },
  [LIVES_SERIES.unemployed]: {
    metricDefinition: 'People in the civilian labor force who were unemployed',
    universe: 'civilian labor force',
  },
  [LIVES_SERIES.farmTenancy]: {
    metricDefinition: 'Farm operators who rented or sharecropped',
    universe: 'farm operators',
  },
};

function dollars(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

/** The series row for a Lives metric id, or null when the id is not a Lives series. */
export function livesSeriesRow(metricId: string): LivesSeriesRow | null {
  if (metricId === LIVES_SERIES.incomeMedian) {
    return {
      metricId,
      metricDefinition: 'National median of the decade’s income unit',
      universe: 'wage earners, families or households, by decade',
      unit: 'dollars',
      estimateType: 'median',
    };
  }
  if (metricId === LIVES_SERIES.medianRent) {
    return {
      metricId,
      metricDefinition: 'Median monthly contract rent of rented nonfarm homes',
      universe: 'rented nonfarm homes',
      unit: 'dollars',
      estimateType: 'median',
    };
  }
  if (metricId === LIVES_SERIES.medianHomeValue) {
    return {
      metricId,
      metricDefinition: 'Median value of owned nonfarm homes',
      universe: 'owned nonfarm homes',
      unit: 'dollars',
      estimateType: 'median',
    };
  }
  const rate = RATE_SERIES[metricId];
  if (rate) return { metricId, ...rate, unit: 'percent', estimateType: 'percentage' };
  const bracket = parseIncomeBracketSeriesId(metricId);
  if (bracket) {
    const range =
      bracket.upper === null
        ? `${dollars(bracket.lower)} or more`
        : bracket.lower === 0
          ? `less than ${dollars(bracket.upper)}`
          : `${dollars(bracket.lower)} to ${dollars(bracket.upper - 1)}`;
    return {
      metricId,
      metricDefinition: `Income ${range}, as a share of the group’s income units`,
      universe: 'wage earners, families or households, by decade',
      unit: 'percent',
      estimateType: 'percentage',
    };
  }
  for (const bucket of ['lower', 'middle', 'upper', 'unclassified'] as const) {
    if (metricId === workClassSeriesId(bucket)) {
      return {
        metricId,
        metricDefinition: `Workers in ${bucket} work-based class occupations`,
        universe: 'gainful workers or farm operators',
        unit: 'percent',
        estimateType: 'percentage',
      };
    }
  }
  return null;
}

/** Column values for `INSERT INTO reference.statistical_series`, in table column order after metric_id. */
export function livesSeriesColumns(row: LivesSeriesRow) {
  return {
    metric_id: row.metricId,
    metric_definition: row.metricDefinition,
    universe: row.universe,
    unit: row.unit,
    source_dataset: 'Published census tables by race',
    source_table: 'per observation',
    source_variable: 'derived',
    geography_type: 'state',
    estimate_type: row.estimateType,
    period_type: 'custom-range',
    external_data_source_id: null,
    theme: 'lives',
    metadata: { methodology: 'docs/methodology/lives-across-decades.md' },
  } as const;
}
