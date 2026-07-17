/**
 * Public legal landscape browse surface at `/legal`.
 */
import { EmptyState, FilterBar } from '@black-book/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { LegalBrowseList, LegalDisclaimer, LEGAL_BROWSE_LEDE } from '../../components/legal';
import { buildLegalBrowseViewModel, type RawLegalBrowseParams } from './legal-view-model';

export const metadata = {
  title: 'Legal landscape',
  description: 'Plain-language access to landmark civil-rights statutes, regulations, and court decisions.',
};

type LegalPageProps = {
  readonly searchParams: Promise<RawLegalBrowseParams>;
};

export default async function LegalBrowsePage({ searchParams }: LegalPageProps) {
  const params = await searchParams;
  const view = buildLegalBrowseViewModel(params);

  return (
    <main className="bb-container bb-page" id="main">
      <header className="bb-entity-mast">
        <p className="bb-page__eyebrow">Reference</p>
        <h1 className="bb-page__title">Legal landscape</h1>
        <p className="bb-page__lede">{LEGAL_BROWSE_LEDE}</p>
      </header>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <LegalDisclaimer />
        <SeedDataNotice compact />

        <FilterBar
          method="get"
          action="/legal"
          legend="Filter legal entries"
          fields={[
            {
              id: 'q',
              name: 'q',
              label: 'Search',
              type: 'search',
              placeholder: 'Title, citation, topic…',
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
              id: 'topic',
              name: 'topic',
              label: 'Topic',
              type: 'select',
              defaultValue: view.topic,
              options: view.topicOptions,
            },
          ]}
        />

        <p
          className="bb-sans"
          id="legal-results-heading"
          style={{
            margin: 0,
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {view.totalMatched} legal entr{view.totalMatched === 1 ? 'y' : 'ies'}
        </p>

        {view.items.length === 0 ? (
          <EmptyState
            title="No legal entries matched"
            action={
              <a className="bb-cta bb-cta--ink" href="/legal">
                Clear filters
              </a>
            }
          >
            Try a broader keyword or reset the kind and topic filters.
          </EmptyState>
        ) : (
          <LegalBrowseList items={view.items} labelledBy="legal-results-heading" />
        )}
      </div>
    </main>
  );
}
