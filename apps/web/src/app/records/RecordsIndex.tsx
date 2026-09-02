/**
 * `/records` — the room. Presentation only; every number and href comes from
 * `lib/records/build-records-index.ts`.
 *
 * Nothing on this surface requires JavaScript. Filter chips are anchors, rows are anchors, the
 * search field is a plain GET form, and prev/next are real anchors in the server HTML. That is
 * the acceptance criterion, and it is also the reason this room is the archive's crawlable
 * index rather than a second view of the Atlas.
 */

import React from 'react';
import {
  EmptyList,
  HairlineIndex,
  OffRamp,
  RailGroup,
  Room,
  RoomHeader,
} from '../../components/room';
import { KindGlyph } from '../../components/map-experience/KindGlyph';
import type { RecordsIndex as RecordsIndexModel } from '../../lib/records/build-records-index';
import { RECORDS_FILTER_KEYS } from '../../lib/records/build-records-index';

void React;

const FILTER_GROUP_LABELS: Readonly<Record<(typeof RECORDS_FILTER_KEYS)[number], string>> =
  Object.freeze({
    kind: 'Kind',
    era: 'Era',
    state: 'State',
    topic: 'Topic',
    status: 'Status',
    evidence: 'Grade',
  });

/**
 * The chip bar shows the vocabulary a reader can act on without drowning the surface. Six, not
 * eight: at eight most groups wrapped to a second line, which doubled the panel's height and put
 * the first record below the fold. The rail carries the long tail of era and state, and the tail
 * of every group stays reachable through search.
 */
const CHIPS_PER_GROUP = 6;

export type RecordsIndexProps = {
  readonly model: RecordsIndexModel;
  readonly releaseLabel: string;
};

export function RecordsIndexRoom({ model, releaseLabel }: RecordsIndexProps) {
  const {
    query,
    rows,
    totalAll,
    page,
    pageCount,
    countLabel,
    previousHref,
    nextHref,
    facets,
    eraGroups,
    stateGroups,
    constraints,
    clearAllHref,
    atlasHref,
    atlasReason,
  } = model;

  const rail = (
    <>
      <RailGroup
        title="By era"
        entries={eraGroups.map((group) => ({
          label: group.label,
          href: group.href,
          count: group.count,
        }))}
        limit={12}
      />
      <RailGroup
        title="By state"
        entries={stateGroups.map((group) => ({
          label: group.label,
          href: group.href,
          count: group.count,
        }))}
        limit={12}
      />
    </>
  );

  return (
    <Room rail={rail}>
      <RoomHeader
        pathname="/records"
        kicker="The whole archive, as a list"
        title="Records"
        lede={
          <>
            Every record in the release as a list. The map shows where a record sits. This list
            shows what the archive holds.
          </>
        }
        meta={[
          `${totalAll.toLocaleString('en-US')} records`,
          releaseLabel,
          'Readable without the map',
        ]}
        showPath={false}
      />

      {/*
        One control line: the find field and every facet, side by side. The filters used to be a
        panel of six labelled chip rows, which cost most of a screen before the first record —
        on a 1440 canvas the index opened on its own controls. Each facet is now a native
        `<details>`, so the vocabulary is one click away rather than gone, and the whole thing
        still works with JavaScript off: a disclosure is markup, and every chip inside it is a
        GET link.
      */}
      <div className="ds-records-controls">
        <form className="ds-records-find" action="/records" method="get" role="search">
          <label className="ds-visually-hidden" htmlFor="records-q">
            Find a record by name or summary
          </label>
          <div className="ds-records-find__row">
            <input
              className="ds-records-find__input"
              id="records-q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder="Search names, places"
              autoComplete="off"
            />
            <button className="ds-records-find__go" type="submit">
              Search
            </button>
          </div>
          {/*
            The other constraints ride along as hidden fields, so submitting the text field narrows
            within the current filter rather than silently resetting it. `page` is deliberately not
            carried: a new term starts at page one.
          */}
          {RECORDS_FILTER_KEYS.filter((key) => query[key].length > 0).map((key) => (
            <input key={key} type="hidden" name={key} value={query[key]} />
          ))}
        </form>

        {RECORDS_FILTER_KEYS.map((key) => {
          const options = facets[key];
          if (options.length === 0) return null;
          const active = options.find((option) => option.id === query[key]);
          return (
            <details className="ds-records-facet" key={key}>
              <summary className="ds-records-facet__pill" data-active={active ? 'true' : undefined}>
                {FILTER_GROUP_LABELS[key]}
                {active ? <span className="ds-records-facet__value">{active.label}</span> : null}
              </summary>
              <div
                className="ds-records-facet__menu"
                role="group"
                aria-label={FILTER_GROUP_LABELS[key]}
              >
                {options.slice(0, CHIPS_PER_GROUP).map((option) => (
                  <a
                    className="ds-room-chip"
                    href={option.href}
                    key={option.id}
                    aria-current={option.id === query[key] ? true : undefined}
                  >
                    {option.label} <span className="ds-room-num">{option.count}</span>
                  </a>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {constraints.length > 0 ? (
        <div className="ds-records-active" role="group" aria-label="Active constraints">
          {constraints.map((constraint) => (
            <a className="ds-records-active__chip" href={constraint.clearHref} key={constraint.key}>
              {constraint.label}
              <span className="ds-records-active__x" aria-hidden="true">
                ✕
              </span>
              <span className="ds-visually-hidden"> — remove this constraint</span>
            </a>
          ))}
          <a className="ds-records-active__clear" href={clearAllHref}>
            Clear all
          </a>
        </div>
      ) : null}

      <HairlineIndex
        countLabel={pageCount > 1 ? `${countLabel} · page ${page} of ${pageCount}` : countLabel}
        rows={rows.map((row) => ({
          href: row.href,
          name: row.name,
          place: row.place,
          era: row.era,
          glyph: (
            <KindGlyph
              kind={row.kind}
              {...(row.mapTone ? { mapTone: row.mapTone } : {})}
              size={13}
            />
          ),
          grade: (
            <span
              className={`ds-records-grade ds-records-grade--${row.grade ?? 'none'}`}
              title={row.gradeDescription}
            >
              <span className="ds-visually-hidden">{row.gradeDescription}</span>
              <span aria-hidden="true">{row.grade ?? '·'}</span>
            </span>
          ),
        }))}
        empty={
          <EmptyList title="No record matches this narrowing">
            {constraints.length > 0 ? (
              <>
                Nothing in the release matches {constraints.map((c) => c.label).join(', ')}.{' '}
                <a href={clearAllHref}>Clear every constraint</a> to see all{' '}
                {totalAll.toLocaleString('en-US')} records.
              </>
            ) : (
              <>The release is empty. This is a fault on our side, not an absence of history.</>
            )}
          </EmptyList>
        }
      />

      {pageCount > 1 ? (
        <nav className="ds-records-pager" aria-label="Records pages">
          {previousHref === undefined ? (
            <span className="ds-records-pager__spacer" />
          ) : (
            <a className="ds-records-pager__link" href={previousHref} rel="prev">
              ← Previous 100
            </a>
          )}
          <span className="ds-records-pager__at">{`Page ${page} of ${pageCount}`}</span>
          {nextHref === undefined ? (
            <span className="ds-records-pager__spacer" />
          ) : (
            <a className="ds-records-pager__link" href={nextHref} rel="next">
              Next 100 →
            </a>
          )}
        </nav>
      ) : null}

      <OffRamp
        title={
          <>
            See the same records in <em>place</em>
          </>
        }
        actions={[
          { href: atlasHref, label: 'Open this selection in Explore', emphasis: 'copper' },
          { href: '/methodology', label: 'How a record gets in' },
          { href: '/submit', label: 'Submit a record we are missing' },
        ]}
      >
        {atlasReason}
        {query.q.length > 0 ? (
          <> Explore has no text search, so that part of this narrowing stays here.</>
        ) : null}
      </OffRamp>
    </Room>
  );
}
