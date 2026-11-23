/**
 * Shareable URL state for `/explore`: filters + selected entity + map layer model
 * + selected state + optional relationship lines decade
 * selected edge. Pure parse/serialize so the server-rendered page and the client
 * orchestrator read and write the exact same shape.
 *
 * Camera (`lat`/`lng`/`zoom`): parsed so an in-process caller can hand the client a camera, and
 * so old links do not throw. The explore client does not continuously sync the live camera into
 * the address bar; pan/zoom stay in-memory. See `EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS` below for
 * why these three never survive into a shareable address.
 *
 * Panel chrome: map-first by default (filters / color key / records collapsed). `panels=` and
 * legacy `hidePanels=` still parse so previously shared links keep opening what they named, but
 * the serializer never writes them back (see `buildExploreSearchParams`).
 *
 * Selection note: `selected` opens the preview narrative card and orients the copper ring on
 * the map (e.g. “View on map” from a record page). The full record is reached via the card
 * CTA at `/place/{slug}` (legacy `/entity/[id]` 308s there), not by pin/list selection alone.
 *
 * Evidence floor: `floor=A|B|C` is the Lens “and up” predicate (SP-16). It is distinct from
 * exact-match `confidence=`. Records→Explore handoff writes `floor`; without this key in the
 * parser/allowlist, middleware stripped it and silently widened the set.
 */
import { parseRecordsQuery, type RecordsSort } from '../records/records-query';
import { isPopulationDecade } from '@repo/domain/demographics/population-decades';
import { findUsStateByPostalCode, US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { DEFAULT_EXPLORE_FILTERS, type ExploreFilterState } from './filters';
import {
  coercePopulationGeoForDecade,
  DEFAULT_POPULATION_GEO,
  defaultPopulationChangeFrom,
  defaultPopulationChangeTo,
  defaultPopulationDecade,
  parseExplorePopulationDecade,
  parseExplorePopulationGeo,
  type ExplorePopulationGeo,
} from './explore-population';
import { EXPLORE_RADIUS_PRESETS, type ExploreRadiusPresetId } from './explore-place-radius';
import type { EvidenceGrade } from './evidence-grade';
import { normalizePeriod, type PeriodBound } from '../discovery/collection-period';
import type { CollectionToken } from '../discovery/story-collection';

export type ExploreViewport = {
  readonly lat: number;
  readonly lng: number;
  readonly zoom: number;
};

/** Geographic extent of the live map camera (not written to the URL). */
export type ExploreMapBounds = {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
};

/** Center/zoom plus live bounds — emitted by MapStage on moveend. */
export type ExploreViewportFrame = ExploreViewport & {
  readonly bounds: ExploreMapBounds;
};

export type ExploreLayerMode = 'off' | 'presence' | 'blackShare' | 'blackChange';

export type ExploreViewState = {
  readonly filters: ExploreFilterState;
  readonly query?: string;
  readonly sort?: RecordsSort;
  readonly viewport?: ExploreViewport;
  readonly selected?: string;
  /** USPS state DC postal code when a state shape is selected on the map.  */
  readonly state?: string;
  /**
   * The place the map and list are scoped to (`state-ga`, `county-13121`, `city-ga-atlanta`;
   * `docs/ui/patterns-place-map.md`). A focus instruction like `selected`: it frames the camera
   * on arrival, and the list shows exactly that place's records.
   */
  readonly place?: string;
  /** Map overlay model — `off` hides all choropleth/density fills. */
  readonly layerMode: ExploreLayerMode;
  /** Geography for population layers — state (1790–2020) or county (2000–2020 only). */
  readonly popGeo?: ExplorePopulationGeo;
  /** Decennial vintage for `blackShare`. */
  readonly popDecade?: string;
  /** From-decade for `blackChange`. */
  readonly popFrom?: string;
  /** To-decade for `blackChange`. */
  readonly popTo?: string;
  /**
   * Aerial imagery under the archive instead of the flat plate (opt-in via `sat=1`). Shareable
   * because it changes what the reader is looking at, so a link that drops it hands the
   * recipient a different map than the sender was reading.
   */
  readonly sat: boolean;
  /** Draw evidence-backed History relationship lines between entity anchors.  */
  readonly lines: boolean;
  /** When set with lines, filter edges to this decade slice (e.g. `1950s`).  */
  readonly decade?: string;
  /** Selected History edge id when a relationship line is clicked.  */
  readonly edge?: string;
  /** When false, the filters panel is hidden (default shown). */
  readonly showFilters: boolean;
  /** When false, the results cards rail is hidden (default shown). */
  readonly showResults: boolean;
  /** When false, the color key / “Reading this map” legend is hidden (default shown). */
  readonly showKey: boolean;
  /** Finite place-search radius preset from a deep link (e.g. `10mi`). Omitted when All. */
  readonly radius?: ExploreRadiusPresetId;
  /** Human place label for place-search status UI (never raw coordinates). */
  readonly near?: string;
  /**
   * Evidence floor (`A` | `B` | `C`) — “this grade and up”. Omitted means any (including
   * ungraded). Distinct from `filters.confidence`, which is an exact tier match.
   */
  readonly floor?: EvidenceGrade;
  /**
   * A focus instruction, not a filter — the same class as `selected`:
   * `find=place` opens the Explore filters with the place field focused (`/locate` 308s here carrying
   * it). It narrows nothing in `filtered`/`sorted`, so unlike every key above it never renders as
   * a clearable Lens constraint chip. The only value read today is `'place'`; typed as a bare
   * `string` rather than a literal union so an unrecognized value round-trips instead of being
   * silently dropped by `parseExploreSearchParams`/`buildExploreSearchParams`, which would read
   * as the edge stripping an unrecognized query key.
   */
  readonly find?: string;
  /**
   * Named collection (`story:<slug>`, or the finite `missing` / `invalid` sentinels). Narrows the
   * same way it does on `/records`: an unresolved one matches nothing, never the whole archive.
   */
  readonly collection?: CollectionToken;
  /** Inclusive stored decade-start bounds; distinct from `decade` (relationship slice) and `pop*`. */
  readonly periodStart?: PeriodBound;
  readonly periodEnd?: PeriodBound;
  readonly includeUndated?: boolean;
  /**
   * Return context, not a filter: the Records representation the reader came from, so that
   * leaving the map for Records restores the chronology they left. Never narrows anything.
   */
  readonly layout?: 'chronology';
  /**
   * Return context from the list, never read by the map: the page and the shuffle seed the reader
   * left, so the List link can hand them back while the filters are unchanged.
   */
  readonly page?: number;
  readonly seed?: string;
};

export type RawExploreSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

/**
 * Every query key `parseExploreSearchParams` reads, in the order it reads them.
 *
 * This is the single source of truth for the `/` and `/explore` param vocabulary. The edge
 * allowlist (`EXPLORE_PAGE_PARAM_ALLOWLIST` in runtime-hardening/constants.ts) is generated from
 * this list rather than retyped, so a key added to the parser cannot end up stripped by
 * middleware before the page ever sees it. Drift tests in
 * `../runtime-hardening/query-normalization.test.ts` fail in both directions: when the parser
 * reads a key this list lacks, and when the serializer writes one.
 */
export const EXPLORE_URL_PARAM_KEYS = [
  'view',
  'q',
  'sort',
  'era',
  'kind',
  'tone',
  'topic',
  'theme',
  'status',
  'confidence',
  'evidence',
  'floor',
  'lat',
  'lng',
  'zoom',
  'selected',
  'state',
  'place',
  'sat',
  'lines',
  'decade',
  'edge',
  'layerMode',
  'density',
  'popGeo',
  'popDecade',
  'popFrom',
  'popTo',
  'radius',
  'near',
  'hidePanels',
  'panels',
  'find',
  'collection',
  'periodStart',
  'periodEnd',
  'includeUndated',
  'layout',
  'seed',
  'page',
] as const;

export type ExploreUrlParamKey = (typeof EXPLORE_URL_PARAM_KEYS)[number];

/**
 * Viewport policy (`docs/decisions-carryover.md`, "Persistent map canvas"): a shareable URL
 * restores *what* the reader was looking at, never *where the camera was*.
 *
 * These three keys are parsed, and deliberately excluded from the edge allowlist, so they cannot
 * reach a bookmarked, shared or crawled address. Pinning a camera hands the recipient a framing
 * they did not choose and cannot tell apart from the data itself: a tight zoom on one county
 * reads as an editorial claim about that county. The exclusion is this named list, not an
 * omission from the allowlist, so removing it is a decision someone has to make on purpose.
 *
 * The same reasoning is enforced on the share builder by `assertNoViewportKeys` in
 * `../share/deep-link.ts`.
 */
export const EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS = ['lat', 'lng', 'zoom'] as const;

export type ExploreViewportPolicyDroppedKey = (typeof EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS)[number];

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') return raw;
  return raw[0];
}

function parseFiniteNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}

/*
 * Value shapes. The edge proxy runs this parser on every `/explore` request, so any value it
 * accepts unchecked is a cache key a crawler can mint freely (`?theme=<random>` rendered
 * afresh at the origin until 2026-09-29, repo-4wb0e). Real values are slugs and ids; anything
 * else falls back to the default and the edge 308s it away.
 */
const FILTER_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:|~-]{0,63}$/;
const EDGE_ID = /^[^\s\p{Cc}]{1,256}$/u;
const DECADE = /^\d{3}0s$/;

function cleanSelectParam(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' || !FILTER_TOKEN.test(trimmed) ? 'all' : trimmed;
}

/** Human-readable labels (`near`, `find`): no control characters, single spaces, bounded length. */
function cleanLabelParam(raw: string | undefined, maxLength: number): string | undefined {
  const cleaned = (raw ?? '')
    .replace(/\p{Cc}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
  return cleaned ? cleaned : undefined;
}

function matchOrUndefined(raw: string | undefined, shape: RegExp): string | undefined {
  return raw && shape.test(raw) ? raw : undefined;
}

const LAYER_MODES: readonly ExploreLayerMode[] = ['off', 'presence', 'blackShare', 'blackChange'];

function isLayerMode(raw: string | undefined): raw is ExploreLayerMode {
  return raw !== undefined && (LAYER_MODES as readonly string[]).includes(raw);
}

function parseLayerMode(raw: RawExploreSearchParams): ExploreLayerMode {
  const layerModeRaw = firstValue(raw.layerMode)?.trim();
  if (isLayerMode(layerModeRaw)) return layerModeRaw;

  const densityRaw = firstValue(raw.density);
  if (densityRaw === '1' || densityRaw === 'true') return 'presence';
  // Explicit density=0 / false keeps the overlay off (legacy deep links).
  if (densityRaw === '0' || densityRaw === 'false') return 'off';

  // Default: no area shading. Record density by state is an opt-in layer, never the resting map:
  // a copper choropleth read as "where Black history happened" when it only says where the
  // archive has reached so far.
  return 'off';
}

export type { ExplorePopulationGeo } from './explore-population';

function parsePopulationDecadeRaw(
  raw: string | undefined,
  popGeoBase: ExplorePopulationGeo,
  fallback: string,
): string {
  const trimmed = raw?.trim();
  if (trimmed && isPopulationDecade(trimmed)) return trimmed;
  return parseExplorePopulationDecade(raw, popGeoBase, fallback);
}

/** Map-first default: instruments + records collapsed until the reader opens them. */
const DEFAULT_PANEL_VISIBILITY = {
  showFilters: false,
  showResults: false,
  showKey: false,
} as const;

/**
 * Panel chrome visibility. Read-only vocabulary: both forms parse so previously shared links
 * still open what they named, and neither is ever written back out.
 *
 * - Absent params → map-first (all collapsed).
 * - `panels=` opt-in list of open chrome (`filters`, `results`, `key`).
 * - Legacy `hidePanels=` (start open, hide listed) still parses for old shared links.
 */
function parsePanelVisibility(
  raw: RawExploreSearchParams,
): Pick<ExploreViewState, 'showFilters' | 'showResults' | 'showKey'> {
  const hidePanelsRaw = firstValue(raw.hidePanels)?.trim();
  const panelsRaw = firstValue(raw.panels)?.trim();

  // Legacy contract: start open, hide listed tokens.
  if (hidePanelsRaw) {
    let showFilters = true;
    let showResults = true;
    let showKey = true;
    for (const token of hidePanelsRaw.split(',')) {
      const trimmed = token.trim();
      if (trimmed === 'filters') showFilters = false;
      else if (trimmed === 'results') showResults = false;
      else if (trimmed === 'key') showKey = false;
    }
    return { showFilters, showResults, showKey };
  }

  // Opt-in open list (including `panels=` with no tokens → all closed).
  if (panelsRaw !== undefined) {
    const tokens = new Set(
      panelsRaw
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean),
    );
    return {
      showFilters: tokens.has('filters'),
      showResults: tokens.has('results'),
      showKey: tokens.has('key'),
    };
  }

  return { ...DEFAULT_PANEL_VISIBILITY };
}

const VALID_RADIUS_IDS = new Set<string>(EXPLORE_RADIUS_PRESETS.map((preset) => preset.id));

function parseRadius(raw: string | undefined): ExploreRadiusPresetId | undefined {
  const trimmed = raw?.trim();
  if (!trimmed || !VALID_RADIUS_IDS.has(trimmed)) return undefined;
  return trimmed as ExploreRadiusPresetId;
}

function parseNear(raw: string | undefined): string | undefined {
  return cleanLabelParam(raw, 80);
}

export function parseExploreSearchParams(raw: RawExploreSearchParams): ExploreViewState {
  // The shared filter model is parsed once, by the list's parser, so a value the list accepts
  // the map accepts and the reverse. `theme` and `floor` are the map's 4a spellings of `topic` and
  // `evidence`: still read, never written.
  const collection = parseRecordsQuery({
    q: raw.q,
    sort: raw.sort,
    kind: raw.kind,
    era: raw.era,
    state: raw.state,
    topic: raw.topic ?? raw.theme,
    status: raw.status,
    evidence: raw.evidence ?? raw.floor,
    selected: raw.selected,
    place: raw.place,
    collection: raw.collection,
    periodStart: raw.periodStart,
    periodEnd: raw.periodEnd,
    includeUndated: raw.includeUndated,
    layout: raw.layout,
    seed: raw.seed,
    page: raw.page,
  });
  const orAll = (value: string) => (value === '' ? 'all' : value);
  const filters: ExploreFilterState = {
    era: orAll(collection.era),
    kind: orAll(collection.kind),
    tone: cleanSelectParam(firstValue(raw.tone)),
    theme: orAll(collection.topic),
    status: orAll(collection.status),
    confidence: cleanSelectParam(firstValue(raw.confidence)),
  };

  const lat = parseFiniteNumber(firstValue(raw.lat));
  const lng = parseFiniteNumber(firstValue(raw.lng));
  const zoom = parseFiniteNumber(firstValue(raw.zoom));

  const selectedRaw = collection.selected;
  const stateRaw = collection.state;
  const placeRaw = collection.place;
  const satRaw = firstValue(raw.sat);
  const linesRaw = firstValue(raw.lines);
  const decadeRaw = matchOrUndefined(firstValue(raw.decade)?.trim(), DECADE);
  const edgeRaw = matchOrUndefined(firstValue(raw.edge)?.trim(), EDGE_ID);
  const floor = collection.evidence === '' ? undefined : (collection.evidence as EvidenceGrade);
  const layerMode = parseLayerMode(raw);
  const popGeoRaw = firstValue(raw.popGeo)?.trim();
  const popDecadeRaw = firstValue(raw.popDecade)?.trim();
  const popFromRaw = firstValue(raw.popFrom)?.trim();
  const popToRaw = firstValue(raw.popTo)?.trim();
  const radiusRaw = firstValue(raw.radius)?.trim();
  const nearRaw = firstValue(raw.near)?.trim();
  const findRaw = cleanLabelParam(firstValue(raw.find), 120);
  const collectionToken = collection.collection;
  const period = {
    start: collection.periodStart,
    end: collection.periodEnd,
    includeUndated: collection.includeUndated,
  };
  const chronologyLayout = collection.layout === 'chronology';

  const satOn = satRaw === '1' || satRaw === 'true';

  const popGeoBase = parseExplorePopulationGeo(popGeoRaw, DEFAULT_POPULATION_GEO);
  const popDecadeParsed =
    layerMode === 'blackShare'
      ? parsePopulationDecadeRaw(popDecadeRaw, popGeoBase, defaultPopulationDecade(popGeoBase))
      : undefined;
  const popFromParsed =
    layerMode === 'blackChange'
      ? parsePopulationDecadeRaw(popFromRaw, popGeoBase, defaultPopulationChangeFrom(popGeoBase))
      : undefined;
  const popToParsed =
    layerMode === 'blackChange'
      ? parsePopulationDecadeRaw(popToRaw, popGeoBase, defaultPopulationChangeTo(popGeoBase))
      : undefined;
  const popGeo =
    layerMode === 'blackShare' || layerMode === 'blackChange'
      ? coercePopulationGeoForDecade(
          popGeoBase,
          popDecadeParsed ?? popToParsed ?? popFromParsed ?? defaultPopulationDecade(popGeoBase),
        )
      : undefined;
  const popDecade =
    layerMode === 'blackShare' && popGeo
      ? parseExplorePopulationDecade(popDecadeRaw, popGeo, defaultPopulationDecade(popGeo))
      : undefined;
  const popFrom =
    layerMode === 'blackChange' && popGeo
      ? parseExplorePopulationDecade(popFromRaw, popGeo, defaultPopulationChangeFrom(popGeo))
      : undefined;
  const popTo =
    layerMode === 'blackChange' && popGeo
      ? parseExplorePopulationDecade(popToRaw, popGeo, defaultPopulationChangeTo(popGeo))
      : undefined;
  const { showFilters, showResults, showKey } = parsePanelVisibility(raw);
  const radius = parseRadius(radiusRaw);
  const near = parseNear(nearRaw);

  return {
    filters,
    ...(collection.q ? { query: collection.q } : {}),
    ...(collection.sort !== 'discovery' ? { sort: collection.sort } : {}),
    ...(lat !== undefined && lng !== undefined && zoom !== undefined
      ? { viewport: { lat, lng, zoom } }
      : {}),
    ...(selectedRaw ? { selected: selectedRaw } : {}),
    ...(stateRaw ? { state: stateRaw } : {}),
    ...(placeRaw ? { place: placeRaw } : {}),
    layerMode,
    ...(popGeo ? { popGeo } : {}),
    ...(popDecade ? { popDecade } : {}),
    ...(popFrom ? { popFrom } : {}),
    ...(popTo ? { popTo } : {}),
    sat: satOn,
    lines: linesRaw === '1' || linesRaw === 'true',
    ...(decadeRaw ? { decade: decadeRaw } : {}),
    ...(edgeRaw ? { edge: edgeRaw } : {}),
    showFilters,
    showResults,
    showKey,
    ...(radius ? { radius } : {}),
    ...(near ? { near } : {}),
    ...(floor ? { floor } : {}),
    ...(findRaw ? { find: findRaw } : {}),
    ...(collectionToken !== '' ? { collection: collectionToken } : {}),
    ...(period.start !== '' ? { periodStart: period.start } : {}),
    ...(period.end !== '' ? { periodEnd: period.end } : {}),
    ...(period.includeUndated ? { includeUndated: true } : {}),
    ...(chronologyLayout ? { layout: 'chronology' as const } : {}),
    ...(collection.seed ? { seed: collection.seed } : {}),
    ...(collection.page > 1 ? { page: collection.page } : {}),
  };
}

/** Builds the map view's query string (no leading `/archive?`), `view=map` first, so callers can
 * compose full hrefs or push it via `history.replaceState` without a full navigation. */
export function buildExploreSearchParams(state: ExploreViewState): string {
  const params = new URLSearchParams();
  params.set('view', 'map');
  if (state.query) params.set('q', state.query);
  if (state.sort && state.sort !== 'discovery') params.set('sort', state.sort);
  if (state.filters.era !== DEFAULT_EXPLORE_FILTERS.era) params.set('era', state.filters.era);
  if (state.filters.kind !== DEFAULT_EXPLORE_FILTERS.kind) params.set('kind', state.filters.kind);
  if (state.filters.tone !== DEFAULT_EXPLORE_FILTERS.tone) params.set('tone', state.filters.tone);
  if (state.filters.theme !== DEFAULT_EXPLORE_FILTERS.theme)
    params.set('topic', state.filters.theme);
  if (state.filters.status !== DEFAULT_EXPLORE_FILTERS.status)
    params.set('status', state.filters.status);
  if (state.filters.confidence !== DEFAULT_EXPLORE_FILTERS.confidence) {
    params.set('confidence', state.filters.confidence);
  }
  if (state.viewport) {
    params.set('lat', state.viewport.lat.toFixed(4));
    params.set('lng', state.viewport.lng.toFixed(4));
    params.set('zoom', state.viewport.zoom.toFixed(2));
  }
  if (state.selected) params.set('selected', state.selected);
  if (state.state) params.set('state', state.state);
  if (state.place) params.set('place', state.place);
  if (state.layerMode !== 'off') params.set('layerMode', state.layerMode);
  if (
    (state.layerMode === 'blackShare' || state.layerMode === 'blackChange') &&
    state.popGeo &&
    state.popGeo !== DEFAULT_POPULATION_GEO
  ) {
    params.set('popGeo', state.popGeo);
  }
  if (state.layerMode === 'blackShare' && state.popDecade && state.popGeo) {
    const defaultDecade = defaultPopulationDecade(state.popGeo);
    if (state.popDecade !== defaultDecade) {
      params.set('popDecade', state.popDecade);
    }
  }
  if (state.layerMode === 'blackChange' && state.popFrom && state.popGeo) {
    const defaultFrom = defaultPopulationChangeFrom(state.popGeo);
    if (state.popFrom !== defaultFrom) {
      params.set('popFrom', state.popFrom);
    }
  }
  if (state.layerMode === 'blackChange' && state.popTo && state.popGeo) {
    const defaultTo = defaultPopulationChangeTo(state.popGeo);
    if (state.popTo !== defaultTo) {
      params.set('popTo', state.popTo);
    }
  }
  if (state.sat) params.set('sat', '1');
  if (state.lines) params.set('lines', '1');
  if (state.decade) params.set('decade', state.decade);
  if (state.edge) params.set('edge', state.edge);
  // Panel chrome (`showFilters` / `showResults` / `showKey`) is deliberately not serialized.
  // Which panels a reader has open is session state, not shareable meaning. It is the same class
  // of thing as the camera that `EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS` keeps out of the address,
  // for the same reason. Inbound `panels=` and `hidePanels=` still parse; they never round-trip.
  if (state.radius && state.radius !== 'all') params.set('radius', state.radius);
  if (state.near) params.set('near', state.near);
  if (state.floor) params.set('evidence', state.floor);
  if (state.find) params.set('find', state.find);
  if (state.collection) params.set('collection', state.collection);
  // Re-normalized so reversed bounds and a redundant `includeUndated` have one spelling.
  const period = normalizePeriod({
    start: state.periodStart,
    end: state.periodEnd,
    includeUndated: state.includeUndated,
  });
  if (period.start !== '') params.set('periodStart', period.start);
  if (period.end !== '') params.set('periodEnd', period.end);
  if (period.includeUndated) params.set('includeUndated', '1');
  if (state.layout === 'chronology') params.set('layout', 'chronology');
  if (state.seed) params.set('seed', state.seed);
  if (state.page && state.page > 1) params.set('page', String(state.page));
  return params.toString();
}

/** The map view's address: `/archive?view=map` and the filter set. Never a camera. */
export function buildExploreHref(state: ExploreViewState): string {
  return `/archive?${buildExploreSearchParams(state)}`;
}

/**
 * The one hand-off from a record to the map: `/explore?selected=<id>`. Explore frames the record
 * through the same `frameRecord` contract a click uses, at the zoom its precision allows.
 */
export function exploreRecordHref(entityId: string): string {
  return buildExploreHref({
    filters: DEFAULT_EXPLORE_FILTERS,
    ...defaultExploreOverlayState(),
    selected: entityId,
  });
}

/** Default overlay + toggle state for callers building explore links without a full view model. */
export function defaultExploreOverlayState(): Pick<
  ExploreViewState,
  'layerMode' | 'sat' | 'lines' | 'showFilters' | 'showResults' | 'showKey'
> {
  return {
    layerMode: 'off',
    sat: false,
    lines: false,
    ...DEFAULT_PANEL_VISIBILITY,
  };
}

/**
 * The `state`-tier camera target for a US postal code: the state's bounding-box midpoint (see
 * `@repo/domain`'s `US_STATES`, the same coarse bbox posture used everywhere else this codebase
 * attributes a point to a state; `docs/decisions-carryover.md`, "Map stack": known gaps) at a
 * zoom close enough to read individual pins. Alaska/Hawaii pull back to a wider zoom so their
 * bbox — which spans far more longitude than the Lower 48 states — doesn't clip at the map's
 * `minZoom`.
 *
 * Shared by the homepage hero (: flies here before/while pushing to `/explore?state=…`)
 * and `/explore` itself (state-shape clicks, deep links), so both surfaces fly to the exact same
 * frame for the same state — one source of truth, not two independently-tuned camera targets.
 */
export function viewportForState(postalCode: string): ExploreViewport | undefined {
  const state = findUsStateByPostalCode(postalCode);
  if (!state) return undefined;
  const [west, south, east, north] = state.bbox;
  return {
    lng: (west + east) / 2,
    lat: (south + north) / 2,
    zoom: postalCode === 'AK' || postalCode === 'HI' ? 4.5 : 6.2,
  };
}

/** The `national`-tier resting camera target: the continental US bounds' midpoint, at a zoom
 * that keeps the whole frame roughly in view. `MapStage.flyPreset('national', …)` prefers
 * resolving the `national` preset directly from `US_CONUS_BOUNDS` (via `cameraForBounds`, which
 * accounts for the live canvas's actual aspect ratio); this fixed-zoom fallback exists for
 * non-map-instance callers (e.g. computing an href, or a viewport before the canvas exists). */
export function nationalViewport(): ExploreViewport {
  const [west, south, east, north] = US_CONUS_BOUNDS;
  return { lng: (west + east) / 2, lat: (south + north) / 2, zoom: 3.4 };
}

export function isPopulationLayerMode(
  layerMode: ExploreLayerMode,
): layerMode is 'blackShare' | 'blackChange' {
  return layerMode === 'blackShare' || layerMode === 'blackChange';
}

export function isPresenceLayerMode(layerMode: ExploreLayerMode): boolean {
  return layerMode === 'presence';
}

export function isLayerOverlayActive(layerMode: ExploreLayerMode): boolean {
  return layerMode !== 'off';
}
