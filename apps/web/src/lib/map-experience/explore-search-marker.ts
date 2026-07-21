/**
 * HTML marker for explore place-search center — a copper orientation pin distinct
 * from entity record discs. MapStage mounts this via MapLibre `Marker` with
 * `anchor: 'bottom'` so the stem tip sits on the geocode.
 */
import { brandPalette } from '@repo/ui';

export type ExploreSearchCenterMarkerInput = {
  readonly lng: number;
  readonly lat: number;
  readonly label?: string;
};

/** Stable class for diagnostics; styles are inline (map-surfaces owns entity markers). */
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
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.pointerEvents = 'none';
  el.style.width = '1.125rem';

  const head = document.createElement('div');
  head.style.width = '0.875rem';
  head.style.height = '0.875rem';
  head.style.borderRadius = '50%';
  head.style.background = brandPalette.copperPin;
  head.style.border = `2px solid ${brandPalette.archivePaper}`;
  head.style.boxSizing = 'border-box';

  const stem = document.createElement('div');
  stem.style.width = '2px';
  stem.style.height = '0.625rem';
  stem.style.background = brandPalette.copperPin;
  stem.style.marginTop = '-1px';

  el.append(head, stem);
  return el;
}
