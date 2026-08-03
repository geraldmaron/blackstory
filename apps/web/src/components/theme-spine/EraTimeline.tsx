/**
 * Theme-spine "era timeline" moment: a horizontal strip of dated events for a chapter,
 * sourced from a theme-impact packet's dated artifacts (the packet's `event_timeline`
 * evidence-spine item — see `THEME_IMPACT_MULTI_DECADE_CHECKLIST_ITEMS` in
 * packages/domain/src/statistics/theme-impact-packet.ts) plus the packet's policy eras.
 *
 * Hairline axis with a copper tick + label per event; the chapter's own era band (when it
 * matches one of the packet's `policyEras`) renders as a low-alpha `sand` wash behind its
 * span. Inline SVG, static (no animation — reduced-motion is a non-issue here by design).
 * Scrolls horizontally in its own `overflow-x: auto` container so a long span never causes
 * page-level horizontal overflow.
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

const TRACK_HEIGHT = 96;
const AXIS_Y = 56;
const MIN_EVENT_SPACING = 96;
const SIDE_PADDING = 32;

function yearOf(date: string): number {
  const match = /^-?\d{1,4}/.exec(date.trim());
  return match ? Number.parseInt(match[0], 10) : Number.NaN;
}

function formatDateLabel(date: string): string {
  return date.trim();
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

export function EraTimeline({ events, policyEras, currentEraId, className }: EraTimelineProps) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return null;
  }

  const years = sorted.map((event) => yearOf(event.date));
  const minYear = Math.min(...years.filter((year) => !Number.isNaN(year)));
  const maxYear = Math.max(...years.filter((year) => !Number.isNaN(year)));
  const span = maxYear - minYear || 1;

  const width = Math.max(480, SIDE_PADDING * 2 + (sorted.length - 1) * MIN_EVENT_SPACING);
  const usableWidth = width - SIDE_PADDING * 2;

  function xForYear(year: number): number {
    if (Number.isNaN(year)) return SIDE_PADDING;
    const ratio = (year - minYear) / span;
    return SIDE_PADDING + ratio * usableWidth;
  }

  const currentEra = policyEras?.find((era) => era.id === currentEraId);

  const rootClassName = ['ds-era-timeline', className].filter(Boolean).join(' ');
  const ariaLabel = summarizeSpan(sorted);

  return (
    <figure className={rootClassName}>
      <div className="ds-era-timeline__scroller">
        <svg
          className="ds-era-timeline__svg"
          viewBox={`0 0 ${width} ${TRACK_HEIGHT}`}
          width={width}
          height={TRACK_HEIGHT}
          role="img"
          aria-label={ariaLabel}
          preserveAspectRatio="xMinYMid meet"
        >
          {currentEra ? (
            <rect
              className="ds-era-timeline__era-band"
              x={0}
              y={0}
              width={width}
              height={TRACK_HEIGHT}
            />
          ) : null}

          <line
            className="ds-era-timeline__axis"
            x1={SIDE_PADDING}
            y1={AXIS_Y}
            x2={width - SIDE_PADDING}
            y2={AXIS_Y}
          />

          {sorted.map((event, index) => {
            const x = xForYear(years[index]!);
            return (
              <g className="ds-era-timeline__event" key={`${event.date}-${index}`}>
                <line
                  className="ds-era-timeline__tick"
                  x1={x}
                  y1={AXIS_Y - 8}
                  x2={x}
                  y2={AXIS_Y + 8}
                />
                <circle className="ds-era-timeline__dot" cx={x} cy={AXIS_Y} r={3} />
                <text
                  className="ds-era-timeline__date-label"
                  x={x}
                  y={AXIS_Y - 16}
                  textAnchor="middle"
                >
                  {formatDateLabel(event.date)}
                </text>
                <text
                  className="ds-era-timeline__event-label"
                  x={x}
                  y={AXIS_Y + 24}
                  textAnchor="middle"
                >
                  {event.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {currentEra ? (
        <figcaption className="ds-era-timeline__caption">
          {currentEra.label}
          {currentEra.span ? ` (${currentEra.span})` : ''}
        </figcaption>
      ) : null}
    </figure>
  );
}
