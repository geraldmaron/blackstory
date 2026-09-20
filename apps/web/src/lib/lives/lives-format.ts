/**
 * Reader-facing text for Lives Across the Decades cells. Pure and locale-pinned so the server render and
 * the client hydrate to the same string.
 *
 * Wording follows docs/methodology/lives-across-decades.md: a cell describes people in a group, never a
 * person, and a missing value always says why it is missing.
 */
import type { LivesCell, LivesConditionUnit } from '@repo/domain/statistics/lives';

export function formatLivesPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * A figure in its own unit. Life expectancy is years and infant mortality is deaths per 1,000 live
 * births; printing either as a percent would be a wrong number, not a formatting slip.
 */
export function formatLivesValue(value: number, unit: LivesConditionUnit = 'percent'): string {
  if (unit === 'years') return `${value.toFixed(1)} years`;
  if (unit === 'per_1000') return `${value.toFixed(1)} per 1,000`;
  return formatLivesPercent(value);
}

/** The top of each unit's bar scale. 200 per 1,000 holds the series' highest year (1915). */
const LIVES_BAR_SCALE_MAX: Readonly<Record<LivesConditionUnit, number>> = {
  percent: 100,
  years: 100,
  per_1000: 200,
};

/** Bar length as a share of the unit's own scale, 0 to 100. */
export function livesBarShare(value: number, unit: LivesConditionUnit = 'percent'): number {
  return Math.max(0, Math.min((value / LIVES_BAR_SCALE_MAX[unit]) * 100, 100));
}

/** What a full bar stands for, so a reader can size a bar that is not a percent. */
export function livesBarScaleNote(unit: LivesConditionUnit = 'percent'): string | null {
  if (unit === 'years') return 'A full bar is 100 years.';
  if (unit === 'per_1000') return 'A full bar is 200 deaths per 1,000 live births.';
  return null;
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

export function describeLivesCell(
  cell: LivesCell,
  unit: LivesConditionUnit = 'percent',
): LivesCellDisplay {
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
        text: formatLivesValue(cell.estimate, unit),
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
