/**
 * Temporal history graph browse page: all-time union view plus decade stepper over 
 * published graph release artifacts, synchronized accessible list peer, progressive-disclosure
 * graph rendering, and shareable URL state. SSR-first from the bundled snapshot; filters use
 * native GET navigation (no-JS safe).
 */
import React from 'react';
import { FilterBar } from '@black-book/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import {
  DecadeStepper,
  HistoryGraphPanel,
  HistoryResultList,
} from '../../components/history';
import {
  HISTORY_DECADE_FRAMING,
  HISTORY_DIGNITY_FRAMING,
} from '../../lib/history';
import { HistoryExperience } from './HistoryExperience';
import { buildHistoryViewModel } from './history-view-model';
import './history.css';

void React;

export const metadata = {
  title: 'History',
  description:
    'Walk documented Black history through time — an all-time graph view and decade-by-decade browse over published release artifacts.',
};

type HistoryPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const view = buildHistoryViewModel(params);

  return (
    <main className="bb-container bb-page" id="main">
      <header className="bb-entity-mast bb-history__intro">
        <p className="bb-page__eyebrow">Temporal browse</p>
        <h1 className="bb-page__title">History through time</h1>
        <p className="bb-page__lede">
          An all-time view of the published history graph plus decade-by-decade slices — what was
          active, in force, or living in each era, derived from status history and release artifacts,
          never present-day status backfilled.
        </p>
        <p className="bb-history__framing">{HISTORY_DIGNITY_FRAMING}</p>
        <p className="bb-history__framing">{HISTORY_DECADE_FRAMING}</p>
      </header>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <SeedDataNotice compact />

        <noscript>
          <div className="bb-history__noscript">
            <DecadeStepper decades={view.availableDecades} viewState={view.viewState} />
            <FilterBar
              method="get"
              action="/history"
              legend="Filter history graph records"
              fields={[
                {
                  id: 'history-kind-njs',
                  name: 'kind',
                  label: 'Kind',
                  type: 'select',
                  defaultValue: view.viewState.filters.kind,
                  options: view.facetOptions.kind,
                },
              ]}
            />
            <p className="bb-sans" id="history-results-heading-njs">
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
