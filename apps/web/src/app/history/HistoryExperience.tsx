'use client';

/**
 * Client orchestrator for BB-093's `/history` temporal browse experience. Wires the decade
 * stepper, progressive-disclosure graph panel, synchronized accessible list, narrative/edge cards,
 * and shareable URL state. The server-rendered graph release snapshot is the source of truth;
 * `/history/api` refine is optional progressive enhancement when App Check is configured.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilterBar, Notice } from '@black-book/ui';
import {
  DecadeStepper,
  HistoryEdgePanel,
  HistoryGraphPanel,
  HistoryNarrativeCard,
  HistoryResultList,
} from '../../components/history';
import {
  buildHistoryHref,
  type HistoryViewState,
} from '../../lib/history/url-state';
import {
  HISTORY_DECADE_FRAMING,
  HISTORY_DIGNITY_FRAMING,
} from '../../lib/history/copy';
import { HISTORY_DEGRADED_MODE_COPY } from '../../lib/history/snapshot-mode';
import type { HistoryViewModel } from './history-view-model';

export type HistoryExperienceProps = {
  readonly initial: HistoryViewModel;
};

function mergeViewState(
  base: HistoryViewState,
  patch: Partial<HistoryViewState> & { readonly clearSelected?: boolean; readonly clearEdge?: boolean },
): HistoryViewState {
  const next: HistoryViewState = {
    mode: patch.mode ?? base.mode,
    filters: patch.filters ?? base.filters,
    ...(patch.decade !== undefined
      ? patch.decade
        ? { decade: patch.decade }
        : {}
      : base.decade
        ? { decade: base.decade }
        : {}),
  };

  if (patch.clearSelected) {
    return next;
  }
  if (patch.selected) {
    return { ...next, selected: patch.selected };
  }
  if (base.selected && !patch.clearEdge) {
    return { ...next, selected: base.selected, ...(base.edge ? { edge: base.edge } : {}) };
  }
  if (patch.clearEdge) {
    return next;
  }
  if (patch.edge) {
    return { ...next, edge: patch.edge };
  }
  return next;
}

function facetFields(view: HistoryViewModel) {
  return [
    {
      id: 'history-kind',
      name: 'kind',
      label: 'Kind',
      type: 'select' as const,
      defaultValue: view.viewState.filters.kind,
      options: view.facetOptions.kind,
    },
  ];
}

export function HistoryExperience({ initial }: HistoryExperienceProps) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [degradedReason, setDegradedReason] = useState<keyof typeof HISTORY_DEGRADED_MODE_COPY | null>(
    null,
  );

  useEffect(() => {
    setView(initial);
  }, [initial]);

  const pushViewState = useCallback(
    (next: HistoryViewState) => {
      router.replace(buildHistoryHref(next), { scroll: false });
    },
    [router],
  );

  const selectedNode = useMemo(
    () =>
      view.viewState.selected
        ? view.nodes.find((node) => node.entityId === view.viewState.selected)
        : undefined,
    [view.nodes, view.viewState.selected],
  );

  const selectedEdge = useMemo(
    () =>
      view.viewState.edge
        ? view.edges.find((edge) => edge.edgeId === view.viewState.edge)
        : undefined,
    [view.edges, view.viewState.edge],
  );

  const handleSelectNode = useCallback(
    (entityId: string) => {
      const next = mergeViewState(view.viewState, { selected: entityId, clearEdge: true });
      setView((current) => ({ ...current, viewState: next }));
      pushViewState(next);
    },
    [pushViewState, view.viewState],
  );

  const handleSelectEdge = useCallback(
    (edgeId: string) => {
      const next = mergeViewState(view.viewState, { edge: edgeId });
      setView((current) => ({ ...current, viewState: next }));
      pushViewState(next);
    },
    [pushViewState, view.viewState],
  );

  const handleCloseCard = useCallback(() => {
    const next = mergeViewState(view.viewState, { clearSelected: true, clearEdge: true });
    setView((current) => ({ ...current, viewState: next }));
    pushViewState(next);
  }, [pushViewState, view.viewState]);

  const handleCloseEdge = useCallback(() => {
    const next = mergeViewState(view.viewState, { clearEdge: true });
    setView((current) => ({ ...current, viewState: next }));
    pushViewState(next);
  }, [pushViewState, view.viewState]);

  const listProps = {
    nodes: view.nodes,
    labelledBy: 'history-results-heading',
    ...(view.viewState.selected ? { selectedId: view.viewState.selected } : {}),
    onSelect: handleSelectNode,
  };

  const graphProps = {
    nodes: view.nodes,
    edges: view.edges,
    sparseDecade: view.sparseDecade,
    labelledBy: 'history-graph-heading',
    onSelectNode: handleSelectNode,
    onSelectEdge: handleSelectEdge,
    ...(view.viewState.selected ? { selectedId: view.viewState.selected } : {}),
    ...(view.viewState.edge ? { selectedEdgeId: view.viewState.edge } : {}),
  };

  return (
    <div className="bb-history">
      {degradedReason ? (
        <Notice tone="warning" title="Snapshot mode">
          {HISTORY_DEGRADED_MODE_COPY[degradedReason]}
        </Notice>
      ) : null}

      <DecadeStepper decades={view.availableDecades} viewState={view.viewState} />

      <FilterBar
        method="get"
        action="/history"
        legend="Filter history graph records"
        fields={facetFields(view)}
        actions={
          <>
            {view.viewState.mode === 'decade' && view.viewState.decade ? (
              <input type="hidden" name="decade" value={view.viewState.decade} />
            ) : null}
            {view.viewState.selected ? (
              <input type="hidden" name="selected" value={view.viewState.selected} />
            ) : null}
            {view.viewState.edge ? <input type="hidden" name="edge" value={view.viewState.edge} /> : null}
            <button type="submit" className="bb-button bb-button--primary">
              Apply filters
            </button>
          </>
        }
      />

      <div className="bb-history__toolbar">
        <p className="bb-sans" id="history-results-heading">
          {view.totalMatched} record{view.totalMatched === 1 ? '' : 's'} in view
          {view.viewState.mode === 'decade' && view.activeDecade ? ` · ${view.activeDecade}` : ' · all time'}
        </p>
        <p className="bb-history__release-meta" aria-label="Release metadata">
          Release {view.releaseId}
        </p>
      </div>

      <div className="bb-history__layout">
        <div className="bb-history-graph-panel">
          <h2 className="bb-section__kicker" id="history-graph-heading">
            History graph
          </h2>
          <HistoryGraphPanel {...graphProps} />
        </div>

        <div className="bb-history__list-panel">
          {selectedNode ? (
            <HistoryNarrativeCard
              node={selectedNode}
              {...(view.activeDecade ? { decadeLabel: view.activeDecade } : {})}
              onClose={handleCloseCard}
            />
          ) : null}
          {selectedEdge ? <HistoryEdgePanel edge={selectedEdge} onClose={handleCloseEdge} /> : null}
          <HistoryResultList {...listProps} />
        </div>
      </div>

      <p className="bb-history__framing">{HISTORY_DIGNITY_FRAMING}</p>
      {view.viewState.mode === 'decade' ? (
        <p className="bb-history__framing">{HISTORY_DECADE_FRAMING}</p>
      ) : null}

      {/* Progressive enhancement hook — reserved for live refine; snapshot remains authoritative. */}
      <span hidden data-history-degraded-hook="" onFocus={() => setDegradedReason(null)} />
    </div>
  );
}
