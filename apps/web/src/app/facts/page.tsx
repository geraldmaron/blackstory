/**
 * Public fact library over published facts. Search runs through the real
 * `runPublicSearch` pipeline over the seed fact search index not a hand-rolled filter.
 */
import Link from 'next/link';
import { EmptyState, FilterBar, ResultList } from '@repo/ui';
import { getSeedFact, getSeedFactSearchIndex, listSeedFacts } from '../../data/facts-seed';
import {
  buildFactLibraryHref,
  buildFactLibraryViewModel,
  factPageHref,
  type RawFactSearchParams,
} from './facts-view-model';

export const metadata = {
  title: 'Quick facts',
  description:
    'Did you know — short, citable pins from the BlackStory archive with citations and revision history.',
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
    <main className="ds-container ds-page" id="main">
      <header className="ds-entity-mast">
        <p className="ds-page__eyebrow">Did you know</p>
        <h1 className="ds-page__title">Quick facts</h1>
        <p className="ds-page__lede">
          Short, citable pins — not essays. Each fact carries structured citations, an evidence
          grade, and a stable permalink every surface can link to.
        </p>
      </header>

      <div className="ds-stack" style={{ marginTop: 'var(--ds-space-6)' }}>
        <FilterBar
          method="get"
          action="/facts"
          legend="Search quick facts"
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

        <p className="ds-sans ds-count-label" id="fact-results-heading">
          {view.totalMatched} published fact{view.totalMatched === 1 ? '' : 's'}
        </p>

        {view.results.length === 0 ? (
          <EmptyState
            title="No published facts matched"
            action={
              <Link className="ds-cta ds-cta--ink" href="/facts">
                Clear filters
              </Link>
            }
          >
            Try a broader keyword or reset the claim type and evidence grade filters.
          </EmptyState>
        ) : (
          <>
            <ResultList
              labelledBy="fact-results-heading"
              LinkComponent={Link}
              items={view.results.map((result) => {
                const fact = getSeedFact(result.id);
                const href = fact ? factPageHref(fact.id, fact.slug) : `/facts/${result.id}`;
                return {
                  id: result.id,
                  href,
                  title: result.displayName,
                  summary: result.summary ?? '',
                  meta: (
                    <>
                      <span className="ds-mono">{result.id}</span>
                      {result.status ? <span className="ds-mono">{result.status}</span> : null}
                      <span className="ds-sans">Matched: {result.matchedText}</span>
                      <span className="ds-sans">{result.explanation}</span>
                    </>
                  ),
                };
              })}
            />

            {view.previousOffset !== undefined || view.nextOffset !== undefined ? (
              <nav className="ds-row" aria-label="Fact library pages">
                {view.previousOffset !== undefined ? (
                  <Link
                    className="ds-button ds-button--secondary"
                    href={buildFactLibraryHref(view, view.previousOffset)}
                    scroll={false}
                  >
                    Previous page
                  </Link>
                ) : null}
                {view.nextOffset !== undefined ? (
                  <Link
                    className="ds-button ds-button--secondary"
                    href={buildFactLibraryHref(view, view.nextOffset)}
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
