/**
 * The Door below the fold: the archive in four color-blocked chapters, each about one screen,
 * scrolling up over the fixed map.
 *
 *   paper   the record count as a giant numeral, three record sheets peeking from the block's foot
 *   copper  the lead chapter's cover, edge to edge
 *   sand    the archive's decade axis, drawn large in ink
 *   ink     how evidence is graded, the grade marks drawn large
 *
 * Every number comes from the same records index `/records` builds (`loadRecordsIndex`), so the
 * Door and the register cannot disagree. Server-rendered; no client code.
 */
import React from 'react';
import Link from 'next/link';
import { Block, DisplayNumeral, Sheet, buttonClassName } from '@repo/ui';
import type { PublicStoryListItemDoc } from '@repo/schemas';
import type { RecordsFacet, RecordsRow } from '../lib/records/build-records-index';
import { coverDek } from '../components/story/story-text';
import { CoverImage } from './stories/StoriesIndexParts';
import { KindGlyph } from '../components/map-experience/KindGlyph';

void React;

export type DoorChaptersProps = {
  readonly total: number;
  /** Three records for the sheets, with a thumbnail URL when the record has an image. */
  readonly records: readonly { readonly row: RecordsRow; readonly photoUrl?: string }[];
  readonly lead: PublicStoryListItemDoc | undefined;
  /** Records per documented decade (the register's Era facet). */
  readonly decades: readonly RecordsFacet[];
  /** Records per evidence grade (the register's Evidence facet). */
  readonly grades: readonly RecordsFacet[];
};

export type DecadeBar = { readonly year: number; readonly label: string; readonly count: number };

/**
 * The decade axis on a true time scale: every decade from the first documented to the last, in
 * order, so a century with no records takes a century's width. Empty decades count 0. Only real
 * decades ("1770s") are read from the facets.
 */
export function decadeBars(facets: readonly RecordsFacet[]): readonly DecadeBar[] {
  const counts = new Map<number, number>();
  for (const facet of facets) {
    const year = Number.parseInt(facet.id, 10);
    if (Number.isFinite(year)) counts.set(year, (counts.get(year) ?? 0) + facet.count);
  }
  if (counts.size === 0) return [];
  const first = Math.min(...counts.keys());
  const last = Math.max(...counts.keys());
  const bars: DecadeBar[] = [];
  for (let year = first; year <= last; year += 10) {
    bars.push({ year, label: `${year}s`, count: counts.get(year) ?? 0 });
  }
  return bars;
}

export function DoorChapters({ total, records, lead, decades, grades }: DoorChaptersProps) {
  const bars = decadeBars(decades);
  const documented = bars.filter((bar) => bar.count > 0);
  const peak = Math.max(1, ...bars.map((bar) => bar.count));
  const busiest = bars.find((bar) => bar.count === peak);
  return (
    <div className="ds-door-chapters">
      <Block tone="paper" className="ds-door-ch ds-door-ch--count" aria-labelledby="door-ch-count">
        <div className="ds-wrap ds-door-ch__inner">
          <h2 className="ds-door-ch__title" id="door-ch-count">
            <DisplayNumeral className="ds-door-ch__numeral">
              {total.toLocaleString('en-US')}
            </DisplayNumeral>
            <span className="ds-door-ch__title-line">records, each one cited</span>
          </h2>
          <p className="ds-door-ch__line">
            People, places, events, laws and inventions, every one with the sources it rests on and
            the place those sources put it.
          </p>
          <Link className={buttonClassName('primary')} href="/records">
            Browse the records
          </Link>
          <ul className="ds-door-ch__sheets">
            {records.map(({ row, photoUrl }) => (
              <li key={row.id}>
                <Sheet as="article" className="ds-door-ch__sheet">
                  <span className="ds-door-ch__sheet-media" aria-hidden="true">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnail
                      <img src={photoUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <KindGlyph kind={row.kind} size={40} />
                    )}
                  </span>
                  {/* The decade is stated nowhere else on the card, so it is read, not decorative. */}
                  <DisplayNumeral className="ds-door-ch__sheet-decade">{row.era}</DisplayNumeral>
                  <h3 className="ds-door-ch__sheet-name">
                    <Link href={row.href}>{row.name}</Link>
                  </h3>
                  <p className="ds-door-ch__sheet-place">{row.place}</p>
                </Sheet>
              </li>
            ))}
          </ul>
        </div>
      </Block>

      {lead ? (
        <Block
          tone="copper"
          className="ds-door-ch ds-door-ch--story"
          aria-labelledby="door-ch-story"
        >
          <div className="ds-door-ch__cover" aria-hidden="true">
            {/* Lazy, at normal priority: the browser starts it well before it scrolls into view,
                and it never competes with the map and the headline for the first viewport. */}
            <CoverImage item={lead} width={1600} />
          </div>
          <div className="ds-wrap ds-door-ch__inner">
            <p className="ds-door-ch__years">{lead.eraLabel}</p>
            <h2 className="ds-door-ch__story-title" id="door-ch-story">
              <Link href={`/stories/${lead.slug}`}>{lead.title}</Link>
            </h2>
            <p className="ds-door-ch__dek">{coverDek(lead.summary)}</p>
            <div className="ds-door-ch__actions">
              <Link className={buttonClassName('primary')} href={`/stories/${lead.slug}`}>
                Read the chapter
              </Link>
              <Link className={buttonClassName('quiet')} href="/stories">
                All stories
              </Link>
            </div>
          </div>
        </Block>
      ) : null}

      {documented.length > 0 ? (
        <Block tone="sand" className="ds-door-ch ds-door-ch--time" aria-labelledby="door-ch-time">
          <div className="ds-wrap ds-door-ch__inner">
            <h2 className="ds-door-ch__title ds-door-ch__title--plain" id="door-ch-time">
              {documented.length} decades on record
            </h2>
            <p className="ds-door-ch__line">
              Each bar is a decade on a true time scale, as tall as the records in it; a gap is
              decades with none.
              {busiest
                ? ` The ${busiest.label} hold the most, ${busiest.count.toLocaleString('en-US')}.`
                : ''}
            </p>
            <figure className="ds-door-ch__axis">
              {/* A picture of the counts, not a set of controls: the list below it carries them. */}
              <ol className="ds-door-ch__bars" aria-hidden="true">
                {bars.map((bar) => (
                  <li
                    key={bar.year}
                    className="ds-door-ch__bar"
                    data-empty={bar.count === 0 ? 'true' : undefined}
                    style={{ '--bar': bar.count / peak } as React.CSSProperties}
                  >
                    <span className="ds-door-ch__bar-fill" />
                    {bar.year % 50 === 0 ? (
                      <span className="ds-door-ch__bar-year">{bar.year}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <figcaption className="ds-visually-hidden">
                Records per documented decade:{' '}
                {documented
                  .map((bar) => `${bar.label}, ${bar.count.toLocaleString('en-US')}`)
                  .join('; ')}
                .
              </figcaption>
            </figure>
            <Link className={buttonClassName('primary')} href="/records?layout=chronology">
              Open the timeline
            </Link>
          </div>
        </Block>
      ) : null}

      <Block
        tone="ink"
        className="ds-door-ch ds-door-ch--evidence"
        aria-labelledby="door-ch-evidence"
      >
        <div className="ds-wrap ds-door-ch__inner">
          <h2 className="ds-door-ch__title ds-door-ch__title--plain" id="door-ch-evidence">
            Every record carries its grade
          </h2>
          <p className="ds-door-ch__line">
            A grade says how well the sources hold a record up: how many independent publishers
            stand behind it, and how directly they say it.
          </p>
          <ul className="ds-door-ch__grades">
            {grades.map((grade) => (
              <li key={grade.id} className="ds-door-ch__grade">
                <a href={grade.href}>
                  <span className="ds-door-ch__grade-mark" aria-hidden="true">
                    {grade.id.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="ds-door-ch__grade-label">{grade.label}</span>
                  <span className="ds-door-ch__grade-count">
                    {grade.count.toLocaleString('en-US')} records
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <Link className={buttonClassName('secondary')} href="/methodology">
            How a record is graded
          </Link>
        </div>
      </Block>
    </div>
  );
}
