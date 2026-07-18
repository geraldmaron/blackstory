/**
 * Public legal landscape browse surface at `/legal`.
 */
import { EmptyState, FilterBar } from '@blap/ui';
import { LegalBrowseList, LegalDisclaimer, LEGAL_BROWSE_LEDE } from '../../components/legal';
import { buildLegalBrowseViewModel, type RawLegalBrowseParams } from './legal-view-model';
import './legal.css';

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
    <main className="bp-container bp-page" id="main">
      <header className="bp-entity-mast">
        <p className="bp-page__eyebrow">Reference</p>
        <h1 className="bp-page__title">Legal landscape</h1>
        <p className="bp-page__lede">{LEGAL_BROWSE_LEDE}</p>
      </header>

      <div className="bp-stack" style={{ marginTop: 'var(--bp-space-6)' }}>
        <LegalDisclaimer />

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

        <p className="bp-sans bp-count-label" id="legal-results-heading">
          {view.totalMatched} legal entr{view.totalMatched === 1 ? 'y' : 'ies'}
        </p>

        {view.items.length === 0 ? (
          <EmptyState
            title="No legal entries matched"
            action={
              <a className="bp-cta bp-cta--ink" href="/legal">
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
