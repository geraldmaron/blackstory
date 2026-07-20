/**
 * Temporal history browse page: all-time union view plus decade stepper over
 * published graph release artifacts, composition/connection data panel, synchronized
 * accessible list peer, and shareable URL state. SSR-first from the bundled snapshot;
 * filters use native GET navigation (no-JS safe).
 */
import React from 'react';
import { FilterBar } from '@repo/ui';
import {
  DecadeStepper,
  HistoryGraphPanel,
  HistoryOverviewStrip,
  HistoryResultList,
} from '../../components/history';
import {
  HISTORY_DECADE_FRAMING,
  HISTORY_DIGNITY_FRAMING,
} from '../../lib/history';
import type { HistoryFacetOption } from '../../lib/history/filters';
import { listPublicEntityViews } from '../../lib/public-data/source';
import { HistoryExperience } from './HistoryExperience';
import { buildHistoryViewModel } from './history-view-model';
import './history.css';

void React;

function formatFacetOptionLabel(option: HistoryFacetOption): string {
  return option.count !== undefined ? `${option.label} (${option.count})` : option.label;
}

export const metadata = {
  title: 'History',
  description:
    'Browse documented Black history by decade — kind composition, evidence-backed connections, and a synchronized record list from published release artifacts.',
};

type HistoryPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const { data: entities } = await listPublicEntityViews();
  const view = buildHistoryViewModel(params, entities);

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-history__intro">
        <p className="ds-page__eyebrow">Temporal browse</p>
        <h1 className="ds-page__title">
          Decade by <em>decade</em>.
        </h1>
        <p className="ds-page__lede">
          Step through published release artifacts decade by decade — kind composition,
          documented connections, and archive framings alongside a synchronized list peer.
          Status and presence reflect what was active in each era, never present-day status
          backfilled.
        </p>
        <p className="ds-history__framing">{HISTORY_DIGNITY_FRAMING}</p>
        <p className="ds-history__framing">{HISTORY_DECADE_FRAMING}</p>
      </header>

      <div className="ds-stack" style={{ marginTop: 'var(--ds-space-6)' }}>
        <noscript>
          <div className="ds-history__noscript">
            <DecadeStepper decades={view.availableDecades} viewState={view.viewState} />
            <HistoryOverviewStrip
              overview={view.overview}
              {...(view.activeDecade ? { activeDecade: view.activeDecade } : {})}
            />
            <FilterBar
              method="get"
              action="/history"
              legend="Filter history records"
              fields={[
                {
                  id: 'history-q-njs',
                  name: 'q',
                  label: 'Search',
                  type: 'search',
                  defaultValue: view.viewState.filters.q,
                },
                {
                  id: 'history-kind-njs',
                  name: 'kind',
                  label: 'Kind',
                  type: 'select',
                  defaultValue: view.viewState.filters.kind,
                  options: view.facetOptions.kind.map((option) => ({
                    value: option.value,
                    label: formatFacetOptionLabel(option),
                  })),
                },
                {
                  id: 'history-status-njs',
                  name: 'status',
                  label: 'Status',
                  type: 'select',
                  defaultValue: view.viewState.filters.status,
                  options: view.facetOptions.status.map((option) => ({
                    value: option.value,
                    label: formatFacetOptionLabel(option),
                  })),
                },
                {
                  id: 'history-topic-njs',
                  name: 'topic',
                  label: 'Topic',
                  type: 'select',
                  defaultValue: view.viewState.filters.topic,
                  options: view.facetOptions.topic.map((option) => ({
                    value: option.value,
                    label: formatFacetOptionLabel(option),
                  })),
                },
                {
                  id: 'history-connections-njs',
                  name: 'connections',
                  label: 'Connections',
                  type: 'select',
                  defaultValue: view.viewState.filters.connections,
                  options: [
                    { value: 'all', label: 'All records' },
                    { value: 'with', label: 'With connections' },
                    { value: 'without', label: 'Without connections' },
                  ],
                },
                {
                  id: 'history-sort-njs',
                  name: 'sort',
                  label: 'Sort',
                  type: 'select',
                  defaultValue: view.viewState.filters.sort,
                  options: [
                    { value: 'name', label: 'Name A–Z' },
                    { value: 'kind', label: 'Kind' },
                    { value: 'connections', label: 'Connections' },
                  ],
                },
                ...(view.viewState.mode === 'decade' && view.activeDecade
                  ? [
                      {
                        id: 'history-decade-njs',
                        name: 'decade',
                        label: 'Decade',
                        type: 'text' as const,
                        defaultValue: view.activeDecade,
                      },
                    ]
                  : []),
              ]}
            />
            <p className="ds-sans" id="history-results-heading-njs">
              {view.totalMatched} record{view.totalMatched === 1 ? '' : 's'} in view
            </p>
            <HistoryGraphPanel
              nodes={view.nodes}
              edges={view.edges}
              sparseDecade={view.sparseDecade}
              labelledBy="history-results-heading-njs"
            />
            <HistoryResultList nodes={view.nodes} labelledBy="history-results-heading-njs" />
          </div>
        </noscript>

        <HistoryExperience initial={view} />
      </div>
    </main>
  );
}
