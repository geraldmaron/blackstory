/**
 * Reader-facing text for Lives Across the Decades cells. Pure and locale-pinned so the server
 * render and the client hydrate to the same string.
 *
 * Wording follows docs/methodology/lives-across-decades.md: a cell describes people in a group,
 * never a person, and a missing value always says why it is missing.
 */
import type { LivesCell, LivesMetricUnit } from '@repo/domain/statistics/lives';

export function formatLivesEstimate(value: number, unit: LivesMetricUnit): string {
  switch (unit) {
    case 'percent':
      return `${Math.round(value)}%`;
    case 'usd_2024':
      return `$${(Math.round(value / 100) * 100).toLocaleString('en-US')}`;
    case 'persons':
      return value.toFixed(1);
  }
}

export function formatLivesMargin(margin: number, unit: LivesMetricUnit): string {
  switch (unit) {
    case 'percent': {
      const points = Math.round(margin);
      if (points < 1) return 'within 1 point';
      return `±${points} ${points === 1 ? 'point' : 'points'}`;
    }
    case 'usd_2024':
      return `±$${(Math.round(margin / 100) * 100).toLocaleString('en-US')}`;
    case 'persons':
      return `±${margin.toFixed(1)}`;
  }
}

export type LivesCellDisplay = {
  /** What sits in the table cell. */
  readonly text: string;
  /** Margin, record count or the reason a value is missing. */
  readonly detail: string | null;
  readonly tone: 'value' | 'wide' | 'muted';
};

export function describeLivesCell(cell: LivesCell, unit: LivesMetricUnit): LivesCellDisplay {
  switch (cell.state) {
    case 'published':
    case 'wide_margin': {
      if (cell.estimate === undefined) {
        return { text: 'Not yet counted', detail: null, tone: 'muted' };
      }
      const parts: string[] = [];
      if (cell.marginOfError !== undefined) parts.push(formatLivesMargin(cell.marginOfError, unit));
      if (cell.unweightedN !== undefined) {
        parts.push(`${cell.unweightedN.toLocaleString('en-US')} census records`);
      }
      if (cell.state === 'wide_margin') parts.unshift('Wide margin');
      return {
        text: formatLivesEstimate(cell.estimate, unit),
        detail: parts.length > 0 ? parts.join(' · ') : null,
        tone: cell.state === 'wide_margin' ? 'wide' : 'value',
      };
    }
    case 'suppressed':
      return { text: 'Too few records', detail: cell.reason ?? null, tone: 'muted' };
    case 'not_measured':
      return { text: 'Not asked', detail: cell.reason ?? null, tone: 'muted' };
    case 'pending':
      return { text: 'Not yet counted', detail: cell.reason ?? null, tone: 'muted' };
  }
}

export function formatInForceYears(fromYear: number, toYear: number | null): string {
  return toYear === null ? `In force from ${fromYear}` : `In force ${fromYear}–${toYear}`;
}
