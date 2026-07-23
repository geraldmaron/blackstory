/**
 * Pure aggregations over Explore map features for the sheet metrics dashboard.
 *
 * Counts only fields already present on redacted FeatureCollection properties
 * (kind, state, eraBuckets, precision). Never invents rates, heat, or
 * violence-adjacent signals — geography is state presence only. Optional
 * national features enable viewport-vs-release comparison when both exist.
 */
import type { ExploreFeature } from '../explore-feature';

export type MetricBucket = {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** Share of scoped total (0–100), rounded to nearest integer. */
  readonly percent: number;
};

export type PrecisionHonesty = {
  /** Features with a non-empty precision string. */
  readonly labeled: number;
  /** City / unknown / other coarse ceilings (not sharper than city). */
  readonly cityOrCoarser: number;
  /** Neighborhood, campus, institution, block, exact — still public-safe. */
  readonly sharperThanCity: number;
  /** Percent of labeled features at city-or-coarser (honesty signal). */
  readonly cityOrCoarserPercent: number | null;
};

export type ScopeComparison = {
  readonly nationalTotal: number;
  readonly nationalGeography: number;
  /** Scoped total as % of national total. */
  readonly shareOfNationalPercent: number;
  /** Scoped place count as % of national place count (0 when national has none). */
  readonly geographySharePercent: number | null;
};

export type ExploreMetrics = {
  readonly total: number;
  /** Distinct states / districts with at least one feature. */
  readonly geographyCoverage: number;
  /** Features that carry at least one era bucket. */
  readonly withEraLabeled: number;
  /** Percent of scoped features with era labels; null when total is 0. */
  readonly eraCoveragePercent: number | null;
  readonly byKind: readonly MetricBucket[];
  readonly byState: readonly MetricBucket[];
  readonly byEra: readonly MetricBucket[];
  readonly byPrecision: readonly MetricBucket[];
  readonly precisionHonesty: PrecisionHonesty;
  /** Present only when a distinct national set was supplied for comparison. */
  readonly comparison: ScopeComparison | null;
};

const MAX_BUCKETS = 8;

/** Precision values treated as city-or-coarser (public ceiling honesty). */
const CITY_OR_COARSER = new Set(['city', 'unknown', 'state', 'region', 'county']);

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function percentOf(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function toBuckets(
  map: Map<string, number>,
  labelFor: (key: string) => string,
  total: number,
  max = MAX_BUCKETS,
): readonly MetricBucket[] {
  const sorted = [...map.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const materialize = (entries: readonly (readonly [string, number])[]): MetricBucket[] =>
    entries.map(([key, count]) => ({
      key,
      label: labelFor(key),
      count,
      percent: percentOf(count, total),
    }));

  if (sorted.length <= max) {
    return materialize(sorted);
  }

  const head = sorted.slice(0, max - 1);
  const restCount = sorted.slice(max - 1).reduce((sum, [, count]) => sum + count, 0);
  return [
    ...materialize(head),
    {
      key: '__other__',
      label: 'Other',
      count: restCount,
      percent: percentOf(restCount, total),
    },
  ];
}

function stateKey(feature: ExploreFeature): string | null {
  const postal = feature.properties.statePostalCode?.trim();
  if (postal) return postal;
  const name = feature.properties.stateName?.trim();
  if (name) return name;
  return null;
}

function stateLabel(feature: ExploreFeature): string | null {
  const name = feature.properties.stateName?.trim();
  if (name) return name;
  const postal = feature.properties.statePostalCode?.trim();
  if (postal) return postal;
  return null;
}

function isCityOrCoarser(precision: string): boolean {
  return CITY_OR_COARSER.has(precision.toLowerCase());
}

function countGeography(features: readonly ExploreFeature[]): number {
  const keys = new Set<string>();
  for (const feature of features) {
    const sk = stateKey(feature);
    if (sk) keys.add(sk);
  }
  return keys.size;
}

export type AggregateExploreMetricsOptions = {
  /**
   * Full filtered release set for viewport-vs-national comparison. When omitted
   * or identical in length to `features`, comparison is null.
   */
  readonly nationalFeatures?: readonly ExploreFeature[];
};

/**
 * Aggregate kind / geography / era / precision counts for the given feature set.
 * Same inputs always yield the same ordered buckets.
 */
export function aggregateExploreMetrics(
  features: readonly ExploreFeature[],
  options: AggregateExploreMetricsOptions = {},
): ExploreMetrics {
  const byKindMap = new Map<string, number>();
  const byStateMap = new Map<string, number>();
  const stateLabels = new Map<string, string>();
  const byEraMap = new Map<string, number>();
  const byPrecisionMap = new Map<string, number>();
  let withEraLabeled = 0;
  let precisionLabeled = 0;
  let cityOrCoarser = 0;
  let sharperThanCity = 0;

  for (const feature of features) {
    bump(byKindMap, feature.kind || 'unknown');

    const sk = stateKey(feature);
    if (sk) {
      bump(byStateMap, sk);
      if (!stateLabels.has(sk)) {
        stateLabels.set(sk, stateLabel(feature) ?? sk);
      }
    }

    const eras = feature.properties.eraBuckets ?? [];
    if (eras.length > 0) {
      withEraLabeled += 1;
      for (const era of eras) {
        const trimmed = typeof era === 'string' ? era.trim() : '';
        if (trimmed) bump(byEraMap, trimmed);
      }
    }

    const precision =
      typeof feature.properties.precision === 'string'
        ? feature.properties.precision.trim()
        : '';
    if (precision) {
      precisionLabeled += 1;
      bump(byPrecisionMap, precision);
      if (isCityOrCoarser(precision)) {
        cityOrCoarser += 1;
      } else {
        sharperThanCity += 1;
      }
    }
  }

  const total = features.length;
  const national = options.nationalFeatures;
  let comparison: ScopeComparison | null = null;
  if (national && national.length > 0 && national.length !== total) {
    const nationalGeography = countGeography(national);
    comparison = {
      nationalTotal: national.length,
      nationalGeography,
      shareOfNationalPercent: percentOf(total, national.length),
      geographySharePercent:
        nationalGeography > 0
          ? percentOf(byStateMap.size, nationalGeography)
          : null,
    };
  }

  return {
    total,
    geographyCoverage: byStateMap.size,
    withEraLabeled,
    eraCoveragePercent: total > 0 ? percentOf(withEraLabeled, total) : null,
    byKind: toBuckets(byKindMap, (k) => capitalize(k), total),
    byState: toBuckets(byStateMap, (k) => stateLabels.get(k) ?? k, total),
    byEra: toBuckets(byEraMap, (k) => k, total),
    byPrecision: toBuckets(byPrecisionMap, (k) => capitalize(k), total),
    precisionHonesty: {
      labeled: precisionLabeled,
      cityOrCoarser,
      sharperThanCity,
      cityOrCoarserPercent:
        precisionLabeled > 0 ? percentOf(cityOrCoarser, precisionLabeled) : null,
    },
    comparison,
  };
}

/** Spoken / screen-reader summary of an entire metrics snapshot. */
export function metricsAccessibilitySummary(
  metrics: ExploreMetrics,
  scopeLabel: string,
): string {
  const parts = [
    `${scopeLabel}: ${metrics.total === 1 ? '1 record' : `${metrics.total} records`}`,
  ];

  if (metrics.comparison) {
    parts.push(
      `${metrics.comparison.shareOfNationalPercent}% of ${metrics.comparison.nationalTotal} nationally`,
    );
  }

  if (metrics.byKind.length > 0) {
    parts.push(
      `Kind mix: ${metrics.byKind
        .map((b) => `${b.percent}% ${b.label} (${b.count})`)
        .join(', ')}`,
    );
  }
  if (metrics.geographyCoverage > 0) {
    parts.push(
      `Geography: ${metrics.geographyCoverage === 1 ? '1 place' : `${metrics.geographyCoverage} places`}`,
    );
  }
  if (metrics.eraCoveragePercent != null && metrics.byEra.length > 0) {
    parts.push(
      `Era coverage: ${metrics.eraCoveragePercent}% labeled. By era: ${metrics.byEra
        .map((b) => `${b.count} ${b.label}`)
        .join(', ')}`,
    );
  }
  if (metrics.precisionHonesty.cityOrCoarserPercent != null) {
    parts.push(
      `Location precision honesty: ${metrics.precisionHonesty.cityOrCoarserPercent}% city or coarser`,
    );
  }
  if (metrics.byPrecision.length > 0) {
    parts.push(
      `Precision mix: ${metrics.byPrecision
        .map((b) => `${b.percent}% ${b.label}`)
        .join(', ')}`,
    );
  }

  return parts.join('. ');
}
