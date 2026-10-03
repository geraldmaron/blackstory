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
  /**
   * `place` (default): the copper stem pin for a searched address.
   * `user`: the reader's own position — a haloed dot, the convention every maps app shares, so it
   * can never be mistaken for a record.
   */
  readonly variant?: 'place' | 'user';
};

/** Stable class; styles in shell.css under `.ds-map-search-center-marker`. */
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
export function buildExploreSearchCenterMarkerElement(
  label?: string,
  variant: 'place' | 'user' = 'place',
): HTMLDivElement {
  const el = document.createElement('div');
  if (variant === 'user') {
    el.className = `${EXPLORE_SEARCH_CENTER_MARKER_CLASS} ${EXPLORE_SEARCH_CENTER_MARKER_CLASS}--user`;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', exploreSearchCenterMarkerLabel(label ?? 'Your location'));
    el.tabIndex = -1;
    const pulse = document.createElement('span');
    pulse.className = 'ds-map-search-center-marker__pulse';
    pulse.setAttribute('aria-hidden', 'true');
    const dot = document.createElement('span');
    dot.className = 'ds-map-search-center-marker__dot';
    dot.setAttribute('aria-hidden', 'true');
    el.append(pulse, dot);
    return el;
  }
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
