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
import { RECORDS_FILTER_KEYS, recordsHref } from '../../lib/records/build-records-index';
import { CollectionContext } from '../../components/discovery/collection-context';
import { CollectionPeriodControls } from '../../components/discovery/collection-period-controls';
import { RecordsChronology } from '../../components/discovery/records-chronology';
import { documentedCoverageLabel } from '../../lib/discovery/collection-period';
import type { RecordsRow } from '../../lib/records/build-records-index';
import type { RecordsQuery } from '../../lib/records/records-query';

void React;

/** The scope params a text search, facet form or sort link must carry so none is overwritten. */
function scopeParams(query: RecordsQuery): Record<string, string> {
  return {
    ...(query.collection.length > 0 ? { collection: query.collection } : {}),
    ...(query.periodStart.length > 0 ? { periodStart: query.periodStart } : {}),
    ...(query.periodEnd.length > 0 ? { periodEnd: query.periodEnd } : {}),
    ...(query.includeUndated ? { includeUndated: '1' } : {}),
    ...(query.layout === 'chronology' ? { layout: 'chronology' } : {}),
  };
}

function toIndexRows(rows: readonly RecordsRow[], showCoverage = false) {
  return rows.map((row) => ({
    href: row.href,
    name: row.name,
    note: [
      row.mappable === false ? 'Not on the map' : '',
      showCoverage ? documentedCoverageLabel(row.documentedDecades ?? []) : '',
    ]
      .filter(Boolean)
      .join(' · '),
    place: row.place,
    era: row.era,
    glyph: (
      <KindGlyph kind={row.kind} {...(row.mapTone ? { mapTone: row.mapTone } : {})} size={13} />
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
  }));
}

type FilterKey = (typeof RECORDS_FILTER_KEYS)[number];

/** Plain-language names for the orderings; `discovery` is what the bare URL means. */
const SORTS = Object.freeze([
  { id: 'discovery', label: 'Best evidence' },
  { id: 'era', label: 'Earliest' },
  { id: 'name', label: 'Name' },
  { id: 'evidence', label: 'Evidence' },
] as const);

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
    totalMatched,
    mappableMatched,
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
    collection,
    notice,
    indexHref,
    chronologyHref,
    periodClearHref,
    periodDecades,
    undatedExcluded,
    chronology,
  } = model;
  const scope = scopeParams(query);
  const periodPreserved = Object.fromEntries(
    Object.entries({
      ...(query.q.length > 0 ? { q: query.q } : {}),
      ...Object.fromEntries(
        RECORDS_FILTER_KEYS.filter((key) => query[key].length > 0).map((key) => [key, query[key]]),
      ),
      ...(query.sort !== 'discovery' ? { sort: query.sort } : {}),
      ...(query.collection.length > 0 ? { collection: query.collection } : {}),
      ...(query.layout === 'chronology' ? { layout: 'chronology' } : {}),
    }),
  ) as Record<string, string>;

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
        className="ds-records-entry"
        {...(constraints.length === 0
          ? { lede: 'The map shows where a record sits. This list shows what the archive holds.' }
          : {})}
        showCrumb={false}
      />

      {/* One workbench: the collection heading and view choice, then the find field and facets,
          directly above the rows they narrow. */}
      <div className="ds-records-workbench">
        {/* Server-rendered: the view choice and honest counts need no JavaScript. The page is
          already the list, so Records is the current view and Map carries the same narrowing. */}
        <CollectionContext
          className="ds-collection--flat"
          activeView={query.layout === 'chronology' ? 'chronology' : 'records'}
          mapHref={atlasHref}
          recordsHref={indexHref}
          chronologyHref={chronologyHref}
          {...(collection.state === 'live'
            ? {
                source: {
                  label: collection.title,
                  href: collection.href,
                  unresolvedCount: collection.unresolvedCount,
                },
              }
            : {})}
          {...(notice !== undefined ? { unresolved: notice.message } : {})}
          matched={typeof totalMatched === 'number' ? totalMatched : null}
          drawable={typeof mappableMatched === 'number' ? mappableMatched : null}
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
          preserved={{
            ...Object.fromEntries(RECORDS_FILTER_KEYS.map((key) => [key, query[key]])),
            ...(query.sort !== 'discovery' ? { sort: query.sort } : {}),
            ...scope,
          }}
          /*
           * The index had no sort at all: 4,210 records could only be read best-evidence-first,
           * then earliest era. FindBar already renders a sort row — /law and /books both use it
           * — so this is the existing control, not a new one.
           */
          sort={SORTS.map((option) => ({
            label: option.label,
            // The whole query rides along, so re-ordering never drops the collection, range or
            // layout. A new order starts at page one.
            href: recordsHref({ ...query, sort: option.id, page: 1 }),
            active: query.sort === option.id,
          }))}
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
                    {active ? (
                      <span className="ds-records-facet__value">{active.label}</span>
                    ) : null}
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
                        {query.q.length > 0 ? (
                          <input type="hidden" name="q" value={query.q} />
                        ) : null}
                        {Object.entries(scope).map(([name, value]) => (
                          <input key={name} type="hidden" name={name} value={value} />
                        ))}
                        {query.sort !== 'discovery' ? (
                          <input type="hidden" name="sort" value={query.sort} />
                        ) : null}
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
                          rel={option.nofollow ? 'nofollow' : undefined}
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

        {/* A sibling of the find form, never nested in it. Hidden fields keep every other param. */}
        <CollectionPeriodControls
          action="/records"
          preserved={periodPreserved}
          decades={periodDecades}
          start={query.periodStart}
          end={query.periodEnd}
          includeUndated={query.includeUndated}
          clearHref={periodClearHref}
          undatedExcluded={undatedExcluded}
        />
      </div>

      {notice !== undefined ? (
        /* An unresolved collection or unreadable range is stated, never shown as an empty or
           whole archive. The collection strip above carries the same message for a collection. */
        <EmptyList
          title={
            notice.kind === 'collection'
              ? 'This collection cannot be shown'
              : 'This decade range cannot be read'
          }
        >
          {notice.message}{' '}
          <a href={notice.kind === 'collection' ? clearAllHref : periodClearHref}>
            {notice.kind === 'collection' ? 'Browse every record' : 'Clear the range'}
          </a>
          .
        </EmptyList>
      ) : (
        (() => {
          const empty = (
            <EmptyList title="No record matches this narrowing">
              {collection.state === 'live' && collection.memberIds.length === 0 ? (
                <>
                  This story links to no records in this public release. That says nothing about the
                  sources it was written from, which are listed on the story.{' '}
                  <a href={collection.href}>Read the story</a> or{' '}
                  <a href={clearAllHref}>browse every record</a>.
                </>
              ) : constraints.length > 0 ? (
                <>
                  Nothing in the release matches {constraints.map((c) => c.label).join(', ')}.{' '}
                  <a href={clearAllHref}>Clear every constraint</a> to see all{' '}
                  {totalAll.toLocaleString('en-US')} records.
                </>
              ) : (
                <>The release is empty. This is a fault on our side, not an absence of history.</>
              )}
            </EmptyList>
          );
          return chronology !== undefined ? (
            <RecordsChronology
              sections={chronology.sections.map((section) => ({
                key: section.decade === null ? 'undated' : String(section.decade),
                label: section.label,
                total: section.total,
                shown: section.shown,
                continued: section.continued,
                undated: section.decade === null,
                rows: toIndexRows(section.rows, true),
              }))}
              coverageLabel={
                pageCount > 1
                  ? `${chronology.coverageLabel} Page ${page} of ${pageCount}.`
                  : chronology.coverageLabel
              }
              undatedCount={chronology.undatedCount}
              empty={empty}
            />
          ) : (
            <HairlineIndex
              countLabel={
                pageCount > 1 ? `${countLabel} · page ${page} of ${pageCount}` : countLabel
              }
              rows={toIndexRows(rows)}
              empty={empty}
            />
          );
        })()
      )}

      {pageCount > 1 ? (
        <nav className="ds-records-pager" aria-label="Records pages">
          {previousHref === undefined ? (
            <span className="ds-records-pager__spacer" />
          ) : (
            <a
              className="ds-records-pager__link ds-cta ds-cta--quiet ds-cta--sm"
              href={previousHref}
              rel="prev"
            >
              ← Previous 100
            </a>
          )}
          <span className="ds-records-pager__at">{`Page ${page} of ${pageCount}`}</span>
          {nextHref === undefined ? (
            <span className="ds-records-pager__spacer" />
          ) : (
            <a
              className="ds-records-pager__link ds-cta ds-cta--quiet ds-cta--sm"
              href={nextHref}
              rel="next"
            >
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
      </OffRamp>
    </Room>
  );
}
