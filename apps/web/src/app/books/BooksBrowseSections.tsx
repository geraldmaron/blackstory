/**
 * The `/books` index body: the register's toolbar (State, Author, Sort, and a Covers | States
 * switch), the active narrowing as removable chips, then either the cover wall or the states by
 * challenge count.
 *
 * Server-rendered and JavaScript-free apart from the cover's image fallback: menus are the
 * register's native popovers of GET links, and every cover and state is an anchor.
 */
import React from 'react';
import Link from 'next/link';
import { Chip, buttonClassName } from '@repo/ui';
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

function CoverWall({ items }: { readonly items: readonly BooksBrowseItem[] }) {
  return (
    <ul className="ds-books-wall" aria-label="Challenged titles">
      {items.map((item) => (
        <li key={item.id}>
          <Link className="ds-books-wall__link" href={`/books/${item.slug}`}>
            <BooksCoverArt
              className="ds-books-wall__cover"
              title={item.title}
              author={item.authorNames}
              {...(item.coverIsbn ? { isbn: item.coverIsbn } : {})}
            />
            <span className="ds-books-wall__title">{item.title}</span>
            <span className="ds-books-wall__states">{statesPhrase(item.states.length)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Shade steps for the tile grid; the two darkest carry paper-colored codes (books.css). */
const TILE_STEPS = 4;

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
    <div className="ds-books-states">
      <div className="ds-books-tiles" aria-hidden="true">
        {Object.entries(STATE_TILES).map(([code, [row, column]]) => {
          const count = counts.get(code) ?? 0;
          // Square root, so the states behind one outlier still read apart from each other.
          const step = count === 0 ? 0 : Math.ceil(Math.sqrt(count / max) * TILE_STEPS);
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
        <CoverWall items={view.items} />
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

      <p className="ds-books-note">
        {BOOKS_INDEX_NOTE} <Link href="/methodology">How this list is built</Link>
      </p>
    </>
  );
}
