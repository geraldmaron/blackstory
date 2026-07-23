/**
 * Builds multi-metric series groups from theme-impact packet observations for
 * era storytelling panels (Q3 redlining, Q6 drug policy, Q11 school segregation).
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
      (a.referencePeriod ?? '').localeCompare(b.referencePeriod ?? ''),
    );
    groups.push({
      metricId,
      label: sorted[0]?.label ?? metricId,
      points: sorted.map((row) => ({
        referencePeriod: row.referencePeriod ?? '—',
        value: row.value,
      })),
      isTimeSeries: sorted.length > 1,
    });
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

/** Question ids that receive the era timeline + multi-metric storytelling panel. */
export const THEME_IMPACT_STORYTELLING_QUESTION_IDS = new Set(['Q3', 'Q6', 'Q11']);

export function shouldShowThemeImpactStorytelling(questionId: string): boolean {
  return THEME_IMPACT_STORYTELLING_QUESTION_IDS.has(questionId);
}
