/**
 * Public search page: wired to the real `@repo/domain` search pipeline
 * (`runPublicSearch`) over the snapshot search index.
 *
 * Surface language (v5 "atlas instrument"): the query IS the headline — a
 * display-scale input over a heavy rule, pill facet selects beneath, and a
 * numbered ledger index for results. No filter card, no boxed rows.
 *
 * This Server Component stays intentionally thin — `buildSearchViewModel` in
 * the co-located `./search-view-model.ts` (plain, synchronously testable, no
 * Next.js runtime dependency) does all query-parsing, filter-building, and
 * result/facet shaping.
 */

import Link from 'next/link';
import { EmptyState, ResultList } from '@repo/ui';
import { KindBadge, StatusMark } from '../../components/map-experience';
import { getPublicSearchIndex } from '../../lib/public-data/source';
import { buildSearchPageHref, buildSearchViewModel, type RawSearchParams } from './search-view-model';

export const metadata = {
  title: 'Search',
  description: 'Search BlackStory records by keyword, kind, status, and era.',
};

type SearchPageProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

type FacetSelectProps = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
};

function FacetSelect({ id, name, label, defaultValue, options }: FacetSelectProps) {
  return (
    <label className="ds-pill-select" htmlFor={id}>
      <span className="ds-pill-select__label">{label}</span>
      <select
        className="ds-pill-select__control"
        id={id}
        name={name}
        defaultValue={defaultValue}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const index = await getPublicSearchIndex();
  const view = buildSearchViewModel(params, index.data);

  return (
    <main className="ds-container ds-page" id="main">
      <header>
        <p className="ds-page__eyebrow">Index</p>
        <h1 className="ds-page__title">
          Search the <em>archive</em>.
        </h1>
      </header>

      {/* GET form — every query is a shareable URL; facet selects apply on
          the same submit as the keyword. */}
      <form className="ds-search-mast" method="get" action="/search" role="search">
        <div className="ds-search-mast__field">
          <input
            className="ds-search-mast__input"
            type="search"
            id="q"
            name="q"
            placeholder="A school, a church, a city…"
            defaultValue={view.q}
            aria-label="Search the archive"
          />
          <button className="ds-cta ds-cta--copper" type="submit">
            Search
          </button>
        </div>
        <div className="ds-search-mast__refine">
          <FacetSelect
            id="kind"
            name="kind"
            label="Kind"
            defaultValue={view.kind}
            options={view.kindOptions}
          />
          <FacetSelect
            id="status"
            name="status"
            label="Status"
            defaultValue={view.status}
            options={view.statusOptions}
          />
          <FacetSelect
            id="era"
            name="era"
            label="Era"
            defaultValue={view.era}
            options={view.eraOptions}
          />
          <Link className="ds-cta-link" href="/search">
            Clear
          </Link>
        </div>
      </form>

      <div className="ds-stack" style={{ marginTop: 'var(--ds-space-8)' }}>
        <p className="ds-sans ds-count-label" id="search-results-heading">
          {view.totalMatched} result
          {view.totalMatched === 1 ? '' : 's'}
        </p>

        {view.results.length === 0 ? (
          <EmptyState
            title="Nothing matched — yet"
            action={
              <Link className="ds-cta ds-cta--ink" href="/search">
                Clear filters
              </Link>
            }
          >
            Try a broader keyword, or set Kind / Status / Era back to “All”. The archive grows
            with every release.
          </EmptyState>
        ) : (
          <>
            <ResultList
              className="ds-index"
              labelledBy="search-results-heading"
              LinkComponent={Link}
              items={view.results.map((result) => ({
                id: result.id,
                href: `/entity/${result.id}`,
                title: result.displayName,
                summary: result.summary ?? '',
                meta: (
                  <>
                    <KindBadge kind={result.kind} density="compact" />
                    {result.status ? <StatusMark status={result.status} labeled /> : null}
                    <span>Matched: {result.matchedText}</span>
                  </>
                ),
              }))}
            />

            {view.previousOffset !== undefined || view.nextOffset !== undefined ? (
              <nav className="ds-row" aria-label="Search results pages">
                {view.previousOffset !== undefined ? (
                  <Link
                    className="ds-cta ds-cta--quiet"
                    href={buildSearchPageHref(view, view.previousOffset)}
                    scroll={false}
                  >
                    Previous page
                  </Link>
                ) : null}
                {view.nextOffset !== undefined ? (
                  <Link
                    className="ds-cta ds-cta--quiet"
                    href={buildSearchPageHref(view, view.nextOffset)}
                    scroll={false}
                  >
                    Next page
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
