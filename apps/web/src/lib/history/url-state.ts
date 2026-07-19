/**
 * Shareable URL state for `/history`: decade (or all-time), kind/q/sort/status/topic/connections
 * filters, selected node, and optional selected edge. Pure parse/serialize so the SSR page and
 * client orchestrator read and write the same shape — copied URLs reproduce the same browse view.
 */
import {
  DEFAULT_HISTORY_FILTERS,
  parseHistoryConnectionsFilter,
  parseHistorySort,
  type HistoryFilterState,
} from './filters';

export type HistoryViewMode = 'all-time' | 'decade';

export type HistoryViewState = {
  readonly mode: HistoryViewMode;
  /** Decade label (e.g. "1950s") when `mode === 'decade'`. */
  readonly decade?: string;
  readonly filters: HistoryFilterState;
  readonly selected?: string;
  readonly edge?: string;
};

export type RawHistorySearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') return raw;
  return raw[0];
}

function cleanSelectParam(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
}

const DECADE_PATTERN = /^\d{4}s$/;

export function parseDecadeParam(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === 'all') return undefined;
  return DECADE_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function parseHistorySearchParams(raw: RawHistorySearchParams): HistoryViewState {
  const decade = parseDecadeParam(firstValue(raw.decade));
  const kind = cleanSelectParam(firstValue(raw.kind)) as HistoryFilterState['kind'];
  const q = (firstValue(raw.q) ?? '').trim();
  const sort = parseHistorySort(firstValue(raw.sort));
  const status = cleanSelectParam(firstValue(raw.status));
  const topic = cleanSelectParam(firstValue(raw.topic));
  const connections = parseHistoryConnectionsFilter(firstValue(raw.connections));
  const selectedRaw = firstValue(raw.selected)?.trim();
  const edgeRaw = firstValue(raw.edge)?.trim();

  return {
    mode: decade ? 'decade' : 'all-time',
    ...(decade ? { decade } : {}),
    filters: { kind, q, sort, status, topic, connections },
    ...(selectedRaw ? { selected: selectedRaw } : {}),
    ...(edgeRaw ? { edge: edgeRaw } : {}),
  };
}

export function buildHistorySearchParams(state: HistoryViewState): string {
  const params = new URLSearchParams();
  if (state.mode === 'decade' && state.decade) {
    params.set('decade', state.decade);
  }
  if (state.filters.kind !== DEFAULT_HISTORY_FILTERS.kind) {
    params.set('kind', state.filters.kind);
  }
  if (state.filters.q?.trim()) {
    params.set('q', state.filters.q.trim());
  }
  if (state.filters.sort && state.filters.sort !== DEFAULT_HISTORY_FILTERS.sort) {
    params.set('sort', state.filters.sort);
  }
  if (state.filters.status !== DEFAULT_HISTORY_FILTERS.status) {
    params.set('status', state.filters.status);
  }
  if (state.filters.topic !== DEFAULT_HISTORY_FILTERS.topic) {
    params.set('topic', state.filters.topic);
  }
  if (state.filters.connections !== DEFAULT_HISTORY_FILTERS.connections) {
    params.set('connections', state.filters.connections);
  }
  if (state.selected) params.set('selected', state.selected);
  if (state.edge) params.set('edge', state.edge);
  return params.toString();
}

export function buildHistoryHref(state: HistoryViewState): string {
  const qs = buildHistorySearchParams(state);
  return qs ? `/history?${qs}` : '/history';
}
