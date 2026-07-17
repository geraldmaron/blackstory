/**
 * Public fact library over published facts (BB-086 AC5). Search runs through the real BB-049
 * `runPublicSearch` pipeline over the seed fact search index — not a hand-rolled filter.
 */
import { EmptyState, FilterBar, ResultList } from '@black-book/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { getSeedFact, getSeedFactSearchIndex, listSeedFacts } from '../../data/facts-seed';
import {
  buildFactLibraryHref,
  buildFactLibraryViewModel,
  factPageHref,
  type RawFactSearchParams,
} from './facts-view-model';

export const metadata = {
  title: 'Fact library',
  description: 'Search published canonical fact records with citations and revision history.',
};

type FactsPageProps = {
  readonly searchParams: Promise<RawFactSearchParams>;
};

export default async function FactsLibraryPage({ searchParams }: FactsPageProps) {
  const params = await searchParams;
  const { docs } = getSeedFactSearchIndex();
  const confidenceById = Object.fromEntries(listSeedFacts().map((fact) => [fact.id, fact.confidence]));
  const view = buildFactLibraryViewModel(params, docs, confidenceById);

  return (
    <main className="bb-container bb-page" id="main">
      <header className="bb-entity-mast">
        <p className="bb-page__eyebrow">Reference</p>
        <h1 className="bb-page__title">Fact library</h1>
        <p className="bb-page__lede">
          Canonical, versioned, citable facts — each with structured citations, independent workflow
          status and evidence grade, and a stable permalink every surface links to.
        </p>
      </header>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <SeedDataNotice compact />

        <FilterBar
          method="get"
          action="/facts"
          legend="Search published facts"
          fields={[
            {
              id: 'q',
              name: 'q',
              label: 'Search',
              type: 'search',
              placeholder: 'Statement, subject, claim type…',
              defaultValue: view.q,
            },
            {
              id: 'claimType',
              name: 'claimType',
              label: 'Claim type',
              type: 'select',
              defaultValue: view.claimType,
              options: view.claimTypeOptions,
            },
            {
              id: 'confidence',
              name: 'confidence',
              label: 'Evidence grade',
              type: 'select',
              defaultValue: view.confidence,
              options: view.confidenceOptions,
            },
          ]}
        />

        <p
          className="bb-sans"
          id="fact-results-heading"
          style={{
            margin: 0,
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {view.totalMatched} published fact{view.totalMatched === 1 ? '' : 's'}
        </p>

        {view.results.length === 0 ? (
          <EmptyState
            title="No published facts matched"
            action={
              <a className="bb-cta bb-cta--ink" href="/facts">
                Clear filters
              </a>
            }
          >
            Try a broader keyword or reset the claim type and evidence grade filters.
          </EmptyState>
        ) : (
          <>
            <ResultList
              labelledBy="fact-results-heading"
              items={view.results.map((result) => {
                const fact = getSeedFact(result.id);
                const href = fact ? factPageHref(fact.id, fact.shortStatement) : `/facts/${result.id}`;
                return {
                  id: result.id,
                  href,
                  title: result.displayName,
                  summary: result.summary ?? '',
                  meta: (
                    <>
                      <span className="bb-mono">{result.id}</span>
                      {result.status ? <span className="bb-mono">{result.status}</span> : null}
                      <span className="bb-sans">Matched: {result.matchedText}</span>
                      <span className="bb-sans">{result.explanation}</span>
                    </>
                  ),
                };
              })}
            />

            {view.previousOffset !== undefined || view.nextOffset !== undefined ? (
              <nav className="bb-row" aria-label="Fact library pages">
                {view.previousOffset !== undefined ? (
                  <a className="bb-button bb-button--secondary" href={buildFactLibraryHref(view, view.previousOffset)}>
                    Previous page
                  </a>
                ) : null}
                {view.nextOffset !== undefined ? (
                  <a className="bb-button bb-button--secondary" href={buildFactLibraryHref(view, view.nextOffset)}>
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
