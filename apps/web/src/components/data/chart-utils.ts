/**
 * Shared layout math and number formatting for server-rendered SVG data charts on
 * the public `/data` page — no client chart libraries, only deterministic scales.
 */

export const CHART_WIDTH = 640;
export const CHART_HEIGHT = 280;

export const CHART_MARGIN = {
  top: 20,
  right: 20,
  bottom: 56,
  left: 80,
} as const;

export function plotWidth(): number {
  return CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
}

export function plotHeight(): number {
  return CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
}

export function formatChartCount(value: number): string {
  return value.toLocaleString('en-US');
}

export function formatSharePct(blackPopulation: number, totalPopulation: number): string {
  if (totalPopulation <= 0) {
    return '—';
  }
  return `${((blackPopulation / totalPopulation) * 100).toFixed(1)}%`;
}

export function scaleLinear(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  const span = domainMax - domainMin || 1;
  return (value: number) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

export function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Unique {label,url} pairs from decade rows — for multi-source chart footnotes. */
export function sourcesFromDecadeRows(
  rows: readonly { readonly source: string; readonly sourceUrl: string }[],
): readonly { readonly label: string; readonly url: string }[] {
  const seen = new Set<string>();
  const out: { label: string; url: string }[] = [];
  for (const row of rows) {
    const key = row.sourceUrl.trim().toLowerCase() || row.source.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: row.source, url: row.sourceUrl });
  }
  return out;
}
