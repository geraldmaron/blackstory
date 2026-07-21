/**
 * HTML marker for explore place-search center — a copper orientation pin distinct
 * from entity record discs. MapStage mounts this via MapLibre `Marker` with
 * `anchor: 'bottom'` so the stem tip sits on the geocode. Visuals live in
 * `map-surfaces.css` (token-driven, same path as entity markers).
 */

export type ExploreSearchCenterMarkerInput = {
  readonly lng: number;
  readonly lat: number;
  readonly label?: string;
};

/** Stable class; styles in map-surfaces.css under `.ds-map-search-center-marker`. */
export const EXPLORE_SEARCH_CENTER_MARKER_CLASS = 'ds-map-search-center-marker';

const DEFAULT_PLACE_LABEL = 'Search center';

/** Accessible name for the non-interactive orientation pin. */
export function exploreSearchCenterMarkerLabel(label?: string): string {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_PLACE_LABEL;
}

/**
 * Builds the MapLibre marker element. Browser-only (`document.createElement`).
 * The map canvas is `aria-hidden`; this label supports devtools / parity only.
 */
export function buildExploreSearchCenterMarkerElement(label?: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = EXPLORE_SEARCH_CENTER_MARKER_CLASS;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', exploreSearchCenterMarkerLabel(label));
  el.tabIndex = -1;

  const head = document.createElement('span');
  head.className = 'ds-map-search-center-marker__head';
  head.setAttribute('aria-hidden', 'true');

  const stem = document.createElement('span');
  stem.className = 'ds-map-search-center-marker__stem';
  stem.setAttribute('aria-hidden', 'true');

  el.append(head, stem);
  return el;
}
