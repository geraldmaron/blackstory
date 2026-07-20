/**
 * Shareable URL state for `/explore`: filters + selected entity + map layer model
 * + optional point grouping + selected state + optional relationship lines decade
 * selected edge. Pure parse/serialize so the server-rendered page and the client
 * orchestrator read and write the exact same shape.
 *
 * Camera (`lat`/`lng`/`zoom`): parsed for inbound deep links (e.g. locate → explore with a
 * place radius). The explore client does not continuously sync the live camera into the
 * address bar; pan/zoom stay in-memory. Serialize still emits viewport when a caller builds
 * an intentional deep link (`buildLocateExploreHref`).
 *
 * Panel chrome: map-first by default (filters / color key / records collapsed). Open panels
 * serialize as opt-in `panels=filters,results,key`. Legacy `hidePanels=` still parses.
 *
 * Selection note: `selected` opens the preview narrative card and orients the copper ring on
 * the map (e.g. “View on map” from a record page). The full record is reached via the card
 * CTA at `/entity/[id]`, not by pin/list selection alone.
 */
import {
  DEFAULT_POPULATION_CHANGE_FROM,
  DEFAULT_POPULATION_CHANGE_TO,
  DEFAULT_POPULATION_DECADE,
  isCensusPopulationDecade,
  type CensusPopulationDecade,
} from '@repo/domain/map/county-population';
import { findUsStateByPostalCode, US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { DEFAULT_EXPLORE_FILTERS, type ExploreFilterState } from './filters';
import { EXPLORE_RADIUS_PRESETS, type ExploreRadiusPresetId } from './explore-place-radius';

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
  readonly viewport?: ExploreViewport;
  readonly selected?: string;
  /** USPS state DC postal code when a state shape is selected on the map.  */
  readonly state?: string;
  /** Map overlay model — `off` hides all choropleth/density fills. */
  readonly layerMode: ExploreLayerMode;
  /** Decennial vintage for `blackShare` (2000 | 2010 | 2020). */
  readonly popDecade?: CensusPopulationDecade;
  /** From-decade for `blackChange` (default 2010). */
  readonly popFrom?: CensusPopulationDecade;
  /** To-decade for `blackChange` (default 2020). */
  readonly popTo?: CensusPopulationDecade;
  /**
   * When true, nearby points aggregate while zoomed out (opt-in via `group=1`). Omitted from
   * shareable URLs when off (the default).
   */
  readonly group: boolean;
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
};

export type RawExploreSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

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

function cleanSelectParam(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
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

  // Default: Record presence — entity pins always paint; this shades geography by
  // documented-record count so the map opens with archive presence visible.
  return 'presence';
}

function parsePopulationDecade(
  raw: string | undefined,
  fallback: CensusPopulationDecade,
): CensusPopulationDecade {
  const trimmed = raw?.trim();
  return trimmed && isCensusPopulationDecade(trimmed) ? trimmed : fallback;
}

type PanelToken = 'filters' | 'results' | 'key';

/** Map-first default: instruments + records collapsed until the reader opens them. */
const DEFAULT_PANEL_VISIBILITY = {
  showFilters: false,
  showResults: false,
  showKey: false,
} as const;

/**
 * Panel chrome visibility.
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

function serializeOpenPanels(state: ExploreViewState): string | undefined {
  const tokens: PanelToken[] = [];
  if (state.showFilters) tokens.push('filters');
  if (state.showResults) tokens.push('results');
  if (state.showKey) tokens.push('key');
  return tokens.length > 0 ? tokens.join(',') : undefined;
}

const VALID_RADIUS_IDS = new Set<string>(EXPLORE_RADIUS_PRESETS.map((preset) => preset.id));

function parseRadius(raw: string | undefined): ExploreRadiusPresetId | undefined {
  const trimmed = raw?.trim();
  if (!trimmed || !VALID_RADIUS_IDS.has(trimmed)) return undefined;
  return trimmed as ExploreRadiusPresetId;
}

function parseNear(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseExploreSearchParams(raw: RawExploreSearchParams): ExploreViewState {
  const filters: ExploreFilterState = {
    era: cleanSelectParam(firstValue(raw.era)),
    kind: cleanSelectParam(firstValue(raw.kind)),
    theme: cleanSelectParam(firstValue(raw.theme)),
    confidence: cleanSelectParam(firstValue(raw.confidence)),
  };

  const lat = parseFiniteNumber(firstValue(raw.lat));
  const lng = parseFiniteNumber(firstValue(raw.lng));
  const zoom = parseFiniteNumber(firstValue(raw.zoom));

  const selectedRaw = firstValue(raw.selected)?.trim();
  const stateRaw = firstValue(raw.state)?.trim().toUpperCase();
  const groupRaw = firstValue(raw.group);
  const linesRaw = firstValue(raw.lines);
  const decadeRaw = firstValue(raw.decade)?.trim();
  const edgeRaw = firstValue(raw.edge)?.trim();
  const layerMode = parseLayerMode(raw);
  const popDecadeRaw = firstValue(raw.popDecade)?.trim();
  const popFromRaw = firstValue(raw.popFrom)?.trim();
  const popToRaw = firstValue(raw.popTo)?.trim();
  const radiusRaw = firstValue(raw.radius)?.trim();
  const nearRaw = firstValue(raw.near)?.trim();

  const groupOn = groupRaw === '1' || groupRaw === 'true';

  const popDecade =
    layerMode === 'blackShare'
      ? parsePopulationDecade(popDecadeRaw, DEFAULT_POPULATION_DECADE)
      : undefined;
  const popFrom =
    layerMode === 'blackChange'
      ? parsePopulationDecade(popFromRaw, DEFAULT_POPULATION_CHANGE_FROM)
      : undefined;
  const popTo =
    layerMode === 'blackChange'
      ? parsePopulationDecade(popToRaw, DEFAULT_POPULATION_CHANGE_TO)
      : undefined;
  const { showFilters, showResults, showKey } = parsePanelVisibility(raw);
  const radius = parseRadius(radiusRaw);
  const near = parseNear(nearRaw);

  return {
    filters,
    ...(lat !== undefined && lng !== undefined && zoom !== undefined
      ? { viewport: { lat, lng, zoom } }
      : {}),
    ...(selectedRaw ? { selected: selectedRaw } : {}),
    ...(stateRaw && stateRaw !== 'ALL' ? { state: stateRaw } : {}),
    layerMode,
    ...(popDecade ? { popDecade } : {}),
    ...(popFrom ? { popFrom } : {}),
    ...(popTo ? { popTo } : {}),
    group: groupOn,
    lines: linesRaw === '1' || linesRaw === 'true',
    ...(decadeRaw ? { decade: decadeRaw } : {}),
    ...(edgeRaw ? { edge: edgeRaw } : {}),
    showFilters,
    showResults,
    showKey,
    ...(radius ? { radius } : {}),
    ...(near ? { near } : {}),
  };
}

/** Builds a plain `?...` query string (no leading `/explore`) so callers can compose full hrefs
 * or push it via `history.replaceState` without a full navigation. */
export function buildExploreSearchParams(state: ExploreViewState): string {
  const params = new URLSearchParams();
  if (state.filters.era !== DEFAULT_EXPLORE_FILTERS.era) params.set('era', state.filters.era);
  if (state.filters.kind !== DEFAULT_EXPLORE_FILTERS.kind) params.set('kind', state.filters.kind);
  if (state.filters.theme !== DEFAULT_EXPLORE_FILTERS.theme)
    params.set('theme', state.filters.theme);
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
  if (state.layerMode !== 'presence') params.set('layerMode', state.layerMode);
  if (
    state.layerMode === 'blackShare' &&
    state.popDecade &&
    state.popDecade !== DEFAULT_POPULATION_DECADE
  ) {
    params.set('popDecade', state.popDecade);
  }
  if (
    state.layerMode === 'blackChange' &&
    state.popFrom &&
    state.popFrom !== DEFAULT_POPULATION_CHANGE_FROM
  ) {
    params.set('popFrom', state.popFrom);
  }
  if (
    state.layerMode === 'blackChange' &&
    state.popTo &&
    state.popTo !== DEFAULT_POPULATION_CHANGE_TO
  ) {
    params.set('popTo', state.popTo);
  }
  if (state.group) params.set('group', '1');
  if (state.lines) params.set('lines', '1');
  if (state.decade) params.set('decade', state.decade);
  if (state.edge) params.set('edge', state.edge);
  const panels = serializeOpenPanels(state);
  if (panels) params.set('panels', panels);
  if (state.radius && state.radius !== 'all') params.set('radius', state.radius);
  if (state.near) params.set('near', state.near);
  return params.toString();
}

export function buildExploreHref(state: ExploreViewState): string {
  const qs = buildExploreSearchParams(state);
  return qs ? `/explore?${qs}` : '/explore';
}

/** Default overlay + toggle state for callers building explore links without a full view model. */
export function defaultExploreOverlayState(): Pick<
  ExploreViewState,
  'layerMode' | 'group' | 'lines' | 'showFilters' | 'showResults' | 'showKey'
> {
  return {
    layerMode: 'presence',
    group: false,
    lines: false,
    ...DEFAULT_PANEL_VISIBILITY,
  };
}

/**
 * The `state`-tier camera target for a US postal code: the state's bounding-box midpoint (see
 * `@repo/domain`'s `US_STATES`, the same coarse bbox posture used everywhere else this
 * codebase attributes a point to a state — ADR-013 "known gaps") at a zoom close enough to read
 * individual pins. Alaska/Hawaii pull back to a wider zoom so their bbox — which spans far more
 * longitude than the Lower 48 states — doesn't clip at the map's `minZoom`.
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
