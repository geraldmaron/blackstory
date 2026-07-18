/**
 * Shared `<figure>` wrapper for `/data` page SVG charts: title, visualization slot,
 * descriptive caption, and mandatory source citation(s). Multi-source charts pass
 * `sources`; single-source charts may use `sourceLabel` + `sourceUrl`.
 */
import React, { type ReactNode } from 'react';
import { SourceFootnote, type DataSourceRef } from './SourceFootnote';

export type DataChartFrameProps = {
  readonly title: string;
  readonly caption: ReactNode;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly textAlternative: ReactNode;
  readonly sourceLabel?: string;
  readonly sourceUrl?: string;
  readonly sources?: readonly DataSourceRef[];
};

export function DataChartFrame({
  title,
  caption,
  sourceLabel,
  sourceUrl,
  sources,
  children,
  ariaLabel,
  textAlternative,
}: DataChartFrameProps) {
  const resolvedSources: readonly DataSourceRef[] =
    sources ??
    (sourceLabel !== undefined && sourceUrl !== undefined
      ? [{ label: sourceLabel, url: sourceUrl }]
      : []);

  return (
    <figure className="bp-data-chart" {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}>
      <figcaption className="bp-data-chart__title">{title}</figcaption>
      <div className="bp-data-chart__viz">{children}</div>
      <p className="bp-data-chart__caption bp-sans">{caption}</p>
      <div className="bp-visually-hidden">{textAlternative}</div>
      <SourceFootnote sources={resolvedSources} density="group" className="bp-data-chart__source" />
    </figure>
  );
}
