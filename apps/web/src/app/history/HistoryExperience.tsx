'use client';

/**
 * Client orchestrator for `/history` temporal browse experience. Wires the decade
 * stepper, progressive-disclosure graph panel, synchronized accessible list, narrative/edge cards,
 * and shareable URL state. The server-rendered graph release snapshot is the source of truth;
 * `/history/api` refine is optional progressive enhancement when App Check is configured.
 */
import { startTransition, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Notice } from '@repo/ui';
import {
  DecadeStepper,
  HistoryEdgePanel,
  HistoryGraphPanel,
  HistoryNarrativeCard,
  HistoryResultList,
} from '../../components/history';
import {
  HISTORY_SORT_OPTIONS,
  type HistorySort,
} from '../../lib/history/filters';
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

export function HistoryExperience({ initial }: HistoryExperienceProps) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [queryDraft, setQueryDraft] = useState(initial.viewState.filters.q);
  const [degradedReason, setDegradedReason] = useState<keyof typeof HISTORY_DEGRADED_MODE_COPY | null>(
    null,
  );

  useEffect(() => {
    setView(initial);
    setQueryDraft(initial.viewState.filters.q);
  }, [initial]);

  const pushViewState = useCallback(
    (next: HistoryViewState) => {
      startTransition(() => {
        router.replace(buildHistoryHref(next), { scroll: false });
      });
    },
    [router],
  );

  const applyFilters = useCallback(
    (patch: Partial<HistoryViewState['filters']>) => {
      const next = mergeViewState(view.viewState, {
        filters: { ...view.viewState.filters, ...patch },
        clearSelected: true,
        clearEdge: true,
      });
      setView((current) => ({ ...current, viewState: next }));
      pushViewState(next);
    },
    [pushViewState, view.viewState],
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

  const handleDecadeSelect = useCallback(
    (decade: string | undefined) => {
      const next = mergeViewState(view.viewState, {
        mode: decade ? 'decade' : 'all-time',
        decade: decade ?? '',
        clearSelected: true,
        clearEdge: true,
      });
      setView((current) => ({ ...current, viewState: next }));
      pushViewState(next);
    },
    [pushViewState, view.viewState],
  );

  const handleKindChange = useCallback(
    (kind: string) => {
      const valid = view.facetOptions.kind.some((option) => option.value === kind);
      applyFilters({
        kind: (valid ? kind : 'all') as HistoryViewModel['viewState']['filters']['kind'],
      });
    },
    [applyFilters, view.facetOptions.kind],
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      const nextSort = (HISTORY_SORT_OPTIONS.some((option) => option.value === sort)
        ? sort
        : 'name') as HistorySort;
      applyFilters({ sort: nextSort });
    },
    [applyFilters],
  );

  const handleQuerySubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      applyFilters({ q: queryDraft.trim() });
    },
    [applyFilters, queryDraft],
  );

  const handleClearFilters = useCallback(() => {
    setQueryDraft('');
    applyFilters({ q: '', kind: 'all', sort: 'name' });
  }, [applyFilters]);

  const hasActiveFilters =
    view.viewState.filters.q.length > 0 ||
    view.viewState.filters.kind !== 'all' ||
    view.viewState.filters.sort !== 'name';

  const listProps = {
    nodes: view.nodes,
    labelledBy: 'history-results-heading',
    ...(view.viewState.selected ? { selectedId: view.viewState.selected } : {}),
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
    <div className="ds-history">
      {degradedReason ? (
        <Notice tone="warning" title="Snapshot mode">
          {HISTORY_DEGRADED_MODE_COPY[degradedReason]}
        </Notice>
      ) : null}

      <div className="ds-history__stepper-sticky">
        <DecadeStepper
          decades={view.availableDecades}
          viewState={view.viewState}
          onSelect={handleDecadeSelect}
        />
      </div>

      <div className="ds-history__toolbar">
        <form className="ds-history__search" onSubmit={handleQuerySubmit} role="search">
          <label className="ds-history__search-label" htmlFor="history-q">
            Search records
          </label>
          <input
            className="ds-history__search-input"
            id="history-q"
            name="q"
            type="search"
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.currentTarget.value)}
            placeholder="Search by name or summary"
            autoComplete="off"
          />
          <button className="ds-button ds-button--secondary" type="submit">
            Search
          </button>
        </form>

        <label className="ds-pill-select" htmlFor="history-kind">
          <span className="ds-pill-select__label">Kind</span>
          <select
            className="ds-pill-select__control"
            id="history-kind"
            value={view.viewState.filters.kind}
            onChange={(event) => handleKindChange(event.currentTarget.value)}
          >
            {view.facetOptions.kind.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="ds-pill-select" htmlFor="history-sort">
          <span className="ds-pill-select__label">Sort</span>
          <select
            className="ds-pill-select__control"
            id="history-sort"
            value={view.viewState.filters.sort}
            onChange={(event) => handleSortChange(event.currentTarget.value)}
          >
            {HISTORY_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {hasActiveFilters ? (
          <button className="ds-button ds-button--secondary" type="button" onClick={handleClearFilters}>
            Clear
          </button>
        ) : null}

        <p className="ds-sans ds-history__count" id="history-results-heading">
          {view.totalMatched} record{view.totalMatched === 1 ? '' : 's'} in view
          {view.viewState.mode === 'decade' && view.activeDecade ? ` · ${view.activeDecade}` : ' · all time'}
        </p>

        <p className="ds-history__release-meta" aria-label="Release metadata">
          Release {view.releaseId}
        </p>
      </div>

      <div className="ds-history__layout">
        <div className="ds-history-graph-panel">
          <h2 className="ds-section__kicker" id="history-graph-heading">
            History graph
          </h2>
          <HistoryGraphPanel {...graphProps} />
        </div>

        <div className="ds-history__list-panel">
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

      <p className="ds-history__framing">{HISTORY_DIGNITY_FRAMING}</p>
      {view.viewState.mode === 'decade' ? (
        <p className="ds-history__framing">{HISTORY_DECADE_FRAMING}</p>
      ) : null}

      <span hidden data-history-degraded-hook="" onFocus={() => setDegradedReason(null)} />
    </div>
  );
}
