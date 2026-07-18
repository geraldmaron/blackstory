/**
 * Public search page: wired to the real `@blap/domain` search pipeline
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

import { EmptyState } from '@blap/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { getPublicSearchIndex } from '../../lib/public-data/source';
import { buildSearchPageHref, buildSearchViewModel, type RawSearchParams } from './search-view-model';

export const metadata = {
  title: 'Search',
  description: 'Search sample Blap records by keyword, kind, status, and era.',
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
    <label className="bp-pill-select" htmlFor={id}>
      <span className="bp-pill-select__label">{label}</span>
      <select
        className="bp-pill-select__control"
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
    <main className="bp-container bp-page" id="main">
      <header>
        <p className="bp-page__eyebrow">Index</p>
        <h1 className="bp-page__title">
          Search the <em>archive</em>.
        </h1>
      </header>

      {/* GET form — every query is a shareable URL; facet selects apply on
          the same submit as the keyword. */}
      <form className="bp-search-mast" method="get" action="/search" role="search">
        <div className="bp-search-mast__field">
          <input
            className="bp-search-mast__input"
            type="search"
            id="q"
            name="q"
            placeholder="A school, a church, a city…"
            defaultValue={view.q}
            aria-label="Search the archive"
          />
          <button className="bp-cta bp-cta--copper" type="submit">
            Search
          </button>
        </div>
        <div className="bp-search-mast__refine">
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
          <a className="bp-cta-link" href="/search">
            Clear
          </a>
        </div>
      </form>

      <div className="bp-stack" style={{ marginTop: 'var(--bp-space-8)' }}>
        {index.source !== 'live' ? <SeedDataNotice compact /> : null}

        <p className="bp-sans bp-count-label" id="search-results-heading">
          {view.totalMatched} {index.source === 'live' ? '' : 'sample '}result
          {view.totalMatched === 1 ? '' : 's'}
        </p>

        {view.results.length === 0 ? (
          <EmptyState
            title="Nothing matched — yet"
            action={
              <a className="bp-cta bp-cta--ink" href="/search">
                Clear filters
              </a>
            }
          >
            Try a broader keyword, or set Kind / Status / Era back to “All”. The archive grows
            with every release.
          </EmptyState>
        ) : (
          <>
            <ol className="bp-index" aria-labelledby="search-results-heading">
              {view.results.map((result) => (
                <li className="bp-index__row" key={result.id}>
                  <a className="bp-index__link" href={`/entity/${result.id}`}>
                    <h2 className="bp-index__title">{result.displayName}</h2>
                    {result.summary ? (
                      <p className="bp-index__summary">{result.summary}</p>
                    ) : null}
                    <p className="bp-index__meta">
                      <span>{result.kind}</span>
                      {result.status ? <span>{result.status}</span> : null}
                      <span>Matched: {result.matchedText}</span>
                    </p>
                  </a>
                </li>
              ))}
            </ol>

            {view.previousOffset !== undefined || view.nextOffset !== undefined ? (
              <nav className="bp-row" aria-label="Search results pages">
                {view.previousOffset !== undefined ? (
                  <a
                    className="bp-cta bp-cta--quiet"
                    href={buildSearchPageHref(view, view.previousOffset)}
                  >
                    Previous page
                  </a>
                ) : null}
                {view.nextOffset !== undefined ? (
                  <a
                    className="bp-cta bp-cta--quiet"
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
