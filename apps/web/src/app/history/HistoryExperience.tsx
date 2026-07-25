'use client';

/**
 * Client orchestrator for `/history` temporal browse experience. Wires the decade
 * stepper, overview strip, filter toolbar, data panel (composition + connections +
 * archive framings), synchronized accessible list, narrative/edge cards, and shareable
 * URL state. The server-rendered graph release snapshot is the source of truth;
 * `/history/api` refine is optional progressive enhancement when App Check is configured.
 */
import { startTransition, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Notice, cx } from '@repo/ui';
import {
  DecadeStepper,
  HistoryEdgePanel,
  HistoryGraphPanel,
  HistoryNarrativeCard,
  HistoryOverviewStrip,
  HistoryResultList,
} from '../../components/history';
import {
  DEFAULT_HISTORY_FILTERS,
  HISTORY_FILTER_GROUPS,
  HISTORY_SORT_OPTIONS,
  isHistoryKindCategory,
  type HistoryFacetOption,
  type HistorySort,
} from '../../lib/history/filters';
import { buildHistoryHref, type HistoryViewState } from '../../lib/history/url-state';
import { HISTORY_DECADE_FRAMING, HISTORY_DIGNITY_FRAMING } from '../../lib/history/copy';
import { HISTORY_DEGRADED_MODE_COPY } from '../../lib/history/snapshot-mode';
import { kindEncodingFor } from '../../lib/map-experience/kind-encoding';
import type { HistoryViewModel } from '../../lib/history/history-view-model.types';
import { historyEditionPanelClassName } from './history-panel-chrome';

export type HistoryExperienceProps = {
  readonly initial: HistoryViewModel;
};

const HISTORY_CONNECTIONS_OPTIONS = [
  { value: 'all', label: 'All records' },
  { value: 'with', label: 'With connections' },
  { value: 'without', label: 'Without connections' },
] as const;

function formatFacetOptionLabel(option: HistoryFacetOption): string {
  return option.count !== undefined ? `${option.label} (${option.count})` : option.label;
}

function mergeViewState(
  base: HistoryViewState,
  patch: Partial<HistoryViewState> & {
    readonly clearSelected?: boolean;
    readonly clearEdge?: boolean;
  },
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
  const [degradedReason, setDegradedReason] = useState<
    keyof typeof HISTORY_DEGRADED_MODE_COPY | null
  >(null);

  useEffect(() => {
    setView(initial);
    setQueryDraft(initial.viewState.filters.q);
  }, [initial]);

  const pushViewState = useCallback(
    (next: HistoryViewState) => {
      startTransition(() => {
        router.replace(buildHistoryHref(next), { scroll: false });
        router.refresh();
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
      // Accept both consolidated category ids (primary chips) and raw entity kinds
      // (advanced disclosure + graph-node kind clicks).
      const valid =
        view.facetOptions.kind.some((option) => option.value === kind) ||
        view.facetOptions.kindDetail.some((option) => option.value === kind);
      applyFilters({
        kind: (valid ? kind : 'all') as HistoryViewModel['viewState']['filters']['kind'],
      });
    },
    [applyFilters, view.facetOptions.kind, view.facetOptions.kindDetail],
  );

  const handleStatusChange = useCallback(
    (status: string) => {
      const valid = view.facetOptions.status.some((option) => option.value === status);
      applyFilters({ status: valid ? status : 'all' });
    },
    [applyFilters, view.facetOptions.status],
  );

  const handleEraChange = useCallback(
    (era: string) => {
      const valid = view.facetOptions.era.some((option) => option.value === era);
      applyFilters({ era: valid ? era : 'all' });
    },
    [applyFilters, view.facetOptions.era],
  );

  const handleTopicChange = useCallback(
    (topic: string) => {
      const valid = view.facetOptions.topic.some((option) => option.value === topic);
      applyFilters({ topic: valid ? topic : 'all' });
    },
    [applyFilters, view.facetOptions.topic],
  );

  const handleConnectionsChange = useCallback(
    (connections: string) => {
      const next =
        connections === 'with' || connections === 'without'
          ? connections
          : DEFAULT_HISTORY_FILTERS.connections;
      applyFilters({ connections: next });
    },
    [applyFilters],
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      const nextSort = (
        HISTORY_SORT_OPTIONS.some((option) => option.value === sort) ? sort : 'name'
      ) as HistorySort;
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
    applyFilters({
      q: DEFAULT_HISTORY_FILTERS.q,
      kind: DEFAULT_HISTORY_FILTERS.kind,
      sort: DEFAULT_HISTORY_FILTERS.sort,
      status: DEFAULT_HISTORY_FILTERS.status,
      era: DEFAULT_HISTORY_FILTERS.era,
      topic: DEFAULT_HISTORY_FILTERS.topic,
      connections: DEFAULT_HISTORY_FILTERS.connections,
    });
  }, [applyFilters]);

  useEffect(() => {
    const trimmed = queryDraft.trim();
    if (trimmed === view.viewState.filters.q) return undefined;
    const timer = window.setTimeout(() => {
      applyFilters({ q: trimmed });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [applyFilters, queryDraft, view.viewState.filters.q]);

  const activeKind = view.viewState.filters.kind;
  const rawKindSelected =
    activeKind !== DEFAULT_HISTORY_FILTERS.kind && !isHistoryKindCategory(activeKind);

  const hasActiveFilters =
    view.viewState.filters.q.length > 0 ||
    view.viewState.filters.kind !== DEFAULT_HISTORY_FILTERS.kind ||
    view.viewState.filters.sort !== DEFAULT_HISTORY_FILTERS.sort ||
    view.viewState.filters.status !== DEFAULT_HISTORY_FILTERS.status ||
    view.viewState.filters.era !== DEFAULT_HISTORY_FILTERS.era ||
    view.viewState.filters.topic !== DEFAULT_HISTORY_FILTERS.topic ||
    view.viewState.filters.connections !== DEFAULT_HISTORY_FILTERS.connections;

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
    onSelectKind: handleKindChange,
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

      <article className={historyEditionPanelClassName('timeline')}>
        <p className="ds-history-edition__panel-title">Timeline</p>
        <div className="ds-history-edition__stepper-sticky">
          <DecadeStepper
            decades={view.availableDecades}
            viewState={view.viewState}
            onSelect={handleDecadeSelect}
          />
        </div>
        <HistoryOverviewStrip
          overview={view.overview}
          {...(view.activeDecade ? { activeDecade: view.activeDecade } : {})}
        />
      </article>

      <article className={historyEditionPanelClassName('instruments')}>
        <p className="ds-history-edition__panel-title">Refine view</p>

        {/* Primary entry action: search elevated to its own full-width, emphasized row
            above the secondary filter groups (repo-et18). */}
        <form className="ds-history__search" onSubmit={handleQuerySubmit} role="search">
          <label className="ds-history__search-label" htmlFor="history-q">
            Search records
          </label>
          <div className="ds-history__search-field">
            <span className="ds-history__search-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor">
                <circle cx="9" cy="9" r="6" strokeWidth="1.75" />
                <line x1="13.5" y1="13.5" x2="17.5" y2="17.5" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="ds-history__search-input"
              id="history-q"
              name="q"
              type="search"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.currentTarget.value)}
              placeholder="Search records by name or summary"
              autoComplete="off"
            />
            <button className="ds-button ds-button--primary ds-history__search-submit" type="submit">
              Search
            </button>
          </div>
        </form>

        {/* Secondary filters, regrouped by data structure (repo-5rtl). */}
        <div className="ds-history__filters">
          <fieldset
            className="ds-history-kind-chips ds-history__filter-group"
            role="radiogroup"
            aria-label={HISTORY_FILTER_GROUPS.recordType.label}
          >
            <legend className="ds-history-kind-chips__legend">
              {HISTORY_FILTER_GROUPS.recordType.label}
            </legend>
            {/* Primary chips: consolidated high-level categories (repo-k1t9) so the type
                filter stays scannable instead of a wall of ~11 raw-kind chips. */}
            {view.facetOptions.kind.map((option) => {
              const isActive = view.viewState.filters.kind === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cx(
                    'ds-history-kind-chips__chip',
                    isActive && 'ds-history-kind-chips__chip--active',
                  )}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => handleKindChange(option.value)}
                >
                  {formatFacetOptionLabel(option)}
                </button>
              );
            })}

            {/* Advanced: full raw entity-kind vocabulary, deferred into a disclosure and
                auto-opened when a raw kind is the active filter (e.g. via a graph node). */}
            <details
              className="ds-history-kind-chips__advanced"
              open={rawKindSelected}
            >
              <summary className="ds-history-kind-chips__advanced-summary">
                All record types
              </summary>
              <div
                className="ds-history-kind-chips__advanced-body"
                role="group"
                aria-label="All record types"
              >
                {view.facetOptions.kindDetail
                  .filter((option) => option.value !== 'all')
                  .map((option) => {
                    const isActive = view.viewState.filters.kind === option.value;
                    const encoding = kindEncodingFor(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cx(
                          'ds-history-kind-chips__chip',
                          isActive && 'ds-history-kind-chips__chip--active',
                        )}
                        aria-pressed={isActive}
                        onClick={() => handleKindChange(option.value)}
                      >
                        {encoding ? (
                          <span
                            className={cx(
                              'ds-legend-glyph',
                              `ds-legend-glyph--${encoding.glyph}`,
                              'ds-history-kind-chips__glyph',
                            )}
                            style={
                              encoding.glyph === 'ring'
                                ? { borderColor: encoding.shade, background: 'transparent' }
                                : { background: encoding.shade, borderColor: encoding.shade }
                            }
                            aria-hidden="true"
                          />
                        ) : null}
                        {formatFacetOptionLabel(option)}
                      </button>
                    );
                  })}
              </div>
            </details>
          </fieldset>

          {/* TIME & CONTEXT: Era + Status collapsed into one grouped control (both
              temporal/contextual facets). */}
          <fieldset className="ds-history__filter-group">
            <legend className="ds-history__filter-group-label">
              {HISTORY_FILTER_GROUPS.timeContext.label}
            </legend>
            <div className="ds-history-edition__facets">
              <div className="ds-history-edition__facet">
                <label className="ds-history-edition__facet-label" htmlFor="history-era">
                  Era
                </label>
                <select
                  className="ds-pill-select__control"
                  id="history-era"
                  value={view.viewState.filters.era}
                  onChange={(event) => handleEraChange(event.currentTarget.value)}
                >
                  {view.facetOptions.era.map((option) => (
                    <option key={option.value} value={option.value}>
                      {formatFacetOptionLabel(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ds-history-edition__facet">
                <label className="ds-history-edition__facet-label" htmlFor="history-status">
                  Status
                </label>
                <select
                  className="ds-pill-select__control"
                  id="history-status"
                  value={view.viewState.filters.status}
                  onChange={(event) => handleStatusChange(event.currentTarget.value)}
                >
                  {view.facetOptions.status.map((option) => (
                    <option key={option.value} value={option.value}>
                      {formatFacetOptionLabel(option)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* RELATIONSHIPS: ternary connections filter as a compact segmented toggle. */}
          <fieldset className="ds-history__filter-group">
            <legend className="ds-history__filter-group-label">
              {HISTORY_FILTER_GROUPS.relationships.label}
            </legend>
            <div
              className="ds-history__segment-strip"
              role="group"
              aria-label="Filter by connections"
            >
              {HISTORY_CONNECTIONS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="ds-history__segment"
                  aria-pressed={view.viewState.filters.connections === option.value}
                  onClick={() => handleConnectionsChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* TOPICS: large, growing tag vocabulary deferred into a disclosure so it does
              not crowd the primary filter row. */}
          <details className="ds-history__more" open={view.viewState.filters.topic !== 'all'}>
            <summary className="ds-history__more-summary">More filters</summary>
            <div className="ds-history__more-body">
              <fieldset className="ds-history__filter-group">
                <legend className="ds-history__filter-group-label">
                  {HISTORY_FILTER_GROUPS.topics.label}
                </legend>
                <div className="ds-history-edition__facets">
                  <div className="ds-history-edition__facet">
                    <label className="ds-history-edition__facet-label" htmlFor="history-topic">
                      Topic
                    </label>
                    <select
                      className="ds-pill-select__control"
                      id="history-topic"
                      value={view.viewState.filters.topic}
                      onChange={(event) => handleTopicChange(event.currentTarget.value)}
                    >
                      {view.facetOptions.topic.map((option) => (
                        <option key={option.value} value={option.value}>
                          {formatFacetOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>
            </div>
          </details>
        </div>

        {/* Sort is result ordering, not a filter — kept visually separate. */}
        <div className="ds-history__result-bar">
          <div className="ds-history__sort">
            <label className="ds-history-edition__facet-label" htmlFor="history-sort">
              Sort
            </label>
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
          </div>

          {hasActiveFilters ? (
            <button
              className="ds-button ds-button--secondary ds-button--compact"
              type="button"
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          ) : null}

          <p className="ds-sans ds-history__count">
            {view.totalMatched} record{view.totalMatched === 1 ? '' : 's'} in view
            {view.searchSpansAllTime
              ? ' · all decades (search)'
              : view.viewState.mode === 'decade' && view.activeDecade
                ? ` · ${view.activeDecade}`
                : ' · all time'}
          </p>

          <p className="ds-history__release-meta" aria-label="Release metadata">
            Release {view.releaseId}
          </p>
        </div>
      </article>

      <div className="ds-history-edition__layout">
        <article className={historyEditionPanelClassName('composition')}>
          <h2 className="ds-history-edition__panel-title" id="history-graph-heading">
            Composition &amp; connections
          </h2>
          <HistoryGraphPanel {...graphProps} activeKind={view.viewState.filters.kind} />
        </article>

        <article className={historyEditionPanelClassName('records')}>
          <h2 className="ds-history-edition__panel-title" id="history-results-heading">
            Records in view
          </h2>
          {selectedNode ? (
            <HistoryNarrativeCard
              node={selectedNode}
              {...(view.activeDecade ? { decadeLabel: view.activeDecade } : {})}
              onClose={handleCloseCard}
            />
          ) : null}
          {selectedEdge ? <HistoryEdgePanel edge={selectedEdge} onClose={handleCloseEdge} /> : null}
          <HistoryResultList {...listProps} />
        </article>
      </div>

      <div className="ds-history-edition__footnotes">
        <p className="ds-history__framing">{HISTORY_DIGNITY_FRAMING}</p>
        {view.viewState.mode === 'decade' ? (
          <p className="ds-history__framing">{HISTORY_DECADE_FRAMING}</p>
        ) : null}
      </div>

      <span hidden data-history-degraded-hook="" onFocus={() => setDegradedReason(null)} />
    </div>
  );
}
