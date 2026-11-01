/**
 * Canonical DiscoveryState for map/list continuity (v10).
 *
 * Explore, Records, and search redirects share overlapping narrowing concepts under different
 * URL spellings (`theme` vs `topic`, `floor` vs `evidence`, exact `confidence` vs floor). This
 * module is the shared vocabulary and the adapters that keep a reader's narrowing intact when
 * they switch views. Surfaces may expose a subset; they must not invent conflicting meanings.
 */
import {
  buildExploreHref,
  defaultExploreOverlayState,
  type ExploreViewState,
} from '../map-experience/url-state';
import { DEFAULT_EXPLORE_FILTERS } from '../map-experience/filters';
import type { EvidenceGrade } from '../map-experience/evidence-grade';
import {
  EMPTY_RECORDS_QUERY,
  recordsHref,
  type RecordsQuery,
} from '../records/build-records-index';
import { parseRecordsQuery } from '../records/records-query';
import { placeArrivalQuery as placeArrivalQueryFields } from './discovery-arrival';

export { mapListContinuityLabel } from './continuity-label';
export { withQuery } from './discovery-arrival';

export type DiscoveryView = 'map' | 'list';

/**
 * Shared discovery narrowing. Arrays are the conceptual multi-select shape; today's Explore and
 * Records UIs still serialize a single value per dimension. Adapters pick the first entry.
 */
export type DiscoveryState = {
  readonly query?: string;
  readonly kind?: readonly string[];
  readonly era?: readonly string[];
  readonly from?: string;
  readonly to?: string;
  readonly state?: readonly string[];
  readonly place?: readonly string[];
  readonly topic?: readonly string[];
  /** Evidence floor letter (`A` | `B` | `C`), not an exact confidence tier. */
  readonly evidence?: EvidenceGrade;
  readonly status?: readonly string[];
  readonly collection?: readonly string[];
  readonly sort?: string;
  readonly selected?: string;
  readonly view?: DiscoveryView;
};

export const EMPTY_DISCOVERY_STATE: DiscoveryState = Object.freeze({});

function firstOf(values: readonly string[] | undefined): string | undefined {
  const value = values?.[0]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function asSingleton(value: string | undefined): readonly string[] | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'all') return undefined;
  return [trimmed];
}

export function discoveryFromExplore(state: ExploreViewState): DiscoveryState {
  const kind = asSingleton(state.filters.kind);
  const era = asSingleton(state.filters.era);
  const topic = asSingleton(state.filters.theme);
  const status = asSingleton(state.filters.status);
  return {
    ...(state.query ? { query: state.query } : {}),
    ...(state.sort ? { sort: state.sort } : {}),
    ...(kind ? { kind } : {}),
    ...(era ? { era } : {}),
    ...(state.state ? { state: [state.state] } : {}),
    ...(topic ? { topic } : {}),
    ...(state.floor ? { evidence: state.floor } : {}),
    ...(status ? { status } : {}),
    ...(state.selected ? { selected: state.selected } : {}),
    view: 'map',
  };
}

export function discoveryFromRecords(query: RecordsQuery): DiscoveryState {
  const kind = asSingleton(query.kind);
  const era = asSingleton(query.era);
  const postal = asSingleton(query.state);
  const topic = asSingleton(query.topic);
  const status = asSingleton(query.status);
  return {
    ...(query.q.length > 0 ? { query: query.q } : {}),
    sort: query.sort,
    ...(kind ? { kind } : {}),
    ...(era ? { era } : {}),
    ...(postal ? { state: postal } : {}),
    ...(topic ? { topic } : {}),
    ...(query.evidence === 'A' || query.evidence === 'B' || query.evidence === 'C'
      ? { evidence: query.evidence }
      : {}),
    ...(status ? { status } : {}),
    view: 'list',
  };
}

export function recordsQueryFromDiscovery(state: DiscoveryState): RecordsQuery {
  const evidence = state.evidence;
  return {
    ...EMPTY_RECORDS_QUERY,
    q: parseRecordsQuery({ q: state.query }).q,
    sort: parseRecordsQuery({ sort: state.sort }).sort,
    kind: (firstOf(state.kind) ?? '').toLowerCase(),
    era: (firstOf(state.era) ?? '').toLowerCase(),
    state: (firstOf(state.state) ?? '').toUpperCase(),
    topic: (firstOf(state.topic) ?? '').toLowerCase(),
    status: (firstOf(state.status) ?? '').toLowerCase(),
    evidence: evidence ?? '',
    page: 1,
  };
}

/**
 * Builds an Explore view state carrying the same collection narrowing and bibliography order.
 */
export function exploreViewFromDiscovery(state: DiscoveryState): ExploreViewState {
  const kind = firstOf(state.kind) ?? DEFAULT_EXPLORE_FILTERS.kind;
  const era = firstOf(state.era) ?? DEFAULT_EXPLORE_FILTERS.era;
  const topic = firstOf(state.topic) ?? DEFAULT_EXPLORE_FILTERS.theme;
  const status = firstOf(state.status) ?? DEFAULT_EXPLORE_FILTERS.status;
  const postal = firstOf(state.state)?.toUpperCase();

  return {
    ...(state.query ? { query: parseRecordsQuery({ q: state.query }).q } : {}),
    sort: parseRecordsQuery({ sort: state.sort }).sort,
    filters: {
      ...DEFAULT_EXPLORE_FILTERS,
      kind,
      era,
      theme: topic,
      status,
    },
    ...defaultExploreOverlayState(),
    ...(postal ? { state: postal } : {}),
    ...(state.evidence ? { floor: state.evidence } : {}),
    ...(state.selected ? { selected: state.selected } : {}),
  };
}

/** `/records` href carrying DiscoveryState narrowing (drops map-only fields). */
export function listHrefFromDiscovery(state: DiscoveryState): string {
  return recordsHref(recordsQueryFromDiscovery(state));
}

/** `/explore` href carrying DiscoveryState narrowing that Explore understands. */
export function mapHrefFromDiscovery(state: DiscoveryState): string {
  return buildExploreHref(exploreViewFromDiscovery(state));
}

function paramOne(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    const trimmed = value[0].trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

/**
 * Recover DiscoveryState from Place (or other) arrival query params.
 * Accepts Explore spellings (`theme`, `floor`) and Records spellings (`topic`, `evidence`).
 */
export function discoveryFromSearchParams(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): DiscoveryState {
  const kind = asSingleton(paramOne(params.kind));
  const era = asSingleton(paramOne(params.era));
  const state = asSingleton(paramOne(params.state)?.toUpperCase());
  const topic = asSingleton(paramOne(params.topic) ?? paramOne(params.theme));
  const status = asSingleton(paramOne(params.status));
  const evidenceRaw = paramOne(params.evidence) ?? paramOne(params.floor);
  const evidence =
    evidenceRaw === 'A' || evidenceRaw === 'B' || evidenceRaw === 'C' ? evidenceRaw : undefined;
  const normalized = parseRecordsQuery({ q: params.q, sort: params.sort });
  const query = normalized.q;
  const selected = paramOne(params.selected);
  const from = paramOne(params.from);
  const view: DiscoveryView | undefined =
    from === 'explore' || from === 'map'
      ? 'map'
      : from === 'records' || from === 'list'
        ? 'list'
        : undefined;

  return {
    ...(query ? { query } : {}),
    sort: normalized.sort,
    ...(kind ? { kind } : {}),
    ...(era ? { era } : {}),
    ...(state ? { state } : {}),
    ...(topic ? { topic } : {}),
    ...(evidence ? { evidence } : {}),
    ...(status ? { status } : {}),
    ...(selected ? { selected } : {}),
    ...(view ? { view } : {}),
  };
}

/**
 * True when the state carries an origin or a narrowing a reader would want back: a map/list
 * origin, a search, a facet, an evidence floor, or a non-default bibliography order.
 * `selected` alone is not narrowing.
 */
export function discoveryHasNarrowing(state: DiscoveryState): boolean {
  return (
    Boolean(state.query) ||
    Boolean(state.kind) ||
    Boolean(state.era) ||
    Boolean(state.state) ||
    Boolean(state.topic) ||
    Boolean(state.evidence) ||
    Boolean(state.status) ||
    (state.sort !== undefined && state.sort !== 'discovery')
  );
}

/**
 * Query string (no leading `?`) that carries a record arrival through a redirect.
 * Re-serialized from DiscoveryState, never concatenated from the raw request, so unknown,
 * auth, token, `returnTo` and external params cannot ride along. Empty for a bare direct URL
 * (no origin, no narrowing) so canonical addresses do not acquire a gratuitous `from=`.
 * Legacy origin spellings (`explore`, `records`) canonicalize to `map` / `list`.
 */
export function recordArrivalQuery(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): string {
  const { selected, ...carried } = discoveryFromSearchParams(params);
  void selected;
  if (carried.view === undefined && !discoveryHasNarrowing(carried)) return '';
  return placeArrivalQuery(carried, carried.view ?? 'map');
}

export type PlaceDiscoveryReturn = {
  readonly mapHref: string;
  readonly listHref: string;
  readonly mapLabel: string;
  readonly listLabel: string;
  readonly previousHref?: string;
  readonly previousLabel?: string;
  readonly nextHref?: string;
  readonly nextLabel?: string;
  readonly positionLabel?: string;
};

/** DiscoveryState → Place arrival query (server/adapters; Explore uses discovery-arrival directly). */
export function placeArrivalQuery(state: DiscoveryState, from: 'map' | 'list'): string {
  const kind = firstOf(state.kind);
  const era = firstOf(state.era);
  const stateCode = firstOf(state.state);
  const topic = firstOf(state.topic);
  const status = firstOf(state.status);
  return placeArrivalQueryFields(
    {
      ...(state.query ? { query: state.query } : {}),
      ...(state.sort ? { sort: state.sort } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(era !== undefined ? { era } : {}),
      ...(stateCode !== undefined ? { state: stateCode } : {}),
      ...(topic !== undefined ? { topic } : {}),
      ...(state.evidence ? { evidence: state.evidence } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(state.selected ? { selected: state.selected } : {}),
    },
    from,
  );
}

/**
 * Return paths from a Place page. Always selects this place on Explore; preserves shared
 * narrowing when the arrival URL carried DiscoveryState.
 */
export function placeDiscoveryReturn(
  entityId: string,
  arrival: DiscoveryState,
  geo?: { readonly lat: number; readonly lng: number },
  neighbors?: {
    readonly previous?: { readonly href: string; readonly name: string };
    readonly next?: { readonly href: string; readonly name: string };
    readonly index: number;
    readonly total: number;
  },
  mapped = true,
): PlaceDiscoveryReturn {
  const { selected: _arrivalSelection, ...withoutSelection } = arrival;
  const withSelection: DiscoveryState = {
    ...withoutSelection,
    ...(mapped ? { selected: entityId } : {}),
    view: arrival.view ?? 'map',
  };
  const exploreBase = exploreViewFromDiscovery(withSelection);
  const mapHref = buildExploreHref({
    ...exploreBase,
    ...(mapped ? { selected: entityId } : {}),
    ...(geo && mapped ? { viewport: { lat: geo.lat, lng: geo.lng, zoom: 11 } } : {}),
  });
  const hasListNarrowing =
    Boolean(arrival.query) ||
    Boolean(arrival.kind) ||
    Boolean(arrival.era) ||
    Boolean(arrival.state) ||
    Boolean(arrival.topic) ||
    Boolean(arrival.evidence) ||
    Boolean(arrival.status);

  return {
    mapHref,
    listHref: listHrefFromDiscovery(arrival),
    mapLabel: hasListNarrowing
      ? 'Return to the map with this narrowing'
      : mapped
        ? 'See this place on the map'
        : 'Browse the map',
    listLabel: hasListNarrowing
      ? 'Return to the record list with this narrowing'
      : 'Browse the record list',
    ...(neighbors?.previous
      ? {
          previousHref: neighbors.previous.href,
          previousLabel: `Previous: ${neighbors.previous.name}`,
        }
      : {}),
    ...(neighbors?.next
      ? {
          nextHref: neighbors.next.href,
          nextLabel: `Next: ${neighbors.next.name}`,
        }
      : {}),
    ...(neighbors && neighbors.total > 0
      ? {
          positionLabel: `${(neighbors.index + 1).toLocaleString('en-US')} of ${neighbors.total.toLocaleString('en-US')} in this list`,
        }
      : {}),
  };
}
