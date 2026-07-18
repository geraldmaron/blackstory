/**
 * Public search page: wired to the real `@black-book/domain` search pipeline
 * (`runPublicSearch`) over the snapshot search index, replacing the earlier hand-rolled
 * `filterPublicEntities` seed-filter stand-in.
 *
 * This Server Component stays intentionally thin `buildSearchViewModel` in the co-located
 * `./search-view-model.ts` (plain, synchronously testable, no Next.js runtime dependency) does all
 * query-parsing, filter-building, and result/facet shaping. It lives in a separate module rather
 * than this file because Next's generated typed-route check
 * (`.next/types/app/search/page.ts`) rejects any named export from `page.tsx` other than the
 * framework's own allowlisted route conventions see `./search-view-model.ts`'s module doc.
 */

import { EmptyState, FilterBar, ResultList } from '@black-book/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { getPublicSearchIndex } from '../../lib/public-data/source';
import { buildSearchPageHref, buildSearchViewModel, type RawSearchParams } from './search-view-model';

export const metadata = {
  title: 'Search',
  description: 'Search sample Black Book records by keyword, kind, status, and era.',
};

type SearchPageProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const index = await getPublicSearchIndex();
  const view = buildSearchViewModel(params, index.data);

  return (
    <main className="bb-container bb-page" id="main">
      <header className="bb-entity-mast">
        <p className="bb-page__eyebrow">Index</p>
        <h1 className="bb-page__title">Search</h1>
        <p className="bb-page__lede">
          Search runs against the current{' '}
          {index.source === 'live' ? 'live public release' : 'sample/snapshot catalog'} through the
          real Black Book search pipeline — matches, facet counts, and match explanations below
          reflect that pipeline, not a hardcoded seed filter.
        </p>
      </header>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        {index.source !== 'live' ? <SeedDataNotice compact /> : null}

        <FilterBar
          method="get"
          action="/search"
          legend="Filter sample records"
          fields={[
            {
              id: 'q',
              name: 'q',
              label: 'Search',
              type: 'search',
              placeholder: 'School, place, neighborhood…',
              defaultValue: view.q,
            },
            {
              id: 'kind',
              name: 'kind',
              label: 'Kind',
              type: 'select',
              defaultValue: view.kind,
              options: view.kindOptions,
            },
            {
              id: 'status',
              name: 'status',
              label: 'Status',
              type: 'select',
              defaultValue: view.status,
              options: view.statusOptions,
            },
            {
              id: 'era',
              name: 'era',
              label: 'Era',
              type: 'select',
              defaultValue: view.era,
              options: view.eraOptions,
            },
          ]}
        />

        <p className="bb-sans bb-count-label" id="search-results-heading">
          {view.totalMatched} sample result{view.totalMatched === 1 ? '' : 's'}
        </p>

        {view.results.length === 0 ? (
          <EmptyState
            title="No sample records matched"
            action={
              <a className="bb-cta bb-cta--ink" href="/search">
                Clear filters
              </a>
            }
          >
            Try a broader keyword or set Kind / Status / Era back to “All”.
          </EmptyState>
        ) : (
          <>
            <ResultList
              labelledBy="search-results-heading"
              items={view.results.map((result) => ({
                id: result.id,
                href: `/entity/${result.id}`,
                title: result.displayName,
                summary: result.summary ?? '',
                meta: (
                  <>
                    <span className="bb-mono">{result.kind}</span>
                    {result.status ? <span className="bb-mono">{result.status}</span> : null}
                    <span className="bb-sans">Matched: {result.matchedText}</span>
                    <span className="bb-sans">{result.explanation}</span>
                  </>
                ),
              }))}
            />

            {view.previousOffset !== undefined || view.nextOffset !== undefined ? (
              <nav className="bb-row" aria-label="Search results pages">
                {view.previousOffset !== undefined ? (
                  <a
                    className="bb-button bb-button--secondary"
                    href={buildSearchPageHref(view, view.previousOffset)}
                  >
                    Previous page
                  </a>
                ) : null}
                {view.nextOffset !== undefined ? (
                  <a
                    className="bb-button bb-button--secondary"
                    href={buildSearchPageHref(view, view.nextOffset)}
                  >
                    Next page
                  </a>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
