/**
 * Builds multi-metric series groups from theme-impact packet observations for
 * era storytelling panels (Q3 redlining, Q6 drug policy, Q11 school segregation).
 * Also supplies multi-year-only spines for the continuous theme arc rail.
 */
import type { ThemeImpactObservationView } from '@repo/domain';

export type ThemeImpactMetricSeriesPoint = {
  readonly referencePeriod: string;
  readonly value: string;
  readonly rawEstimate?: number;
};

export type ThemeImpactMetricSeriesGroup = {
  readonly metricId: string;
  readonly label: string;
  readonly points: readonly ThemeImpactMetricSeriesPoint[];
  readonly isTimeSeries: boolean;
};

export type ThemeImpactArcInstrument = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly period: string;
};

function periodSortKey(period: string): string {
  return period.replace(/–/g, '-');
}

/** Merge NHGIS tenure with a later ACS ownership handoff into one spine key. */
function spineKey(metricId: string): string {
  const ownership = metricId.match(
    /^(?:nhgis|acs)-homeownership-rate-(black|white)-county$/,
  );
  if (ownership) {
    return `homeownership-${ownership[1]}-county`;
  }
  return metricId;
}

function spineLabel(metricId: string, fallback: string): string {
  if (metricId === 'homeownership-black-county') {
    return 'Black homeownership rate, Cook County';
  }
  if (metricId === 'homeownership-white-county') {
    return 'White homeownership rate, Cook County';
  }
  return fallback;
}

export function groupThemeImpactMetricSeries(
  observations: readonly ThemeImpactObservationView[],
): readonly ThemeImpactMetricSeriesGroup[] {
  const byMetric = new Map<string, ThemeImpactObservationView[]>();

  for (const obs of observations) {
    const metricId = obs.metricId ?? obs.id;
    const bucket = byMetric.get(metricId) ?? [];
    bucket.push(obs);
    byMetric.set(metricId, bucket);
  }

  const groups: ThemeImpactMetricSeriesGroup[] = [];

  for (const [metricId, rows] of byMetric) {
    const sorted = [...rows].sort((a, b) =>
      periodSortKey(a.referencePeriod ?? '').localeCompare(
        periodSortKey(b.referencePeriod ?? ''),
      ),
    );
    groups.push({
      metricId,
      label: sorted[0]?.label ?? metricId,
      points: sorted.map((row) => ({
        referencePeriod: row.referencePeriod ?? 'n/a',
        value: row.value,
      })),
      isTimeSeries: sorted.length > 1,
    });
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Primary arc rail: multi-year spines only. Lone single-year chips and
 * ACS-only snapshots are omitted unless they continue a series already shown
 * (e.g. ACS ownership after NHGIS tenure).
 */
export function pickThemeImpactArcInstruments(
  observations: readonly ThemeImpactObservationView[],
  options?: { readonly limit?: number },
): readonly ThemeImpactArcInstrument[] {
  const limit = options?.limit ?? 8;
  const bySpine = new Map<string, ThemeImpactObservationView[]>();

  for (const obs of observations) {
    const metricId = obs.metricId ?? obs.id;
    const key = spineKey(metricId);
    const bucket = bySpine.get(key) ?? [];
    bucket.push(obs);
    bySpine.set(key, bucket);
  }

  const rows: ThemeImpactArcInstrument[] = [];

  for (const [key, rowsForSpine] of bySpine) {
    const periods = new Set(
      rowsForSpine.map((row) => row.referencePeriod).filter(Boolean) as string[],
    );
    if (periods.size < 2) continue;

    const sorted = [...rowsForSpine].sort((a, b) =>
      periodSortKey(a.referencePeriod ?? '').localeCompare(
        periodSortKey(b.referencePeriod ?? ''),
      ),
    );
    // Prefer one reading per period (dedupe across packets).
    const byPeriod = new Map<string, ThemeImpactObservationView>();
    for (const row of sorted) {
      const period = row.referencePeriod ?? 'n/a';
      if (!byPeriod.has(period)) byPeriod.set(period, row);
    }
    const points = [...byPeriod.entries()].sort(([a], [b]) =>
      periodSortKey(a).localeCompare(periodSortKey(b)),
    );
    if (points.length < 2) continue;

    const label = spineLabel(key, points[0]?.[1].label ?? key);
    rows.push({
      key,
      label,
      value: points.map(([, row]) => row.value).join(' · '),
      period: points.map(([period]) => period).join(' / '),
    });
    if (rows.length >= limit) break;
  }

  return rows;
}

/** Question ids that receive the era timeline + multi-metric storytelling panel. */
export const THEME_IMPACT_STORYTELLING_QUESTION_IDS = new Set(['Q3', 'Q6', 'Q11']);

export function shouldShowThemeImpactStorytelling(questionId: string): boolean {
  return THEME_IMPACT_STORYTELLING_QUESTION_IDS.has(questionId);
}
