/**
 * `/books` catalog body: how to read the list, GET search and facets, then cover-led rows
 * with author, summary, cited states and source count. Related rooms leave as handoffs.
 *
 * Rows reuse `ds-room-idx-*` slots plus books-specific copy/facts styled in `reading-room.css`
 * (`ds-books-idx`), with subgrid alignment like `/law`. Cover art is decorative; the row's
 * accessible name is the title.
 */
import React from 'react';
import Link from 'next/link';
import type { BannedBooksListingSnapshot } from '@repo/domain';
import { bannedBookReportedStates } from '@repo/domain';
import {
  EmptyList,
  Prose,
  RoomFactList,
  RoomHandoff,
  RoomJump,
  RoomSection,
  roomSectionTone,
} from '../../components/room';
import type { BannedBookSuggestCorpusItem } from '../../lib/banned-books/suggest-books.js';
import { AutoSubmitSelect } from '../../components/forms/AutoSubmitSelect.js';
import {
  buildBooksBrowseHref,
  stateLabel,
  type BooksBrowseItem,
  type BooksBrowseViewModel,
} from './books-view-model';
import { BooksCoverArt } from './BooksCoverArt';
import { BooksSearchTypeahead } from './BooksSearchTypeahead';
import {
  BOOKS_ABOUT,
  BOOKS_CATALOG,
  BOOKS_JUMP,
  BOOKS_READ_FACTS,
  BOOKS_RELATED,
} from './books-copy';
import '../typeahead.css';
import './books-browse.css';

void React;

export type BooksBrowseSectionsProps = {
  readonly view: BooksBrowseViewModel;
  readonly suggestCorpus: readonly BannedBookSuggestCorpusItem[];
  readonly snapshot: BannedBooksListingSnapshot;
};

type StateChip = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly href: string;
};

/** State facet chips, counted across the full catalog rather than the current page. */
function buildStateChips(
  snapshot: BannedBooksListingSnapshot,
  view: BooksBrowseViewModel,
): readonly StateChip[] {
  const counts = new Map<string, number>();
  for (const book of snapshot.books) {
    for (const code of bannedBookReportedStates(book)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  const hrefFor = (state: string) =>
    `${buildBooksBrowseHref({
      q: view.q,
      state,
      author: view.author,
      sort: view.sort,
      dir: view.dir,
    })}#browse`;

  const all: StateChip = {
    id: 'all',
    label: 'All states',
    count: snapshot.books.length,
    href: hrefFor('all'),
  };

  const ranked = [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  const topCodes = new Set(ranked.slice(0, 8).map(([code]) => code));
  if (view.state !== 'all' && counts.has(view.state)) {
    topCodes.add(view.state);
  }

  const states = ranked
    .filter(([code]) => topCodes.has(code))
    .map(([code, count]): StateChip => ({
      id: code,
      label: stateLabel(code),
      count,
      href: hrefFor(code),
    }));

  return [all, ...states];
}

/** What was searched for, in words, so the empty state can say why. */
function activeFacetWords(view: BooksBrowseViewModel): readonly string[] {
  const words: string[] = [];
  if (view.q.trim()) words.push(`the search "${view.q.trim()}"`);
  if (view.state !== 'all') {
    const label =
      view.stateOptions.find((entry) => entry.value === view.state)?.label ?? view.state;
    words.push(label);
  }
  if (view.author !== 'all') words.push(view.author);
  return words;
}

function buildActiveChips(
  view: BooksBrowseViewModel,
): readonly { readonly key: string; readonly label: string; readonly href: string }[] {
  const chips: { readonly key: string; readonly label: string; readonly href: string }[] = [];
  if (view.q.trim()) {
    chips.push({
      key: 'q',
      label: `Search: ${view.q.trim()}`,
      href: `${buildBooksBrowseHref({
        q: '',
        state: view.state,
        author: view.author,
        sort: view.sort,
        dir: view.dir,
      })}#browse`,
    });
  }
  if (view.state !== 'all') {
    const label =
      view.stateOptions.find((entry) => entry.value === view.state)?.label ?? view.state;
    chips.push({
      key: 'state',
      label,
      href: `${buildBooksBrowseHref({
        q: view.q,
        state: 'all',
        author: view.author,
        sort: view.sort,
        dir: view.dir,
      })}#browse`,
    });
  }
  if (view.author !== 'all') {
    chips.push({
      key: 'author',
      label: view.author,
      href: `${buildBooksBrowseHref({
        q: view.q,
        state: view.state,
        author: 'all',
        sort: view.sort,
        dir: view.dir,
      })}#browse`,
    });
  }
  return chips;
}

function sourcesLabel(count: number): string {
  return `${count.toLocaleString('en-US')} source${count === 1 ? '' : 's'}`;
}

function BooksCatalogRow({ item }: { readonly item: BooksBrowseItem }) {
  const statesOnFile =
    item.states.length > 0 ? item.states.map((state) => state.code).join(' ') : 'None on file';
  const summary = item.summary.trim();

  return (
    <Link className="ds-room-idx__row" href={`/books/${item.slug}`}>
      <span className="ds-room-idx__glyph" aria-hidden="true">
        <BooksCoverArt
          title={item.title}
          size="M"
          {...(item.coverIsbn ? { isbn: item.coverIsbn } : {})}
        />
      </span>
      <span className="ds-books-idx__copy">
        <span className="ds-room-idx__name">{item.title}</span>
        <span className="ds-books-idx__byline">
          {item.authorNames}
          {item.publishedDate ? ` · ${item.publishedDate}` : ''}
        </span>
        {summary ? <span className="ds-books-idx__gloss">{summary}</span> : null}
      </span>
      <span className="ds-books-idx__facts">
        <span
          className="ds-room-idx__grade"
          title={item.states.map((state) => state.name).join(', ')}
        >
          {statesOnFile}
        </span>
        <span className="ds-books-idx__cites">{sourcesLabel(item.citationCount)}</span>
      </span>
    </Link>
  );
}

export function BooksBrowseSections({ view, suggestCorpus, snapshot }: BooksBrowseSectionsProps) {
  const countLabel = `${view.totalMatched.toLocaleString('en-US')} title${
    view.totalMatched === 1 ? '' : 's'
  }`;
  const activeWords = activeFacetWords(view);
  const activeChips = buildActiveChips(view);
  const stateChips = buildStateChips(snapshot, view);

  return (
    <>
      <RoomJump sections={BOOKS_JUMP} />

      <RoomSection
        id="read"
        icon="books"
        kicker={BOOKS_ABOUT.kicker}
        title={BOOKS_ABOUT.title}
        tone={roomSectionTone(0)}
      >
        <Prose>
          <p>{BOOKS_ABOUT.lede}</p>
        </Prose>
        <RoomFactList
          items={BOOKS_READ_FACTS.map((fact) => ({
            title: fact.title,
            body: fact.body,
            icon: fact.icon,
          }))}
        />
      </RoomSection>

      <RoomSection
        id="browse"
        icon="publication"
        kicker={BOOKS_CATALOG.kicker}
        title={BOOKS_CATALOG.title}
        tone={roomSectionTone(1)}
      >
        <Prose>
          <p>{BOOKS_CATALOG.lede}</p>
        </Prose>

        <div className="ds-books-browse">
          <form
            action="/books#browse"
            method="get"
            role="search"
            className="ds-books-browse__toolbar"
            aria-labelledby="browse-heading"
          >
            <BooksSearchTypeahead defaultValue={view.q} corpus={suggestCorpus} />
            <AutoSubmitSelect
              id="state"
              name="state"
              label="State"
              defaultValue={view.state}
              options={view.stateOptions}
            />
            <AutoSubmitSelect
              id="author"
              name="author"
              label="Author"
              defaultValue={view.author}
              options={view.authorOptions}
            />
            <input type="hidden" name="sort" value={view.sort} />
            <input type="hidden" name="dir" value={view.dir} />
            <Link className="ds-cta-link" href="/books#browse">
              Clear
            </Link>
          </form>

          {activeChips.length > 0 ? (
            <div className="ds-records-active" role="group" aria-label="Active filters">
              {activeChips.map((chip) => (
                <Link className="ds-records-active__chip" href={chip.href} key={chip.key}>
                  {chip.label}
                  <span className="ds-records-active__x" aria-hidden="true">
                    ✕
                  </span>
                  <span className="ds-visually-hidden">, remove this filter</span>
                </Link>
              ))}
              <Link className="ds-records-active__clear" href="/books#browse">
                Clear all
              </Link>
            </div>
          ) : null}

          <div className="ds-room-idx__bar" role="group" aria-label="Filter by state">
            {stateChips.map((chip) => (
              <Link
                key={chip.id}
                className="ds-room-chip"
                href={chip.href}
                aria-current={
                  (view.state === 'all' ? 'all' : view.state) === chip.id ? true : undefined
                }
              >
                {chip.label} <span className="ds-room-num">{chip.count}</span>
              </Link>
            ))}
          </div>

          <nav className="ds-room-idx__bar" aria-label="Sort order">
            {view.sortOptions.map((option) => (
              <Link
                key={option.key}
                className="ds-room-chip"
                href={`${option.href}#browse`}
                aria-current={option.active ? true : undefined}
              >
                {option.label}
                {option.active ? (
                  <span className="ds-room-num" aria-hidden="true">
                    {view.dir === 'asc' ? '↑' : '↓'}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <p className="ds-room-idx__count" id="books-results-heading">
            {view.pagination.totalPages > 1
              ? `${countLabel} · page ${view.pagination.page} of ${view.pagination.totalPages}`
              : countLabel}
          </p>

          {view.items.length === 0 ? (
            activeWords.length > 0 ? (
              <EmptyList title={BOOKS_CATALOG.emptyTitle}>
                Nothing in the catalog matches {activeWords.join(', ')}.{' '}
                <Link href="/books#browse">Clear every facet</Link> to see all{' '}
                {snapshot.books.length.toLocaleString('en-US')} titles, or{' '}
                <Link href="/submit">tell the archive about a title it is missing</Link>.
              </EmptyList>
            ) : (
              <EmptyList title={BOOKS_CATALOG.emptyTitle}>
                No titles are on file yet. <Link href="/submit">Tell the archive about one</Link>.
              </EmptyList>
            )
          ) : (
            <div className="ds-books-idx ds-room-idx__list" aria-labelledby="books-results-heading">
              {view.items.map((item) => (
                <BooksCatalogRow item={item} key={item.id} />
              ))}
            </div>
          )}

          {view.pagination.totalPages > 1 ? (
            <nav className="ds-room-idx__bar" aria-label="Books catalog pages">
              {view.pagination.previousHref ? (
                <Link
                  className="ds-cta ds-cta--quiet ds-cta--sm"
                  href={`${view.pagination.previousHref}#browse`}
                  rel="prev"
                >
                  Previous
                </Link>
              ) : null}
              <span className="ds-room-idx__count">
                Page {view.pagination.page} of {view.pagination.totalPages}
              </span>
              {view.pagination.nextHref ? (
                <Link
                  className="ds-cta ds-cta--quiet ds-cta--sm"
                  href={`${view.pagination.nextHref}#browse`}
                  rel="next"
                >
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </RoomSection>

      <RoomSection
        id="related"
        icon="rooms"
        kicker={BOOKS_RELATED.kicker}
        title={BOOKS_RELATED.title}
        tone={roomSectionTone(2)}
      >
        <Prose>
          <p>
            How the list is built, the statutes and rulings that sat around it, and a way to point
            at a title that is missing.
          </p>
        </Prose>
        <div className="ds-room-handoffs">
          <RoomHandoff
            href="/methodology"
            icon="methodology"
            title="How this catalog is built"
            line="Sources, method, and what a cited challenge means here."
          />
          <RoomHandoff
            href="/law"
            icon="law"
            title="Law"
            line="Statutes and rulings, in plain language."
          />
          <RoomHandoff
            href="/submit"
            icon="submit"
            title="Point at a missing title"
            line="A lead is reviewed. Nothing you send is published as you sent it."
          />
        </div>
      </RoomSection>
    </>
  );
}
