/**
 * The `/books` index body: the register's toolbar (State, Author, Sort, and a Covers | States
 * switch), the active narrowing as removable chips, then either ruled bands that change ground
 * (each title a row, its challenge count a copper numeral, a cover only where real art exists) or the states by challenge
 * count (a sand block: the tile map in copper steps beside a paper sheet of ranked states).
 *
 * Server-rendered and JavaScript-free apart from the cover's image fallback: menus are the
 * register's native popovers of GET links, and every cover and state is an anchor.
 */
import React from 'react';
import Link from 'next/link';
import { Chip, DisplayNumeral, buttonClassName } from '@repo/ui';
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
import { BOOKS_COVER_CREDIT, BOOKS_INDEX_NOTE } from './books-copy';

void React;

export type BooksBrowseSectionsProps = {
  readonly view: BooksBrowseViewModel;
  /** The page's header, first in the stage's main column. */
  readonly head?: React.ReactNode;
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

/** The closing note, under the sheet on the night ground. */
function BooksNote() {
  return (
    <p className="ds-books-note">
      {BOOKS_INDEX_NOTE} {BOOKS_COVER_CREDIT}{' '}
      <Link href="/methodology">How this list is built</Link>
    </p>
  );
}

/**
 * The busiest state as a display numeral, then the next four in mono, under the tile map on the
 * rail. Every entry opens the states view; the numbers are the same `stateCounts` it ranks.
 */
function StatesLead({ view }: { readonly view: BooksBrowseViewModel }) {
  const [top, ...rest] = view.stateCounts;
  if (!top) return null;
  const href = buildBooksBrowseHref({ ...currentParams(view), view: 'states' });
  return (
    <div className="ds-books-lead">
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
  );
}

/** A band holds about two screens of rows at 1440, then a rule and the next range. */
const BAND_ROWS = 18;

export type BookGroup = { readonly label: string; readonly items: readonly BooksBrowseItem[] };

/** The label an ordered title falls under, read off the same field the order sorts by. */
function groupLabel(item: BooksBrowseItem, sort: BooksBrowseViewModel['sort']): string {
  const initial = (text: string) => {
    const first = text.trim().charAt(0).toLocaleUpperCase('en-US');
    return /[A-Z]/.test(first) ? first : '#';
  };
  switch (sort) {
    case 'author':
      return initial(item.authorNames);
    case 'year': {
      const year = Number(/^\d{4}/.exec(item.publishedDate)?.[0]);
      return year ? `${Math.floor(year / 10) * 10}s` : 'Undated';
    }
    case 'states':
      return item.states.length === 0
        ? 'No state on file'
        : `${item.states.length} ${item.states.length === 1 ? 'state' : 'states'}`;
    case 'citations':
      return `${item.citationCount} ${item.citationCount === 1 ? 'source' : 'sources'}`;
    case 'title':
    default:
      return initial(item.title);
  }
}

/**
 * Consecutive titles under one label, then the groups packed into bands of about `BAND_ROWS`
 * rows. A group is never split, so a long one is a band of its own.
 */
export function bandBooks(
  items: readonly BooksBrowseItem[],
  sort: BooksBrowseViewModel['sort'],
): BookGroup[][] {
  const groups: { label: string; items: BooksBrowseItem[] }[] = [];
  for (const item of items) {
    const label = groupLabel(item, sort);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  const bands: BookGroup[][] = [];
  let rows = 0;
  for (const group of groups) {
    if (bands.length === 0 || rows + group.items.length > BAND_ROWS) {
      bands.push([]);
      rows = 0;
    }
    bands.at(-1)!.push(group);
    rows += group.items.length;
  }
  return bands;
}

function bandName(band: readonly BookGroup[]): string {
  const first = band[0]!.label;
  const last = band.at(-1)!.label;
  return first === last ? first : `${first} to ${last}`;
}

function BookRow({ item }: { readonly item: BooksBrowseItem }) {
  const count = item.states.length;
  return (
    <li>
      <Link className="ds-books-row" href={`/books/${item.slug}`}>
        <span className="ds-books-row__text">
          <span className="ds-books-row__title">{item.title}</span>
          {item.authorNames ? (
            <span className="ds-books-row__author">{item.authorNames}</span>
          ) : null}
        </span>
        {count > 0 ? (
          <span className="ds-books-row__count">
            <span className="ds-visually-hidden">Challenged in </span>
            <span className="ds-books-row__n">{count}</span>
            <span className="ds-books-row__word">{count === 1 ? 'state' : 'states'}</span>
          </span>
        ) : (
          <span className="ds-books-row__count ds-books-row__count--none">State not recorded</span>
        )}
        {/* Real art or nothing: a title with no cover is a row, never a stand-in card. */}
        <span className="ds-books-row__cover">
          <BooksCoverArt
            bare
            className="ds-books-row__art"
            title={item.title}
            size="M"
            {...(item.coverIsbn ? { isbn: item.coverIsbn } : {})}
          />
        </span>
      </Link>
    </li>
  );
}

/**
 * The titles on the one sheet, grouped by the field the order sorts on. Each band names its range
 * and counts its titles in a copper numeral; the titles are ruled rows, a restrained cover at the
 * row's end where real art exists.
 */
function BookBands({ view }: { readonly view: BooksBrowseViewModel }) {
  const bands = bandBooks(view.items, view.sort);
  return (
    <div className="ds-parked__sheet ds-books-sheet" data-ground="paper">
      {bands.map((band) => {
        const total = band.reduce((sum, group) => sum + group.items.length, 0);
        return (
          <section key={bandName(band)} className="ds-books-band" aria-label={bandName(band)}>
            <div className="ds-books-mark">
              <h2 className="ds-books-mark__name">{bandName(band)}</h2>
              <p className="ds-books-mark__meta">{titlesPhrase(total)}</p>
            </div>
            <div className="ds-books-groups">
              {band.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  {band.length > 1 ? (
                    <h3 className="ds-books-group__label">{group.label}</h3>
                  ) : null}
                  <ul className="ds-books-list">
                    {group.items.map((item) => (
                      <BookRow key={item.id} item={item} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Steps for the tile grid, dim ember to paper; none is an outline (books.css). */
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
 * The page's instrument: the states by how many titles carry a cited challenge there, as a tile
 * grid. It is the picture, a state code and a shade, decorative, since the ranked list prints
 * every number. In the titles view the busiest states stand under it and open the states view.
 */
function PlaceRail({ view }: { readonly view: BooksBrowseViewModel }) {
  const counts = new Map(view.stateCounts.map((entry) => [entry.code, entry.count]));
  const max = Math.max(...view.stateCounts.map((entry) => entry.count));
  return (
    <div className="ds-books-rail">
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
      {view.view === 'covers' ? <StatesLead view={view} /> : null}
    </div>
  );
}

/** The ranked list is the control: each row a link to the titles filtered to that state. */
function StateRanks({ view }: { readonly view: BooksBrowseViewModel }) {
  const params = currentParams(view);
  const max = Math.max(...view.stateCounts.map((entry) => entry.count));
  return (
    <div className="ds-parked__sheet ds-books-sheet" data-ground="paper">
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
    </div>
  );
}

export function BooksBrowseSections({ view, head }: BooksBrowseSectionsProps) {
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
        <StateRanks view={view} />
      );
  } else {
    body =
      view.items.length === 0 ? (
        <Outcome title="No titles match" action={{ href: clearHref, label: 'Clear filters' }}>
          Nothing in the catalog matches {active.map((filter) => filter.label).join(', ')}.
        </Outcome>
      ) : (
        <BookBands view={view} />
      );
  }

  // Without a state to shade (nothing matched, or no challenge names one) the stage is one column.
  const railed = view.stateCounts.length > 0;

  return (
    <div
      className={railed ? 'ds-parked ds-parked--railed ds-books-stage' : 'ds-parked ds-books-stage'}
      data-ground="ink"
      data-ground-fixed=""
    >
      <div className="ds-parked__main">
        {head}
        <RecordsToolbar
          filters={filterMenus(view)}
          {...(view.view === 'covers' ? { sort: sortMenu(view) } : {})}
          view={{
            label: 'Show books as',
            value: view.view,
            options: [
              { value: 'covers', label: 'Titles', href: viewHref('covers') },
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

        {railed ? <PlaceRail view={view} /> : null}

        {body}

        <BooksNote />
      </div>
    </div>
  );
}
