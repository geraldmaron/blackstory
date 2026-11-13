/**
 * The figure: the one anatomy every chart on `/data`, `/lives` and `/lives/explorer` renders
 * through.
 *
 * Top to bottom: the finding as the title (a sentence carrying the headline number), one quiet
 * line naming what is plotted, the graphic with its direct labels, then one footer row: the
 * source, and Limits and Numbers, which open the caption and the full table under the row.
 *
 * The figure imports the chart stylesheet itself, so any page that renders a figure is styled on a
 * direct load. A figure never renders without a source: a chart with no named series behind it is
 * not a figure this site publishes.
 */
import React, { type ReactNode } from 'react';
import { cx } from '@repo/ui';
import { FigureFoot } from './FigureFoot';
import type { DataSourceRef } from './SourceFootnote';
import './data-charts.css';

void React;

export type DataChartFrameProps = {
  /** What is plotted, plainly: "Black share of the U.S. population, 1790 to 2020". */
  readonly title: string;
  /** The finding, one sentence with its number. Becomes the figure's heading when present. */
  readonly reading?: ReactNode;
  /** The figure's limits: what the series does and does not measure. */
  readonly caption: ReactNode;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  /** The full table, behind Numbers. */
  readonly textAlternative: ReactNode;
  readonly sourceLabel?: string;
  readonly sourceUrl?: string;
  readonly sources?: readonly DataSourceRef[];
  /** `wide` spans the section's full measure; `half` shares a row with its pair. */
  readonly span?: 'wide' | 'half';
  /** Anchor for the figure, so a reader can cite one figure and not the page. */
  readonly id?: string;
  readonly chapterHref?: string;
  /** Heading level of the finding: 3 under a page section, 4 inside a nested panel. */
  readonly headingLevel?: 3 | 4;
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
  span = 'wide',
  id,
  chapterHref,
  headingLevel = 3,
  className,
}: DataChartFrameProps) {
  const resolvedSources: readonly DataSourceRef[] =
    sources ??
    (sourceLabel !== undefined && sourceUrl !== undefined
      ? [{ label: sourceLabel, url: sourceUrl }]
      : []);
  const Heading = headingLevel === 4 ? 'h4' : 'h3';

  return (
    <figure
      className={cx('ds-datafig', span === 'half' && 'ds-datafig--half', className)}
      {...(id ? { id } : {})}
      aria-label={ariaLabel ?? title}
    >
      <figcaption className="ds-datafig__head">
        <Heading className="ds-datafig__title">{reading ?? title}</Heading>
        {reading ? <p className="ds-datafig__subtitle">{title}</p> : null}
      </figcaption>
      <div className="ds-datafig__viz">{children}</div>
      <FigureFoot
        title={title}
        sources={resolvedSources}
        limits={caption}
        numbers={textAlternative}
        {...(chapterHref ? { chapterHref } : {})}
      />
    </figure>
  );
}
