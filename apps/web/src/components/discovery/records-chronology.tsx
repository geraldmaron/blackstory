/**
 * Chronology layout for a Records collection: the same rows as the index, regrouped by the
 * earliest decade the archive documents each record in. Presentation only; grouping, order and
 * counts come from `lib/discovery/collection-chronology.ts`.
 *
 * Copy speaks of documented decades and archive buckets, never event years. A decade strip gives
 * the shape of the collection (one bar per decade that holds records, a decade with none has no
 * bar) and every bar is a plain link to the page and anchor where that decade begins, so a reader
 * can reach the 1950s without paging there. Records with no documented decade sit in their own
 * section, after every dated one.
 *
 * Rows are the shared `HairlineIndex` rows (native record links, evidence meter, kind glyph), so
 * the evidence and kind vocabulary is the one the index already draws. The decade is stated once,
 * as the section's numeral, not again on every row.
 */
import React from 'react';
import { HairlineIndex, type IndexRow } from '../room';
import './records-chronology.css';

void React;

export type ChronologySectionView = {
  readonly key: string;
  /** Full name for assistive tech: "Documented in the 1750s". */
  readonly label: string;
  /** The numeral drawn large in the ledger margin: "1750s". Empty for the undated section. */
  readonly numeral: string;
  /** Records of this group across every page. */
  readonly total: number;
  readonly shown: number;
  readonly continued: boolean;
  readonly undated: boolean;
  readonly rows: readonly IndexRow[];
  /** The same decade on the map; absent for the undated section. */
  readonly mapHref?: string;
};

export type ChronologyStripItem = {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** `null` for a decade with no records: an empty slot that keeps the gap visible. */
  readonly href: string | null;
  /** 0 to 100, from `decadeDensityBars`. */
  readonly heightPercent: number;
  /** This decade has rows on the page being read. */
  readonly here: boolean;
  /** Page the decade starts on, for the accessible name. */
  readonly page: number;
};

export type ChronologyCentury = {
  readonly label: string;
  readonly href: string;
  readonly here: boolean;
};

export type RecordsChronologyProps = {
  readonly sections: readonly ChronologySectionView[];
  readonly strip: readonly ChronologyStripItem[];
  /** One link per century that holds records; the bars alone are too narrow to tap on a phone. */
  readonly centuries: readonly ChronologyCentury[];
  readonly undatedCount: number;
  readonly undatedHref: string | null;
  /** Rendered when no section has rows. */
  readonly empty: React.ReactNode;
};

function n(value: number): string {
  return value.toLocaleString('en-US');
}

function recordsWord(count: number): string {
  return count === 1 ? 'record' : 'records';
}

function summaryLabel(section: ChronologySectionView): string {
  const base =
    section.shown === section.total
      ? `${n(section.total)} ${recordsWord(section.total)}`
      : `${n(section.shown)} of ${n(section.total)} records shown here`;
  return section.continued ? `${base}, continued from the previous page` : base;
}

export function RecordsChronology({
  sections,
  strip,
  centuries,
  undatedCount,
  undatedHref,
  empty,
}: RecordsChronologyProps) {
  if (sections.length === 0) return <>{empty}</>;
  return (
    <div className="ds-chronology" data-layout="chronology">
      {strip.length > 0 ? (
        <nav className="ds-chronology__strip" aria-label="Jump to a documented decade">
          <ol className="ds-chronology__bars">
            {strip.map((item) => (
              <li key={item.key} className="ds-chronology__bar-item">
                {item.href === null ? (
                  <span className="ds-chronology__bar" aria-hidden="true" />
                ) : (
                  <a
                    className="ds-chronology__bar"
                    href={item.href}
                    data-here={item.here ? 'true' : undefined}
                    aria-current={item.here ? 'location' : undefined}
                    aria-label={`${item.label}, ${n(item.count)} ${recordsWord(item.count)}, starts on page ${item.page}`}
                    title={`${item.label}: ${n(item.count)} ${recordsWord(item.count)}`}
                  >
                    <span
                      className="ds-chronology__bar-fill"
                      style={{ height: `${item.heightPercent}%` }}
                      aria-hidden="true"
                    />
                  </a>
                )}
              </li>
            ))}
          </ol>
          <p className="ds-chronology__axis" aria-hidden="true">
            <span>{strip[0]?.label}</span>
            <span>{strip[strip.length - 1]?.label}</span>
          </p>
          {centuries.length > 1 ? (
            <ul className="ds-chronology__centuries">
              {centuries.map((century) => (
                <li key={century.label}>
                  <a
                    className="ds-chronology__century"
                    href={century.href}
                    data-here={century.here ? 'true' : undefined}
                  >
                    {century.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </nav>
      ) : null}
      <p className="ds-chronology__note">
        Each record sits once, under the earliest decade the archive documents it in.
        {undatedCount > 0 ? (
          <>
            {' '}
            {undatedHref ? (
              <a href={undatedHref}>
                {n(undatedCount)} {undatedCount === 1 ? 'record has' : 'records have'} no documented
                decade
              </a>
            ) : (
              `${n(undatedCount)} ${undatedCount === 1 ? 'record has' : 'records have'} no documented decade`
            )}
            .
          </>
        ) : null}
      </p>
      {sections.map((section) => (
        <section
          key={section.key}
          id={`decade-${section.key}`}
          className="ds-chronology__section"
          data-undated={section.undated ? 'true' : undefined}
          aria-labelledby={`chronology-${section.key}`}
        >
          <div className="ds-chronology__margin">
            <h2 className="ds-chronology__heading" id={`chronology-${section.key}`}>
              {section.undated ? (
                section.label
              ) : (
                <>
                  <span className="ds-visually-hidden">Documented in the </span>
                  {section.numeral}
                </>
              )}
            </h2>
            <p className="ds-chronology__count">{summaryLabel(section)}</p>
            {section.mapHref ? (
              <a className="ds-chronology__map" href={section.mapHref}>
                See the {section.numeral} on the map
              </a>
            ) : null}
          </div>
          <HairlineIndex countLabel={summaryLabel(section)} rows={section.rows} />
        </section>
      ))}
    </div>
  );
}
