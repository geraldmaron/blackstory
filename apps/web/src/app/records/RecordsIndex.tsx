/**
 * `/records` — the room. Presentation only; every number and href comes from
 * `lib/records/build-records-index.ts`.
 *
 * Nothing on this surface requires JavaScript. Filter chips are anchors, rows are anchors, the
 * search field is a plain GET form, and prev/next are real anchors in the server HTML. That is
 * the acceptance criterion, and it is also the reason this room is the archive's crawlable
 * index rather than a second view of the map.
 */

import React from 'react';
import {
  EmptyList,
  FindBar,
  HairlineIndex,
  OffRamp,
  OrientationInstrument,
  ReadingEntry,
  DocumentColophon,
  Room,
} from '../../components/room';
import { meterLevelForTier, RecordMeter } from '../../components/entity/RecordChrome';
import { KindGlyph } from '../../components/map-experience/KindGlyph';
import { AutoSubmitSelect } from '../../components/forms/AutoSubmitSelect';
import type { RecordsIndex as RecordsIndexModel } from '../../lib/records/build-records-index';
import { RECORDS_FILTER_KEYS } from '../../lib/records/build-records-index';

void React;

type FilterKey = (typeof RECORDS_FILTER_KEYS)[number];

const FILTER_GROUP_LABELS: Readonly<Record<FilterKey, string>> = Object.freeze({
  kind: 'Kind',
  era: 'Era',
  state: 'State',
  topic: 'Topic',
  status: 'Status',
  evidence: 'Grade',
});

/** The first option of a long facet's select: the narrowing lifted. */
const FILTER_ALL_LABELS: Readonly<Record<FilterKey, string>> = Object.freeze({
  kind: 'All kinds',
  era: 'All eras',
  state: 'All states',
  topic: 'All topics',
  status: 'All statuses',
  evidence: 'Any grade',
});

/**
 * A facet with more values than this opens as a native select holding every value; a shorter one
 * stays a row of chips. The tray used to show the first six chips and drop the rest, so most
 * states, eras and topics could not be picked from the facet at all.
 */
const CHIP_FACET_MAX = 8;

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
    <OrientationInstrument
      where={`${countLabel} in the list`}
      {...(query.era.length > 0 ? { eraBand: query.era } : {})}
      moves={[
        {
          label: 'Open the map',
          icon: 'explore' as const,
          href: atlasHref,
          note: atlasReason,
        },
        ...(eraGroups[0]
          ? [
              {
                label: `Browse ${eraGroups[0].label}`,
                icon: 'time' as const,
                href: eraGroups[0].href,
                note: `${eraGroups[0].count.toLocaleString('en-US')} records`,
              },
            ]
          : []),
        ...(stateGroups[0]
          ? [
              {
                label: `Browse ${stateGroups[0].label}`,
                icon: 'place' as const,
                href: stateGroups[0].href,
                note: `${stateGroups[0].count.toLocaleString('en-US')} records`,
              },
            ]
          : []),
      ].slice(0, 3)}
    />
  );

  return (
    <Room ledger rail={rail}>
      <ReadingEntry
        pathname="/records"
        title={
          <>
            Everything the archive <em>holds</em>.
          </>
        }
        lede="The map shows where a record sits. This list shows what the archive holds."
        showCrumb={false}
      />

      {/*
        One control line: the find field and every facet, side by side. Each facet is a native
        `<details>`, so the vocabulary is one click away, and the whole thing still works with
        JavaScript off: a disclosure is markup, and every chip inside it is a GET link.

        The shared `name` makes them an exclusive accordion: only one at a time, since the
        facets narrow one set together rather than side by side.
      */}
      <FindBar
        id="records"
        action="/records"
        queryLabel="Find a record by name or summary"
        placeholder="Search names, places"
        query={query.q}
        /* The other constraints ride along, so submitting the text field narrows within the
           current filter rather than silently resetting it. `page` is deliberately not carried:
           a new term starts at page one. */
        preserved={Object.fromEntries(RECORDS_FILTER_KEYS.map((key) => [key, query[key]]))}
        active={constraints.map((constraint) => ({
          key: constraint.key,
          label: constraint.label,
          href: constraint.clearHref,
        }))}
        clearHref={clearAllHref}
      >
        <div className="ds-records-controls">
          {RECORDS_FILTER_KEYS.map((key) => {
            const options = facets[key];
            if (options.length === 0) return null;
            const active = options.find((option) => option.id === query[key]);
            return (
              <details className="ds-records-facet" key={key} name="records-facet">
                <summary
                  className="ds-records-facet__pill"
                  data-active={active ? 'true' : undefined}
                >
                  {FILTER_GROUP_LABELS[key]}
                  {active ? <span className="ds-records-facet__value">{active.label}</span> : null}
                </summary>
                <div
                  className="ds-records-facet__menu"
                  role="group"
                  aria-label={FILTER_GROUP_LABELS[key]}
                >
                  {options.length > CHIP_FACET_MAX ? (
                    /*
                    A long vocabulary (every state, every era, every topic) is a list to pick
                    from, not a wall of chips to scan. A native select gives the whole list with
                    the platform's own picker on a phone, applies on change, and without
                    JavaScript the form still submits through its fallback button. The other
                    narrowings ride along as hidden fields, as in the find form above.
                  */
                    <form className="ds-records-facet__form" action="/records" method="get">
                      {query.q.length > 0 ? <input type="hidden" name="q" value={query.q} /> : null}
                      {RECORDS_FILTER_KEYS.filter(
                        (other) => other !== key && query[other].length > 0,
                      ).map((other) => (
                        <input key={other} type="hidden" name={other} value={query[other]} />
                      ))}
                      <AutoSubmitSelect
                        id={`records-facet-${key}`}
                        name={key}
                        label={FILTER_GROUP_LABELS[key]}
                        defaultValue={active ? active.id : ''}
                        options={[
                          { value: '', label: FILTER_ALL_LABELS[key] },
                          ...options.map((option) => ({
                            value: option.id,
                            label: `${option.label} (${option.count.toLocaleString('en-US')})`,
                          })),
                        ]}
                      />
                      <noscript>
                        <button className="ds-records-find__go" type="submit">
                          Show
                        </button>
                      </noscript>
                    </form>
                  ) : (
                    options.map((option) => (
                      <a
                        className="ds-room-chip"
                        href={option.href}
                        key={option.id}
                        aria-current={option.id === query[key] ? true : undefined}
                      >
                        {option.label} <span className="ds-room-num">{option.count}</span>
                      </a>
                    ))
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </FindBar>

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
          /*
           * The same evidence meter the Explore rail, the record sheet and the record page draw.
           */
          grade: (
            <span className="ds-records-grade" title={row.gradeDescription}>
              <RecordMeter
                className="ds-records-grade__meter"
                level={meterLevelForTier(row.confidenceTier)}
                tone={row.confidenceTier}
                label={row.gradeDescription}
              />
              <span
                className="ds-records-grade__letter"
                data-grade={row.confidenceTier}
                aria-hidden="true"
              >
                {row.grade ?? '·'}
              </span>
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

      <DocumentColophon
        facts={[
          `${totalAll.toLocaleString('en-US')} records`,
          releaseLabel,
          'Readable without the map',
        ]}
      />

      <OffRamp
        title={
          <>
            See the same records in <em>place</em>
          </>
        }
        actions={[
          { href: atlasHref, label: 'Open this selection on the map', emphasis: 'copper' },
          { href: '/methodology', label: 'How a record gets in' },
          { href: '/submit', label: 'Submit a record the archive is missing' },
        ]}
      >
        {atlasReason}
        {query.q.length > 0 ? (
          <> The map has no text search, so that part of this narrowing stays here.</>
        ) : null}
      </OffRamp>
    </Room>
  );
}
