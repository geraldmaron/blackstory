/**
 * `/books` catalogue body: search, state facet chips in the room kit's own chip vocabulary
 * (the same `ds-room-chip` markup `/records` renders from the Lens, per
 * docs/ui/design-direction-v9-surfaces.md §4.2), and rip rows through `HairlineIndex`.
 *
 * Cover art rides in the index row's glyph slot, which `HairlineIndex` already wraps
 * `aria-hidden`, so the row's accessible name is carried by the title text next to it, never by
 * an image alt string.
 */
import React from 'react';
import Link from 'next/link';

void React;
import type { BannedBooksListingSnapshot } from '@repo/domain';
import { bannedBookReportedStates } from '@repo/domain';
import { EmptyList, HairlineIndex, type IndexFilter } from '../../components/room';
import type { BannedBookSuggestCorpusItem } from '../../lib/banned-books/suggest-books.js';
import { AutoSubmitSelect } from '../../components/forms/AutoSubmitSelect.js';
import { buildBooksBrowseHref, stateLabel, type BooksBrowseViewModel } from './books-view-model';
import { BooksCoverArt } from './BooksCoverArt';
import { BooksSearchTypeahead } from './BooksSearchTypeahead';
import { BOOKS_CATALOG } from './books-copy';
import '../typeahead.css';

export type BooksBrowseSectionsProps = {
  readonly view: BooksBrowseViewModel;
  readonly suggestCorpus: readonly BannedBookSuggestCorpusItem[];
  readonly snapshot: BannedBooksListingSnapshot;
};

/** State facet chips, counted across the full catalog rather than the current page. */
function buildStateFilters(
  snapshot: BannedBooksListingSnapshot,
  view: BooksBrowseViewModel,
): readonly IndexFilter[] {
  const counts = new Map<string, number>();
  for (const book of snapshot.books) {
    for (const code of bannedBookReportedStates(book)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  const hrefFor = (state: string) =>
    buildBooksBrowseHref({ q: view.q, state, author: view.author, sort: view.sort, dir: view.dir });

  const all: IndexFilter = {
    id: 'all',
    label: 'All states',
    count: snapshot.books.length,
    href: hrefFor('all'),
  };

  const states = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([code, count]): IndexFilter => ({
      id: code,
      label: stateLabel(code),
      count,
      href: hrefFor(code),
    }));

  return [all, ...states];
}

/** What was searched for, in words, so the empty and unavailable states can each say why. */
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

export function BooksBrowseSections({ view, suggestCorpus, snapshot }: BooksBrowseSectionsProps) {
  const countLabel = `${view.totalMatched} title${view.totalMatched === 1 ? '' : 's'}`;
  const activeWords = activeFacetWords(view);

  return (
    <div className="ds-room-idx" id="browse">
      <form action="/books" method="get" role="search" className="ds-room-idx__bar">
        <BooksSearchTypeahead defaultValue={view.q} corpus={suggestCorpus} />
        <AutoSubmitSelect
          id="author"
          name="author"
          label="Author"
          defaultValue={view.author}
          options={view.authorOptions}
        />
        <input type="hidden" name="state" value={view.state} />
        <input type="hidden" name="sort" value={view.sort} />
        <input type="hidden" name="dir" value={view.dir} />
        <Link className="ds-cta-link" href="/books">
          Clear
        </Link>
      </form>

      <HairlineIndex
        className="ds-books-idx"
        filters={buildStateFilters(snapshot, view)}
        activeFilterId={view.state === 'all' ? 'all' : view.state}
        countLabel={
          view.pagination.totalPages > 1
            ? `${countLabel} · page ${view.pagination.page} of ${view.pagination.totalPages}`
            : countLabel
        }
        rows={view.items.map((item) => ({
          href: `/books/${item.slug}`,
          name: item.title,
          place: item.authorNames,
          era: item.publishedDate,
          glyph: (
            <BooksCoverArt
              title={item.title}
              size="S"
              {...(item.coverIsbn ? { isbn: item.coverIsbn } : {})}
            />
          ),
          grade:
            item.states.length > 0
              ? item.states.map((state) => state.code).join(' ')
              : 'None on file',
        }))}
        empty={
          activeWords.length > 0 ? (
            <EmptyList title={BOOKS_CATALOG.emptyTitle}>
              Nothing in the catalog matches {activeWords.join(', ')}.{' '}
              <Link href="/books">Clear every facet</Link> to see all {snapshot.books.length}{' '}
              titles, or <Link href="/submit">tell us about a title we are missing</Link>.
            </EmptyList>
          ) : (
            <EmptyList title={BOOKS_CATALOG.emptyTitle}>
              No titles are on file yet. <Link href="/submit">Tell us about one</Link>.
            </EmptyList>
          )
        }
      />

      {view.pagination.totalPages > 1 ? (
        <nav className="ds-room-idx__bar" aria-label="Books catalog pages">
          {view.pagination.previousHref ? (
            <Link
              className="ds-cta ds-cta--quiet ds-cta--sm"
              href={view.pagination.previousHref}
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
              href={view.pagination.nextHref}
              rel="next"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
