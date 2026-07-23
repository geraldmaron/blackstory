/**
 * Pure aggregations over Explore map features for the sheet metrics dashboard.
 *
 * Counts only fields already present on redacted FeatureCollection properties
 * (kind, state, eraBuckets, precision). Never invents rates, heat, or
 * violence-adjacent signals — geography is state presence only.
 */
import type { ExploreFeature } from '../explore-feature';

export type MetricBucket = {
  readonly key: string;
  readonly label: string;
  readonly count: number;
};

export type ExploreMetrics = {
  readonly total: number;
  /** Distinct states / districts with at least one feature. */
  readonly geographyCoverage: number;
  /** Features that carry at least one era bucket. */
  readonly withEraLabeled: number;
  readonly byKind: readonly MetricBucket[];
  readonly byState: readonly MetricBucket[];
  readonly byEra: readonly MetricBucket[];
  readonly byPrecision: readonly MetricBucket[];
};

const MAX_BUCKETS = 8;

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toBuckets(
  map: Map<string, number>,
  labelFor: (key: string) => string,
  max = MAX_BUCKETS,
): readonly MetricBucket[] {
  const sorted = [...map.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  if (sorted.length <= max) {
    return sorted.map(([key, count]) => ({ key, label: labelFor(key), count }));
  }

  const head = sorted.slice(0, max - 1);
  const restCount = sorted.slice(max - 1).reduce((sum, [, count]) => sum + count, 0);
  return [
    ...head.map(([key, count]) => ({ key, label: labelFor(key), count })),
    { key: '__other__', label: 'Other', count: restCount },
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

/**
 * Aggregate kind / geography / era / precision counts for the given feature set.
 * Same inputs always yield the same ordered buckets.
 */
export function aggregateExploreMetrics(
  features: readonly ExploreFeature[],
): ExploreMetrics {
  const byKindMap = new Map<string, number>();
  const byStateMap = new Map<string, number>();
  const stateLabels = new Map<string, string>();
  const byEraMap = new Map<string, number>();
  const byPrecisionMap = new Map<string, number>();
  let withEraLabeled = 0;

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
    if (precision) bump(byPrecisionMap, precision);
  }

  return {
    total: features.length,
    geographyCoverage: byStateMap.size,
    withEraLabeled,
    byKind: toBuckets(byKindMap, (k) => capitalize(k)),
    byState: toBuckets(byStateMap, (k) => stateLabels.get(k) ?? k),
    byEra: toBuckets(byEraMap, (k) => k),
    byPrecision: toBuckets(byPrecisionMap, (k) => capitalize(k)),
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

  if (metrics.byKind.length > 0) {
    parts.push(
      `By kind: ${metrics.byKind.map((b) => `${b.count} ${b.label}`).join(', ')}`,
    );
  }
  if (metrics.geographyCoverage > 0) {
    parts.push(
      `Geography: ${metrics.geographyCoverage === 1 ? '1 place' : `${metrics.geographyCoverage} places`}`,
    );
  }
  if (metrics.byEra.length > 0) {
    parts.push(`By era: ${metrics.byEra.map((b) => `${b.count} ${b.label}`).join(', ')}`);
  }
  if (metrics.byPrecision.length > 0) {
    parts.push(
      `Location precision: ${metrics.byPrecision.map((b) => `${b.count} ${b.label}`).join(', ')}`,
    );
  }

  return parts.join('. ');
}
