/**
 * The `/books` index body: the register's toolbar (State, Author, Sort, and a Covers | States
 * switch), the active narrowing as removable chips, then either the cover wall (large covers on
 * a full-bleed ink block, each with a copper tab naming its states) or the states by challenge
 * count (a sand block: the tile map in copper steps beside a paper sheet of ranked states).
 *
 * Server-rendered and JavaScript-free apart from the cover's image fallback: menus are the
 * register's native popovers of GET links, and every cover and state is an anchor.
 */
import React from 'react';
import Link from 'next/link';
import { Block, Chip, DisplayNumeral, Sheet, buttonClassName } from '@repo/ui';
import { RecordsToolbar, type ToolbarMenu } from '../records/RecordsToolbar';
import { Outcome } from '../records/RecordsIndex';
import {
  BOOKS_SORT_PRESETS,
  bookStateName,
  buildBooksBrowseHref,
  type BooksBrowseItem,
  type BooksBrowseViewModel,
  type BooksView,
} from './books-view-model';
import { BooksCoverArt } from './BooksCoverArt';
import { STATE_TILES } from './state-tiles';
import { BOOKS_INDEX_NOTE } from './books-copy';

void React;

export type BooksBrowseSectionsProps = {
  readonly view: BooksBrowseViewModel;
};

type Params = Parameters<typeof buildBooksBrowseHref>[0];

function currentParams(view: BooksBrowseViewModel): Params {
  return {
    q: view.q,
    state: view.state,
    author: view.author,
    sort: view.sort,
    dir: view.dir,
    view: view.view,
  };
}

function statesPhrase(count: number): string {
  if (count === 0) return 'State not recorded';
  return `Challenged in ${count} ${count === 1 ? 'state' : 'states'}`;
}

function titlesPhrase(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'title' : 'titles'}`;
}

function filterMenus(view: BooksBrowseViewModel): ToolbarMenu[] {
  const params = currentParams(view);
  const states = [...view.stateCounts].sort((a, b) => a.name.localeCompare(b.name));
  return [
    {
      key: 'state',
      title: 'State',
      value: view.state === 'all' ? 'Any' : bookStateName(view.state),
      active: view.state === 'all' ? 0 : 1,
      options: states.map((entry) => ({
        id: entry.code,
        label: entry.name,
        count: entry.count,
        href: buildBooksBrowseHref({ ...params, state: entry.code, view: 'covers' }),
        current: entry.code === view.state,
      })),
      ...(view.state === 'all'
        ? {}
        : { clearHref: buildBooksBrowseHref({ ...params, state: 'all' }) }),
    },
    {
      key: 'author',
      title: 'Author',
      value: view.author === 'all' ? 'Any' : view.author,
      active: view.author === 'all' ? 0 : 1,
      options: view.authorCounts.map((entry) => ({
        id: entry.name,
        label: entry.name,
        count: entry.count,
        href: buildBooksBrowseHref({ ...params, author: entry.name }),
        current: entry.name === view.author,
      })),
      ...(view.author === 'all'
        ? {}
        : { clearHref: buildBooksBrowseHref({ ...params, author: 'all' }) }),
    },
  ];
}

function sortMenu(view: BooksBrowseViewModel): ToolbarMenu {
  const params = currentParams(view);
  return {
    key: 'sort',
    title: 'Sort',
    value: view.sortLabel,
    active: 0,
    options: BOOKS_SORT_PRESETS.map((preset) => ({
      id: `${preset.sort}-${preset.dir}`,
      label: preset.label,
      href: buildBooksBrowseHref({ ...params, sort: preset.sort, dir: preset.dir }),
      current: preset.sort === view.sort && preset.dir === view.dir,
    })),
  };
}

type ActiveFilter = { readonly key: string; readonly label: string; readonly href: string };

function activeFilters(view: BooksBrowseViewModel): ActiveFilter[] {
  const params = currentParams(view);
  const active: ActiveFilter[] = [];
  const q = view.q.trim();
  // The header search lands on /records; a `q` here comes from an older link, and still narrows.
  if (q)
    active.push({ key: 'q', label: `“${q}”`, href: buildBooksBrowseHref({ ...params, q: '' }) });
  if (view.state !== 'all') {
    active.push({
      key: 'state',
      label: bookStateName(view.state),
      href: buildBooksBrowseHref({ ...params, state: 'all' }),
    });
  }
  if (view.author !== 'all') {
    active.push({
      key: 'author',
      label: view.author,
      href: buildBooksBrowseHref({ ...params, author: 'all' }),
    });
  }
  return active;
}

/** The closing note, set as a caption inside the last block so the page meets the footer on it. */
function BooksNote() {
  return (
    <p className="ds-books-note">
      {BOOKS_INDEX_NOTE} <Link href="/methodology">How this list is built</Link>
    </p>
  );
}

/**
 * The sand lead over the cover wall: the state with the most challenged titles as a display
 * numeral, then the next four in mono. Every entry opens the states view; the numbers are the
 * same `stateCounts` the states view ranks.
 */
function StatesLead({ view }: { readonly view: BooksBrowseViewModel }) {
  const [top, ...rest] = view.stateCounts;
  if (!top) return null;
  const href = buildBooksBrowseHref({ ...currentParams(view), view: 'states' });
  return (
    <Block tone="sand" className="ds-books-lead">
      <div className="ds-wrap ds-books-lead__inner">
        <a className="ds-books-lead__top" href={href}>
          <DisplayNumeral size="title" className="ds-books-lead__numeral">
            {top.count.toLocaleString('en-US')}
          </DisplayNumeral>
          <span className="ds-books-lead__label">
            <span className="ds-books-lead__state">{top.name}</span>
            <span className="ds-books-lead__unit">
              {top.count === 1 ? 'title' : 'titles'} challenged, the most of any state
            </span>
          </span>
        </a>
        <ol className="ds-books-lead__rest" aria-label="Next states by challenged titles">
          {rest.slice(0, 4).map((entry) => (
            <li key={entry.code}>
              <a className="ds-books-lead__row" href={href}>
                <span>{entry.name}</span>
                <span className="ds-books-lead__count">{titlesPhrase(entry.count)}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </Block>
  );
}

function CoverWall({ items }: { readonly items: readonly BooksBrowseItem[] }) {
  return (
    <Block tone="ink" className="ds-books-band">
      <div className="ds-wrap">
        <ul className="ds-books-wall" aria-label="Challenged titles">
          {items.map((item) => (
            <li key={item.id}>
              <Link className="ds-books-wall__link" href={`/books/${item.slug}`}>
                <span className="ds-books-wall__frame">
                  <BooksCoverArt
                    className="ds-books-wall__cover"
                    title={item.title}
                    author={item.authorNames}
                    // The wall draws a cover about 220px wide; the medium file is 145px and blurred.
                    size="L"
                    {...(item.coverIsbn ? { isbn: item.coverIsbn } : {})}
                  />
                  {/* A copper tab pinned to the cover's foot; sand when no report names a state. */}
                  <span
                    className="ds-books-wall__states"
                    data-ground={item.states.length > 0 ? 'copper' : 'sand'}
                  >
                    {statesPhrase(item.states.length)}
                  </span>
                </span>
                <span className="ds-books-wall__title">{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
        <BooksNote />
      </div>
    </Block>
  );
}

/** Steps for the tile grid: paper, copper, copper text, ink; none is an outline (books.css). */
const TILE_STEPS = 4;

/** Square root, so the states behind one outlier still read apart from each other. */
export function tileStep(count: number, max: number): number {
  return count <= 0 || max <= 0 ? 0 : Math.ceil(Math.sqrt(count / max) * TILE_STEPS);
}

/** The legend's ranges, read off `tileStep` itself so the key cannot drift from the tiles. */
export function tileLegend(max: number): { step: number; from: number; to: number }[] {
  const ranges: { step: number; from: number; to: number }[] = [];
  for (let count = 1; count <= max; count += 1) {
    const step = tileStep(count, max);
    const range = ranges.at(-1);
    if (range?.step === step) range.to = count;
    else ranges.push({ step, from: count, to: count });
  }
  return ranges;
}

/**
 * The states by how many titles carry a cited challenge there. The tile grid is the picture: a
 * state code and a shade, decorative, since the ranked list beside it prints every number. The
 * list is the control, each row a link to the cover wall filtered to that state.
 */
function StateView({ view }: { readonly view: BooksBrowseViewModel }) {
  const params = currentParams(view);
  const counts = new Map(view.stateCounts.map((entry) => [entry.code, entry.count]));
  const max = Math.max(...view.stateCounts.map((entry) => entry.count));
  return (
    <Block tone="sand" className="ds-books-band ds-books-band--states">
      <div className="ds-wrap ds-books-states">
        <div className="ds-books-map" aria-hidden="true">
          <div className="ds-books-tiles">
            {Object.entries(STATE_TILES).map(([code, [row, column]]) => {
              const step = tileStep(counts.get(code) ?? 0, max);
              return (
                <span
                  key={code}
                  className="ds-books-tiles__tile"
                  data-step={step}
                  data-current={code === view.state ? 'true' : undefined}
                  style={{ gridRow: row + 1, gridColumn: column + 1 }}
                >
                  {code}
                </span>
              );
            })}
          </div>
          <ul className="ds-books-legend">
            {tileLegend(max).map((range) => (
              <li key={range.step}>
                <span className="ds-books-tiles__tile" data-step={range.step} />
                {range.from === range.to ? range.from : `${range.from} to ${range.to}`}{' '}
                {range.to === 1 ? 'title' : 'titles'}
              </li>
            ))}
          </ul>
        </div>

        <Sheet className="ds-books-ranks-sheet">
          <ol className="ds-books-ranks" aria-label="States by challenged titles">
            {view.stateCounts.map((entry) => (
              <li key={entry.code}>
                <a
                  className="ds-books-ranks__row"
                  href={buildBooksBrowseHref({ ...params, state: entry.code, view: 'covers' })}
                  aria-current={entry.code === view.state ? 'true' : undefined}
                >
                  <span className="ds-books-ranks__name">{entry.name}</span>
                  <span className="ds-books-ranks__bar" aria-hidden="true">
                    <span style={{ width: `${(entry.count / max) * 100}%` }} />
                  </span>
                  <span className="ds-books-ranks__count">{titlesPhrase(entry.count)}</span>
                </a>
              </li>
            ))}
          </ol>
        </Sheet>
        <BooksNote />
      </div>
    </Block>
  );
}

export function BooksBrowseSections({ view }: BooksBrowseSectionsProps) {
  const params = currentParams(view);
  const active = activeFilters(view);
  const facets = active.filter((filter) => filter.key !== 'q').length;
  const viewHref = (value: BooksView) => buildBooksBrowseHref({ ...params, view: value });
  const clearHref = buildBooksBrowseHref({
    q: '',
    state: 'all',
    author: 'all',
    sort: view.sort,
    dir: view.dir,
    view: view.view,
  });

  const empty = view.view === 'states' ? view.stateCounts.length === 0 : view.items.length === 0;
  let body: React.ReactNode;
  if (view.view === 'states') {
    body =
      view.stateCounts.length === 0 ? (
        <Outcome title="No states to show" action={{ href: clearHref, label: 'Clear filters' }}>
          No title matching {active.map((filter) => filter.label).join(', ')} carries a cited
          challenge with a state.
        </Outcome>
      ) : (
        <StateView view={view} />
      );
  } else {
    body =
      view.items.length === 0 ? (
        <Outcome title="No titles match" action={{ href: clearHref, label: 'Clear filters' }}>
          Nothing in the catalog matches {active.map((filter) => filter.label).join(', ')}.
        </Outcome>
      ) : (
        <>
          <StatesLead view={view} />
          <CoverWall items={view.items} />
        </>
      );
  }

  return (
    <>
      <RecordsToolbar
        filters={filterMenus(view)}
        {...(view.view === 'covers' ? { sort: sortMenu(view) } : {})}
        view={{
          label: 'Show books as',
          value: view.view,
          options: [
            { value: 'covers', label: 'Covers', href: viewHref('covers') },
            { value: 'states', label: 'States', href: viewHref('states') },
          ],
        }}
        activeCount={facets}
        showLabel={`Show ${titlesPhrase(view.totalMatched)}`}
        {...(facets > 0
          ? {
              clearAllHref: buildBooksBrowseHref({ ...params, state: 'all', author: 'all' }),
            }
          : {})}
      />

      {active.length > 0 ? (
        <div className="ds-records-active">
          <ul className="ds-records-active__chips" aria-label="Active filters">
            {active.map((filter) => (
              <li key={filter.key}>
                <Chip removable href={filter.href} label={filter.label}>
                  {filter.label}
                </Chip>
              </li>
            ))}
          </ul>
          {/* The empty state carries its own Clear filters; one control per job. */}
          {active.length > 1 && !empty ? (
            <a className={buttonClassName('quiet')} href={clearHref}>
              Clear all
            </a>
          ) : null}
        </div>
      ) : null}

      {body}

      {/* With a band on the page the note rides its foot; an outcome keeps it here. */}
      {empty ? <BooksNote /> : null}
    </>
  );
}
