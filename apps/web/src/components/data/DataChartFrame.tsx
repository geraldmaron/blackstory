/**
 * Shared `<figure>` wrapper for `/data` page SVG charts: title, visualization slot,
 * descriptive caption, and mandatory source citation (public-numeric-policy category 3).
 */
import React, { type ReactNode } from 'react';

export type DataChartFrameProps = {
  readonly title: string;
  readonly caption: ReactNode;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly textAlternative: ReactNode;
};

export function DataChartFrame({
  title,
  caption,
  sourceLabel,
  sourceUrl,
  children,
  ariaLabel,
  textAlternative,
}: DataChartFrameProps) {
  return (
    <figure className="bp-data-chart" {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}>
      <figcaption className="bp-data-chart__title">{title}</figcaption>
      <div className="bp-data-chart__viz">{children}</div>
      <p className="bp-data-chart__caption bp-sans">{caption}</p>
      <div className="bp-visually-hidden">{textAlternative}</div>
      <p className="bp-citation bp-data-chart__source">
        <span className="bp-citation__label">Source</span>
        <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
          {sourceLabel}
        </a>
      </p>
    </figure>
  );
}
