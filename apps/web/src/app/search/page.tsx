/**
 * Browse/search — modular news index over seed fixtures (BB-049 stand-in).
 */

import { Confidence, EmptyState, FilterBar, ResultList } from '@black-book/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { filterPublicEntities } from '../../data/public-seed';

export const metadata = {
  title: 'Search',
  description: 'Browse sample Black Book records by keyword, kind, era, and topic.',
};

type SearchPageProps = {
  readonly searchParams: Promise<{
    q?: string;
    kind?: string;
    era?: string;
    topic?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = params.q ?? '';
  const kind = params.kind ?? 'all';
  const era = params.era ?? 'all';
  const topic = params.topic ?? 'all';
  const results = filterPublicEntities({ q, kind, era, topic });

  return (
    <main className="bb-container bb-page" id="main">
      <header className="bb-entity-mast">
        <p className="bb-page__eyebrow">Index</p>
        <h1 className="bb-page__title">Search</h1>
        <p className="bb-page__lede">
          Filter sample records now. Live search lands in BB-049.
        </p>
      </header>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <SeedDataNotice compact />

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
              defaultValue: q,
            },
            {
              id: 'kind',
              name: 'kind',
              label: 'Kind',
              type: 'select',
              defaultValue: kind,
              options: [
                { value: 'all', label: 'All kinds' },
                { value: 'place', label: 'Place' },
                { value: 'school', label: 'School' },
                { value: 'event', label: 'Event' },
                { value: 'institution', label: 'Institution' },
              ],
            },
            {
              id: 'era',
              name: 'era',
              label: 'Era',
              type: 'select',
              defaultValue: era,
              options: [
                { value: 'all', label: 'All eras' },
                { value: 'reconstruction', label: 'Reconstruction' },
                { value: 'civil-rights', label: 'Civil rights' },
              ],
            },
            {
              id: 'topic',
              name: 'topic',
              label: 'Topic',
              type: 'select',
              defaultValue: topic,
              options: [
                { value: 'all', label: 'All topics' },
                { value: 'education', label: 'Education' },
                { value: 'community', label: 'Community' },
                { value: 'freedmen', label: 'Freedmen' },
                { value: 'schools', label: 'Schools' },
              ],
            },
          ]}
        />

        <p
          className="bb-sans"
          id="search-results-heading"
          style={{
            margin: 0,
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {results.length} sample result{results.length === 1 ? '' : 's'}
        </p>

        {results.length === 0 ? (
          <EmptyState
            title="No sample records matched"
            action={
              <a className="bb-cta bb-cta--ink" href="/search">
                Clear filters
              </a>
            }
          >
            Try a broader keyword or set Kind / Era / Topic back to “All”.
          </EmptyState>
        ) : (
          <ResultList
            labelledBy="search-results-heading"
            items={results.map((entity) => ({
              id: entity.id,
              href: `/entity/${entity.id}`,
              title: entity.displayName,
              summary: entity.summary,
              meta: (
                <>
                  <span className="bb-mono">{entity.kind}</span>
                  <span>{entity.jurisdictionLabel}</span>
                  <Confidence
                    level={
                      entity.researchCoverage === 'substantial'
                        ? 'high'
                        : entity.researchCoverage === 'partial'
                          ? 'medium'
                          : 'low'
                    }
                    label={`Coverage: ${entity.researchCoverage}`}
                  />
                </>
              ),
            }))}
          />
        )}
      </div>
    </main>
  );
}
