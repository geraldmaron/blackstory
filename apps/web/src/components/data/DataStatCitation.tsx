/**
 * One published statistic. Prefer `DataStatStrip` for strips so shared sources
 * render once; this leaf stays available for single-stat call sites and tests.
 */
import type { ReactNode } from 'react';
import { SourceFootnote, type DataSourceRef } from './SourceFootnote';

export type DataStatCitationProps = {
  readonly value: string;
  readonly label: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly note?: ReactNode;
  /** Extra sources beyond the primary one — listed in the same compact footnote. */
  readonly additionalSources?: readonly DataSourceRef[];
};

export function DataStatCitation({
  value,
  label,
  sourceLabel,
  sourceUrl,
  note,
  additionalSources,
}: DataStatCitationProps) {
  const sources: DataSourceRef[] = [
    { label: sourceLabel, url: sourceUrl },
    ...(additionalSources ?? []),
  ];

  return (
    <li className="bp-data-strip__item">
      <span className="bp-data-strip__value">{value}</span>
      <span className="bp-data-strip__label">{label}</span>
      {note ? <p className="bp-data-strip__note bp-sans">{note}</p> : null}
      <SourceFootnote sources={sources} density="compact" />
    </li>
  );
}
