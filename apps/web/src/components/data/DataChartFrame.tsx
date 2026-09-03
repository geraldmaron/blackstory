/**
 * The Data Figure: the one anatomy every chart on `/data` renders through.
 *
 * In order, top to bottom: a mono figure label, the title, one plain sentence saying what the
 * figure shows (the reading, carrying the headline number in words so the figure is legible
 * without the graphic), the graphic, the caption stating the figure's limits, the source line,
 * and a native "Show the numbers" disclosure holding the full table.
 *
 * The table used to be visually hidden. It is now a disclosure, because a reader checking a
 * figure wants the numbers and a screen reader is served better by the reading sentence plus a
 * table they can open than by a hidden table they cannot find. The disclosure is a `<details>`
 * so it works before hydration and with JavaScript off.
 *
 * Multi-source figures pass `sources`; single-source figures may pass `sourceLabel` and
 * `sourceUrl`. The figure never renders without a source line: a chart with no named series
 * behind it is not a figure this page publishes.
 */
import React, { type ReactNode } from 'react';
import { cx } from '@repo/ui';
import { SourceFootnote, type DataSourceRef } from './SourceFootnote';

void React;

export type DataChartFrameProps = {
  readonly title: string;
  /** One sentence, sans face, saying what the figure shows. Carries the headline number. */
  readonly reading?: ReactNode;
  /** The figure's limits: what the series does and does not measure. */
  readonly caption: ReactNode;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  /** The full table. Rendered inside the numbers disclosure. */
  readonly textAlternative: ReactNode;
  readonly sourceLabel?: string;
  readonly sourceUrl?: string;
  readonly sources?: readonly DataSourceRef[];
  /** Mono label above the title: "Figure 1". Supplied by the section, which owns the count. */
  readonly figureLabel?: string;
  /** `wide` spans the section's full measure; `half` shares a row with a sibling. */
  readonly span?: 'wide' | 'half';
  /** Anchor for the figure, so a reader can cite one figure and not the page. */
  readonly id?: string;
  readonly className?: string;
};

export function DataChartFrame({
  title,
  reading,
  caption,
  sourceLabel,
  sourceUrl,
  sources,
  children,
  ariaLabel,
  textAlternative,
  figureLabel,
  span = 'wide',
  id,
  className,
}: DataChartFrameProps) {
  const resolvedSources: readonly DataSourceRef[] =
    sources ??
    (sourceLabel !== undefined && sourceUrl !== undefined
      ? [{ label: sourceLabel, url: sourceUrl }]
      : []);

  return (
    <figure
      className={cx('ds-datafig', span === 'half' && 'ds-datafig--half', className)}
      {...(id ? { id } : {})}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
    >
      <figcaption className="ds-datafig__head">
        {figureLabel ? <span className="ds-datafig__label">{figureLabel}</span> : null}
        <span className="ds-datafig__title">{title}</span>
        {reading ? <span className="ds-datafig__reading">{reading}</span> : null}
      </figcaption>
      <div className="ds-datafig__viz">{children}</div>
      <p className="ds-datafig__caption">{caption}</p>
      <SourceFootnote sources={resolvedSources} density="compact" className="ds-datafig__source" />
      <details className="ds-datafig__numbers">
        <summary className="ds-datafig__numbers-summary">Show the numbers</summary>
        <div className="ds-datafig__numbers-body">{textAlternative}</div>
      </details>
    </figure>
  );
}
