/**
 * History v6 edition page: SSR-first temporal browse with edition Surface panels,
 * decade scrubber, composition data panel, and synchronized list peer. URL filters
 * use native GET navigation (no-JS safe).
 */
import React from 'react';
import { FilterBar } from '@repo/ui';
import {
  DecadeStepper,
  HistoryGraphPanel,
  HistoryOverviewStrip,
  HistoryResultList,
} from '../../components/history';
import { HISTORY_DECADE_FRAMING, HISTORY_DIGNITY_FRAMING } from '../../lib/history/copy';
import type { HistoryFacetOption } from '../../lib/history/filters';
import { listPublicEntityViews } from '../../lib/public-data/source';
import { HistoryExperience } from './HistoryExperience';
import { buildHistoryViewModel } from './history-view-model';
import {
  historyEditionPanelClassName,
  historyEditionRootClassName,
} from './history-panel-chrome';
import '../(map)/explore/explore-edition.css';
import '../../components/patterns/edition-fact-icon.css';
import './history-edition.css';
import './history.css';

void React;

function formatFacetOptionLabel(option: HistoryFacetOption): string {
  return option.count !== undefined ? `${option.label} (${option.count})` : option.label;
}

export const metadata = {
  title: 'History',
  description:
    'Find records in time: keyword search, decade browse, kind composition, and evidence-backed connections from published release artifacts.',
};

export const dynamic = 'force-dynamic';

type HistoryPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const { data: entities } = await listPublicEntityViews();
  const view = buildHistoryViewModel(params, entities);

  return (
    <main className="ds-container ds-page" id="main">
      <div className={historyEditionRootClassName()}>
        <article className={historyEditionPanelClassName('intro')}>
          <header className="ds-history-edition__header">
            <span className="ds-history-edition__index" aria-hidden="true">
              00
            </span>
            <div>
              <p className="ds-history-edition__kicker">Find in time</p>
              <h1 className="ds-history-edition__title">
                Browse the <em>archive</em>.
              </h1>
              <p className="ds-history-edition__lede">
                Step through published release artifacts decade by decade, or search by keyword and
                filter by kind, status, and era. Kind composition, documented connections, and
                archive framings sit beside a synchronized list peer. Status and presence reflect
                what was active in each era, never present-day status backfilled.
              </p>
              <p className="ds-history-edition__framing">{HISTORY_DIGNITY_FRAMING}</p>
              <p className="ds-history-edition__framing">{HISTORY_DECADE_FRAMING}</p>
            </div>
          </header>
        </article>

        <noscript>
          <div className="ds-history__noscript">
            <article className={historyEditionPanelClassName('timeline')}>
              <p className="ds-history-edition__panel-title">Timeline</p>
              <DecadeStepper decades={view.availableDecades} viewState={view.viewState} />
              <HistoryOverviewStrip
                overview={view.overview}
                {...(view.activeDecade ? { activeDecade: view.activeDecade } : {})}
              />
            </article>

            <article className={historyEditionPanelClassName('instruments')}>
              <p className="ds-history-edition__panel-title">Refine view</p>
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
                    id: 'history-era-njs',
                    name: 'era',
                    label: 'Era',
                    type: 'select',
                    defaultValue: view.viewState.filters.era,
                    options: view.facetOptions.era.map((option) => ({
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
            </article>

            <div className="ds-history-edition__layout">
              <article className={historyEditionPanelClassName('composition')}>
                <p className="ds-history-edition__panel-title" id="history-results-heading-njs">
                  Composition &amp; connections
                </p>
                <HistoryGraphPanel
                  nodes={view.nodes}
                  edges={view.edges}
                  sparseDecade={view.sparseDecade}
                  labelledBy="history-results-heading-njs"
                />
              </article>
              <article className={historyEditionPanelClassName('records')}>
                <p className="ds-history-edition__panel-title">Records in view</p>
                <p className="ds-sans">
                  {view.totalMatched} record{view.totalMatched === 1 ? '' : 's'} in view
                </p>
                <HistoryResultList nodes={view.nodes} labelledBy="history-results-heading-njs" />
              </article>
            </div>
          </div>
        </noscript>

        <HistoryExperience initial={view} />
      </div>
    </main>
  );
}
