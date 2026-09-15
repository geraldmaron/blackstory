/**
 * Reader-facing text for Lives Across the Decades cells. Pure and locale-pinned so the server render and
 * the client hydrate to the same string.
 *
 * Wording follows docs/methodology/lives-across-decades.md: a cell describes people in a group, never a
 * person, and a missing value always says why it is missing.
 */
import type { LivesCell } from '@repo/domain/statistics/lives';

export function formatLivesPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatLivesMargin(margin: number): string {
  const points = Math.round(margin);
  if (points < 1) return 'within 1 point';
  return `±${points} ${points === 1 ? 'point' : 'points'}`;
}

export type LivesCellDisplay = {
  /** What sits in the table cell. */
  readonly text: string;
  /** Margin, coverage, where a proxy was counted, or the reason a value is missing. */
  readonly detail: string | null;
  readonly tone: 'value' | 'wide' | 'muted';
};

export function describeLivesCell(cell: LivesCell): LivesCellDisplay {
  switch (cell.state) {
    case 'published':
    case 'wide_margin': {
      if (cell.estimate === undefined)
        return { text: 'Not yet counted', detail: null, tone: 'muted' };
      const parts: string[] = [];
      if (cell.state === 'wide_margin') parts.push('Wide margin');
      if (cell.marginOfError !== undefined) parts.push(formatLivesMargin(cell.marginOfError));
      if (cell.coveragePct !== undefined) {
        parts.push(`covers ${Math.round(cell.coveragePct)}% of the group`);
      }
      if (cell.countedIn && cell.countedIn.length > 0) {
        parts.push(`counted only in ${cell.countedIn.join(', ')}`);
      }
      return {
        text: formatLivesPercent(cell.estimate),
        detail: parts.length > 0 ? parts.join(' · ') : null,
        tone: cell.state === 'wide_margin' ? 'wide' : 'value',
      };
    }
    case 'suppressed':
      return { text: 'Withheld', detail: cell.reason ?? null, tone: 'muted' };
    case 'not_measured':
      return { text: 'Not published', detail: cell.reason ?? null, tone: 'muted' };
    case 'pending':
      return { text: 'Not yet counted', detail: cell.reason ?? null, tone: 'muted' };
  }
}

export function formatInForceYears(fromYear: number, toYear: number | null): string {
  return toYear === null ? `In force from ${fromYear}` : `In force ${fromYear}–${toYear}`;
}
