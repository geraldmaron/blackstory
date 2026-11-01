/**
 * Chronology layout for a Records collection: the same rows as the index, regrouped by the
 * earliest decade the archive documents each record in. Presentation only; grouping, order and
 * counts come from `lib/discovery/collection-chronology.ts`.
 *
 * Copy speaks of documented decades and archive buckets, never event years. Coverage lists the
 * decades that hold records, so a gap between 1880s and 2000s reads as a gap. Records with no
 * documented decade sit in their own section, after every dated one.
 *
 * Rows are the shared `HairlineIndex` rows (native record links, evidence meter, kind glyph), so
 * the evidence and kind vocabulary is the one the index already draws.
 */
import React from 'react';
import { HairlineIndex, type IndexRow } from '../room';
import './records-chronology.css';

void React;

export type ChronologySectionView = {
  readonly key: string;
  readonly label: string;
  /** Records of this group across every page. */
  readonly total: number;
  readonly shown: number;
  readonly continued: boolean;
  readonly undated: boolean;
  readonly rows: readonly IndexRow[];
};

export type RecordsChronologyProps = {
  readonly sections: readonly ChronologySectionView[];
  readonly coverageLabel: string;
  readonly undatedCount: number;
  /** Rendered when no section has rows. */
  readonly empty: React.ReactNode;
};

function n(value: number): string {
  return value.toLocaleString('en-US');
}

function shownLabel(section: ChronologySectionView): string {
  const base =
    section.shown === section.total
      ? `${n(section.total)} ${section.total === 1 ? 'record' : 'records'}`
      : `${n(section.shown)} of ${n(section.total)} records shown here`;
  return section.continued ? `${base}, continued from the previous page` : base;
}

export function RecordsChronology({
  sections,
  coverageLabel,
  undatedCount,
  empty,
}: RecordsChronologyProps) {
  if (sections.length === 0) return <>{empty}</>;
  return (
    <div className="ds-chronology" data-layout="chronology">
      <p className="ds-chronology__coverage">
        {coverageLabel}
        {undatedCount > 0
          ? ` ${n(undatedCount)} ${undatedCount === 1 ? 'record has' : 'records have'} no documented decade.`
          : ''}
      </p>
      {sections.map((section) => (
        <section
          key={section.key}
          className="ds-chronology__section"
          data-undated={section.undated ? 'true' : undefined}
          aria-labelledby={`chronology-${section.key}`}
        >
          <h2 className="ds-chronology__heading" id={`chronology-${section.key}`}>
            {section.label}
          </h2>
          <HairlineIndex countLabel={shownLabel(section)} rows={section.rows} />
        </section>
      ))}
    </div>
  );
}
