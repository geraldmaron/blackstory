/**
 * Theme-spine "era timeline" moment: the dated documents behind a chapter, in order,
 * sourced from a theme-impact packet's dated artifacts (the packet's `event_timeline`
 * evidence-spine item — see `THEME_IMPACT_MULTI_DECADE_CHECKLIST_ITEMS` in
 * packages/domain/src/statistics/theme-impact-packet.ts) plus the packet's policy eras.
 *
 * Rendered as a vertical chronological rail: a semantic ordered list, one row per event,
 * date in a mono column and the document's own title beside it. This replaced a horizontal
 * SVG axis that positioned each event by year ratio on a fixed-width canvas — with real
 * packet data (documents clustered in the same decade, titles running 40+ characters) the
 * labels collided into an unreadable overprint, and no viewport width fixed it. Elapsed
 * time is the information that axis was carrying, so it is kept explicitly: a gap marker
 * between rows names the years between one document and the next.
 *
 * Fully responsive by construction — text wraps, nothing is positioned absolutely, and
 * there is no horizontal scroll at any width. The chapter's own era band (when it matches
 * one of the packet's `policyEras`) renders as a low-alpha `sand` wash behind the rail.
 */
import React from 'react';

void React;

export type EraTimelineEvent = {
  readonly label: string;
  /** ISO-ish date string (e.g. "1937", "1937-06", "1937-06-12") — sortable lexically. */
  readonly date: string;
};

export type EraTimelinePolicyEra = {
  readonly id: string;
  readonly label: string;
  readonly span?: string;
};

export type EraTimelineProps = {
  readonly events: readonly EraTimelineEvent[];
  /** The packet's policy eras (for the low-alpha `sand` band). */
  readonly policyEras?: readonly EraTimelinePolicyEra[];
  /** Which policy era, if any, this chapter belongs to — highlighted as the band. */
  readonly currentEraId?: string;
  readonly className?: string;
};

/** Only call out a gap once it is long enough to be part of the story. */
const GAP_YEARS_THRESHOLD = 5;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function yearOf(date: string): number {
  const match = /^-?\d{1,4}/.exec(date.trim());
  return match ? Number.parseInt(match[0], 10) : Number.NaN;
}

/**
 * Renders the stored date at whatever precision the packet actually carries, so a
 * year-only artifact never gets a fabricated month or day: "1937", "June 1937",
 * "June 12, 1937".
 */
function formatDateLabel(date: string): string {
  const trimmed = date.trim();
  const match = /^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(trimmed);
  if (!match) return trimmed;
  const [, year, month, day] = match;
  if (!month) return year!;
  const monthName = MONTHS[Number.parseInt(month, 10) - 1];
  if (!monthName) return trimmed;
  if (!day) return `${monthName} ${year}`;
  return `${monthName} ${Number.parseInt(day, 10)}, ${year}`;
}

/** Formats the aria-label summary: date range + event count. */
function summarizeSpan(sorted: readonly EraTimelineEvent[]): string {
  if (sorted.length === 0) return 'No dated events';
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const count = sorted.length;
  const countLabel = count === 1 ? '1 event' : `${count} events`;
  if (first.date === last.date) {
    return `Timeline: ${countLabel}, ${formatDateLabel(first.date)}`;
  }
  return `Timeline: ${countLabel}, ${formatDateLabel(first.date)} to ${formatDateLabel(last.date)}`;
}

function gapLabel(years: number): string {
  if (years >= 100) {
    const centuries = Math.round(years / 100);
    return centuries === 1 ? 'about a century later' : `about ${centuries} centuries later`;
  }
  return years === 1 ? '1 year later' : `${years} years later`;
}

export function EraTimeline({ events, policyEras, currentEraId, className }: EraTimelineProps) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return null;
  }

  const currentEra = policyEras?.find((era) => era.id === currentEraId);
  const rootClassName = [
    'ds-era-timeline',
    currentEra ? 'ds-era-timeline--banded' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <figure className={rootClassName}>
      {currentEra ? <div className="ds-era-timeline__era-band" aria-hidden="true" /> : null}
      <ol className="ds-era-timeline__list" aria-label={summarizeSpan(sorted)}>
        {sorted.map((event, index) => {
          const previous = index > 0 ? sorted[index - 1] : undefined;
          const gapYears = previous ? yearOf(event.date) - yearOf(previous.date) : Number.NaN;
          const showGap = Number.isFinite(gapYears) && gapYears >= GAP_YEARS_THRESHOLD;
          return (
            <li className="ds-era-timeline__item" key={`${event.date}-${index}`}>
              {showGap ? (
                <span className="ds-era-timeline__gap" aria-hidden="true">
                  {gapLabel(gapYears)}
                </span>
              ) : null}
              <div className="ds-era-timeline__row">
                <span className="ds-era-timeline__dot" aria-hidden="true" />
                <time className="ds-era-timeline__date-label" dateTime={event.date.trim()}>
                  {formatDateLabel(event.date)}
                </time>
                <span className="ds-era-timeline__event-label">{event.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {currentEra ? (
        <figcaption className="ds-era-timeline__caption">
          {currentEra.label}
          {currentEra.span ? ` (${currentEra.span})` : ''}
        </figcaption>
      ) : null}
    </figure>
  );
}
