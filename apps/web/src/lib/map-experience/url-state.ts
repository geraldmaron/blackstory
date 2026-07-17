/**
 * Shareable URL state for `/explore`: viewport + filters + selected entity + density
 * toggle + selected state + optional relationship lines decade selected edge. Pure
 * parse/serialize so the server-rendered page and the client orchestrator read and write the
 * exact same shape.
 */
import { DEFAULT_EXPLORE_FILTERS, type ExploreFilterState } from './filters';

export type ExploreViewport = {
  readonly lat: number;
  readonly lng: number;
  readonly zoom: number;
};

export type ExploreViewState = {
  readonly filters: ExploreFilterState;
  readonly viewport?: ExploreViewport;
  readonly selected?: string;
  /** USPS state DC postal code when a state shape is selected on the map.  */
  readonly state?: string;
  readonly density: boolean;
  /** Draw evidence-backed History relationship lines between entity anchors.  */
  readonly lines: boolean;
  /** When set with lines, filter edges to this decade slice (e.g. `1950s`).  */
  readonly decade?: string;
  /** Selected History edge id when a relationship line is clicked.  */
  readonly edge?: string;
};

export type RawExploreSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

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
  const densityRaw = firstValue(raw.density);
  const linesRaw = firstValue(raw.lines);
  const decadeRaw = firstValue(raw.decade)?.trim();
  const edgeRaw = firstValue(raw.edge)?.trim();

  return {
    filters,
    ...(lat !== undefined && lng !== undefined && zoom !== undefined
      ? { viewport: { lat, lng, zoom } }
      : {}),
    ...(selectedRaw ? { selected: selectedRaw } : {}),
    ...(stateRaw && stateRaw !== 'ALL' ? { state: stateRaw } : {}),
    density: densityRaw === '1' || densityRaw === 'true',
    lines: linesRaw === '1' || linesRaw === 'true',
    ...(decadeRaw ? { decade: decadeRaw } : {}),
    ...(edgeRaw ? { edge: edgeRaw } : {}),
  };
}

/** Builds a plain `?...` query string (no leading `/explore`) so callers can compose full hrefs
 * or push it via `history.replaceState` without a full navigation. */
export function buildExploreSearchParams(state: ExploreViewState): string {
  const params = new URLSearchParams();
  if (state.filters.era !== DEFAULT_EXPLORE_FILTERS.era) params.set('era', state.filters.era);
  if (state.filters.kind !== DEFAULT_EXPLORE_FILTERS.kind) params.set('kind', state.filters.kind);
  if (state.filters.theme !== DEFAULT_EXPLORE_FILTERS.theme) params.set('theme', state.filters.theme);
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
  if (state.density) params.set('density', '1');
  if (state.lines) params.set('lines', '1');
  if (state.decade) params.set('decade', state.decade);
  if (state.edge) params.set('edge', state.edge);
  return params.toString();
}

export function buildExploreHref(state: ExploreViewState): string {
  const qs = buildExploreSearchParams(state);
  return qs ? `/explore?${qs}` : '/explore';
}
