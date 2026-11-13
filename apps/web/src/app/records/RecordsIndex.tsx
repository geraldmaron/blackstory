/**
 * `/records` — the register. Presentation only; every number and href comes from
 * `lib/records/build-records-index.ts`.
 *
 * Header with the one count, one toolbar row, the active narrowing as removable chips (only when
 * set), then the rows as a list or along a time axis, then the pager. The header search is the
 * only search on the page; it carries `q` in and the chip row echoes it.
 *
 * Nothing here requires JavaScript. Menus are native popovers of GET links, rows are anchors,
 * the pager is anchors with rel=prev/next and the decade jump is a GET form.
 */

import React from 'react';
import { Chip, DisplayNumeral, PageTitle, Sheet, buttonClassName } from '@repo/ui';
import { Room } from '../../components/room';
import { RecordsTimeline } from '../../components/discovery/records-chronology';
import {
  RECORDS_FILTER_KEYS,
  decadeAnchor,
  recordsHref,
  type RecordsFacet,
  type RecordsFilterKey,
  type RecordsIndex as RecordsIndexModel,
  type RecordsQuery,
  type RecordsRow,
  type RecordsSort,
} from '../../lib/records/build-records-index';
import { recordsQueryString } from '../../lib/records/records-query';
import { earliestDecade } from '../../lib/records/records-matching';
import { DecadeJump } from './DecadeJump';
import { RecordRow } from './RecordRow';
import { RecordsToolbar, type ToolbarMenu } from './RecordsToolbar';

void React;

const FILTER_TITLES: Readonly<Record<RecordsFilterKey, string>> = Object.freeze({
  kind: 'Kind',
  era: 'Era',
  state: 'State',
  topic: 'Topic',
  status: 'Status',
  evidence: 'Evidence',
});

/**
 * The orders the Sort menu offers. The default (`discovery`, never written into the URL) is
 * relevance for a search and earliest otherwise, so earliest is its own option only with a search.
 */
function sortMenu(query: RecordsQuery): ToolbarMenu {
  const searching = query.q.length > 0;
  const options: readonly { readonly id: RecordsSort; readonly label: string }[] = [
    { id: 'discovery', label: searching ? 'Best match' : 'Earliest first' },
    ...(searching ? [{ id: 'era' as const, label: 'Earliest first' }] : []),
    { id: 'name', label: 'Name, A to Z' },
    { id: 'evidence', label: 'Strongest evidence' },
  ];
  const current: RecordsSort = !searching && query.sort === 'era' ? 'discovery' : query.sort;
  return {
    key: 'sort',
    title: 'Sort',
    value: options.find((option) => option.id === current)?.label ?? 'Earliest first',
    active: 0,
    options: options.map((option) => ({
      id: option.id,
      label: option.label,
      // A new order starts at page one; the narrowing and layout ride along.
      href: recordsHref({ ...query, sort: option.id, page: 1 }),
      current: option.id === current,
    })),
  };
}

/**
 * A menu reads in the order its values have: decades in time, states by name, the rest by how
 * many records each holds (the builder's order). The current value carries a check, so it needs
 * no pinning in a menu.
 */
function menuOrder(
  key: RecordsFilterKey,
  options: readonly RecordsFacet[],
): readonly RecordsFacet[] {
  if (key === 'era') {
    return [...options].sort(
      (a, b) => Number.parseInt(a.id, 10) - Number.parseInt(b.id, 10) || a.id.localeCompare(b.id),
    );
  }
  if (key === 'state') return [...options].sort((a, b) => a.label.localeCompare(b.label));
  return options;
}

function filterMenus(model: RecordsIndexModel): ToolbarMenu[] {
  const { query, facets, constraints } = model;
  return RECORDS_FILTER_KEYS.map((key) => {
    // Every button stays, so the toolbar never changes shape; an empty menu says why.
    const options = menuOrder(key, facets[key]);
    const active = options.find((option) => option.id === query[key]);
    const clearHref = constraints.find((constraint) => constraint.key === key)?.clearHref;
    return {
      key,
      title: FILTER_TITLES[key],
      value: active?.label ?? 'Any',
      active: active === undefined ? 0 : 1,
      options: options.map((option) => ({
        id: option.id,
        label: option.label,
        count: option.count,
        href: option.href,
        current: option.id === query[key],
        nofollow: option.nofollow,
      })),
      ...(clearHref === undefined ? {} : { clearHref }),
    };
  });
}

/** Row anchors for the list read in time order: the first row of each decade on the page. */
function decadeAnchors(rows: readonly RecordsRow[]): ReadonlyMap<string, string> {
  const anchors = new Map<string, string>();
  const seen = new Set<number | null>();
  for (const row of rows) {
    const decade = earliestDecade({ eraBuckets: row.documentedDecades ?? [] });
    if (seen.has(decade)) continue;
    seen.add(decade);
    anchors.set(row.id, decadeAnchor(decade));
  }
  return anchors;
}

function ArrowGlyph({ direction }: { readonly direction: 'prev' | 'next' }) {
  return (
    <svg className="ds-records-pager__arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={direction === 'prev' ? 'M10 3.5 5.5 8l4.5 4.5' : 'm6 3.5 4.5 4.5L6 12.5'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Outcome({
  title,
  children,
  action,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly action: { readonly href: string; readonly label: string };
}) {
  return (
    <div className="ds-records-outcome" role="status">
      <h2 className="ds-records-outcome__title">{title}</h2>
      <p className="ds-records-outcome__body">{children}</p>
      <a className={buttonClassName('secondary')} href={action.href}>
        {action.label}
      </a>
    </div>
  );
}

/** What was asked for, in words: `“churhc” in People, Georgia`. */
function searchedPhrase(model: RecordsIndexModel): string {
  const { query, constraints } = model;
  const narrowing = constraints.filter((constraint) => constraint.key !== 'q');
  const term = query.q.length > 0 ? `“${query.q}”` : '';
  const scope = narrowing.map((constraint) => constraint.label).join(', ');
  if (term && scope) return `${term} in ${scope}`;
  return term || scope;
}

function NoMatch({ model }: { readonly model: RecordsIndexModel }) {
  const { query, collection, constraints, clearAllHref } = model;
  if (collection.state === 'live' && collection.memberIds.length === 0) {
    return (
      <Outcome
        title="This story links to no records yet"
        action={{ href: collection.href, label: 'Read the story' }}
      >
        None of the records it cites is in this public release. Its sources are listed on the story.
      </Outcome>
    );
  }
  if (constraints.length === 0) {
    return (
      <Outcome title="The release is empty" action={{ href: '/', label: 'Go to the map' }}>
        This is a fault on our side, not an absence of history.
      </Outcome>
    );
  }
  // One way out. With a search and filters, drop the filters and keep the words; otherwise clear
  // what narrowed it. The total is the dek's to state, not the button's.
  const narrowed = constraints.some((constraint) => constraint.key !== 'q');
  const action =
    query.q.length > 0 && narrowed
      ? {
          href: recordsHref({ q: query.q, layout: query.layout }),
          label: `Search all records for “${query.q}”`,
        }
      : { href: clearAllHref, label: narrowed ? 'Clear filters' : 'Clear search' };
  return (
    <Outcome title="No records match" action={action}>
      Nothing in the archive matches {searchedPhrase(model)}.
    </Outcome>
  );
}

function countPhrase(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'record' : 'records'}`;
}

export type RecordsIndexProps = {
  readonly model: RecordsIndexModel;
  /** Record id to its thumbnail URL, for the rows on this page that have an image. */
  readonly photos?: Readonly<Record<string, string>>;
};

export function RecordsIndexRoom({ model, photos = {} }: RecordsIndexProps) {
  const {
    query,
    rows,
    page,
    pageCount,
    countLabel,
    previousHref,
    nextHref,
    constraints,
    clearAllHref,
    atlasHref,
    notice,
    indexHref,
    chronologyHref,
    periodClearHref,
    decadeJumps,
    chronology,
  } = model;
  const timeline = query.layout === 'chronology';
  const filters = filterMenus(model);
  const filterCount = constraints.filter((constraint) => constraint.key !== 'q').length;

  const toolbar = (
    <RecordsToolbar
      filters={filters}
      sort={sortMenu(query)}
      view={{
        label: 'Show records as',
        value: timeline ? 'timeline' : 'list',
        options: [
          { value: 'list', label: 'List', href: indexHref },
          { value: 'timeline', label: 'Timeline', href: chronologyHref },
        ],
      }}
      activeCount={filterCount}
      showLabel={`Show ${countPhrase(model.totalMatched)}`}
      {...(filterCount > 0
        ? // The sheet clears the filters it holds; the search stays, its chip clears it.
          { clearAllHref: recordsHref({ q: query.q, sort: query.sort, layout: query.layout }) }
        : {})}
    />
  );

  let body: React.ReactNode;
  if (notice !== undefined) {
    // An unresolved collection or unreadable range is stated, never shown as an empty or whole
    // archive.
    body =
      notice.kind === 'collection' ? (
        <Outcome
          title="This story's records cannot be shown"
          action={{ href: clearAllHref, label: 'Browse every record' }}
        >
          {notice.message}
        </Outcome>
      ) : (
        <Outcome
          title="This decade range cannot be read"
          action={{ href: periodClearHref, label: 'Clear the range' }}
        >
          {notice.message}
        </Outcome>
      );
  } else if (rows.length === 0) {
    body = <NoMatch model={model} />;
  } else if (timeline && chronology !== undefined) {
    const startPage = new Map(chronology.coverage.map((item) => [item.decade, item.page]));
    body = (
      <RecordsTimeline
        bands={chronology.sections.map((section) => ({
          decade: section.decade,
          anchor: decadeAnchor(section.decade),
          total: section.total,
          continuedFrom: section.continued
            ? section.decade === null
              ? chronology.undatedPage
              : (startPage.get(section.decade) ?? null)
            : null,
          rows: section.rows.map((row) => (
            <RecordRow key={row.id} row={row} query={query.q} compact photoUrl={photos[row.id]} />
          )),
        }))}
      />
    );
  } else {
    const anchors = decadeJumps.length > 0 ? decadeAnchors(rows) : new Map<string, string>();
    body = (
      <Sheet className="ds-records-paper">
        <ol className="ds-records-list">
          {rows.map((row) => (
            <RecordRow
              key={row.id}
              row={row}
              query={query.q}
              anchor={anchors.get(row.id)}
              photoUrl={photos[row.id]}
            />
          ))}
        </ol>
      </Sheet>
    );
  }

  const preserved = [
    ...new URLSearchParams(recordsQueryString({ ...query, page: 1 })).entries(),
  ] as const;

  return (
    <Room width="wide" className="ds-records">
      {/* The title at display scale with the count beside it as a giant copper numeral. The dek
          says the count in words (and how it is narrowed), so the numeral is not read twice. */}
      <header className="ds-records-head">
        <PageTitle className="ds-records-head__title">Records</PageTitle>
        <DisplayNumeral className="ds-records-head__count" decorative>
          {model.totalMatched.toLocaleString('en-US')}
        </DisplayNumeral>
        <p className="ds-records-head__dek">{countLabel}</p>
      </header>
      {toolbar}

      {constraints.length > 0 ? (
        <div className="ds-records-active">
          <ul className="ds-records-active__chips" aria-label="Active filters">
            {constraints.map((constraint) => (
              <li key={constraint.key}>
                <Chip removable href={constraint.clearHref} label={constraint.label}>
                  {constraint.label}
                </Chip>
              </li>
            ))}
          </ul>
          {constraints.length > 1 ? (
            <a className={buttonClassName('quiet')} href={clearAllHref}>
              Clear all
            </a>
          ) : null}
          {notice === undefined && rows.length > 0 ? (
            <a className={buttonClassName('quiet', 'ds-records-active__map')} href={atlasHref}>
              Show these on the map
            </a>
          ) : null}
        </div>
      ) : null}

      {body}

      {pageCount > 1 ? (
        <nav className="ds-records-pager" aria-label="Pages">
          {previousHref === undefined ? (
            <span className={buttonClassName('secondary')} aria-disabled="true">
              <ArrowGlyph direction="prev" />
              Previous
            </span>
          ) : (
            <a className={buttonClassName('secondary')} href={previousHref} rel="prev">
              <ArrowGlyph direction="prev" />
              Previous
            </a>
          )}
          <p className="ds-records-pager__at">
            Page <span className="ds-records-pager__num">{page}</span> of{' '}
            <span className="ds-records-pager__num">{pageCount}</span>
          </p>
          {nextHref === undefined ? (
            <span className={buttonClassName('secondary')} aria-disabled="true">
              Next
              <ArrowGlyph direction="next" />
            </span>
          ) : (
            <a className={buttonClassName('secondary')} href={nextHref} rel="next">
              Next
              <ArrowGlyph direction="next" />
            </a>
          )}
          {decadeJumps.length > 1 ? (
            <DecadeJump
              jumps={decadeJumps.map((jump) => ({
                label: jump.label,
                page: jump.page,
                href: jump.href,
              }))}
              preserved={preserved}
            />
          ) : null}
        </nav>
      ) : null}
    </Room>
  );
}
