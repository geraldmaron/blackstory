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
    q: state.query?.trim() ?? '',
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
 * Builds an Explore view state for handoff. Text search (`query`) does not cross: the Atlas has
 * no text pin filter. Callers must disclose that in off-ramp copy (Records already does).
 */
export function exploreViewFromDiscovery(state: DiscoveryState): ExploreViewState {
  const kind = firstOf(state.kind) ?? DEFAULT_EXPLORE_FILTERS.kind;
  const era = firstOf(state.era) ?? DEFAULT_EXPLORE_FILTERS.era;
  const topic = firstOf(state.topic) ?? DEFAULT_EXPLORE_FILTERS.theme;
  const status = firstOf(state.status) ?? DEFAULT_EXPLORE_FILTERS.status;
  const postal = firstOf(state.state)?.toUpperCase();

  return {
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

/** `/explore` href carrying DiscoveryState narrowing that the Atlas understands. */
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
  const query = paramOne(params.q);
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

/** DiscoveryState → Place arrival query (server/adapters; Atlas uses discovery-arrival directly). */
export function placeArrivalQuery(state: DiscoveryState, from: 'map' | 'list'): string {
  const kind = firstOf(state.kind);
  const era = firstOf(state.era);
  const stateCode = firstOf(state.state);
  const topic = firstOf(state.topic);
  const status = firstOf(state.status);
  return placeArrivalQueryFields(
    {
      ...(state.query ? { query: state.query } : {}),
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
 * Return paths from a Place page. Always selects this place on the Atlas; preserves shared
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
): PlaceDiscoveryReturn {
  const withSelection: DiscoveryState = {
    ...arrival,
    selected: entityId,
    view: arrival.view ?? 'map',
  };
  const exploreBase = exploreViewFromDiscovery(withSelection);
  const mapHref = buildExploreHref({
    ...exploreBase,
    selected: entityId,
    ...(geo ? { viewport: { lat: geo.lat, lng: geo.lng, zoom: 11 } } : {}),
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
      ? 'Return to Explore with this narrowing'
      : 'See this place on Explore',
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
