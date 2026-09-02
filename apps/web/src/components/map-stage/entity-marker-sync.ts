import type { Marker } from 'maplibre-gl';
import type { ExploreMapFeatureCollection } from '../../lib/map-experience/build-explore-map-source';

export function clearMarkers(markers: Marker[]): void {
  for (const marker of markers) marker.remove();
  markers.length = 0;
}
/** Marker element paint shared by create + in-place update — kept idempotent so a keyed
 * reuse never resets classes/animations on markers whose feature did not change. */
export function applyEntityMarkerElementProps(
  el: HTMLButtonElement,
  feature: ExploreMapFeatureCollection['features'][number],
  label: string,
  isSelected: boolean,
): void {
  el.classList.add('ds-first-paint-pin', 'ds-first-paint-pin--link');
  el.classList.toggle('ds-first-paint-pin--walk', feature.properties.holdingWalk === true);
  el.classList.toggle('ds-first-paint-pin--focus', isSelected);
  el.classList.toggle('ds-map-entity-marker--selected', isSelected);
  if (el.getAttribute('aria-label') !== label) {
    el.setAttribute('aria-label', label);
    el.title = label;
  }
  if (el.dataset.kind !== feature.properties.kind) {
    el.dataset.kind = feature.properties.kind;
  }
  if (typeof feature.properties.mapTone === 'string') {
    if (el.dataset.mapTone !== feature.properties.mapTone) {
      el.dataset.mapTone = feature.properties.mapTone;
    }
  } else if (el.dataset.mapTone !== undefined) {
    delete el.dataset.mapTone;
  }
}
export function markerLabelFor(feature: ExploreMapFeatureCollection['features'][number]): string {
  return typeof feature.properties.displayName === 'string'
    ? feature.properties.displayName
    : 'Documented record';
}
/** Toggles the selected pulse class without rebuilding every marker. */
export function syncSelectedEntityMarkerClass(
  markers: readonly Marker[],
  selectedEntityId: string | undefined,
): void {
  for (const marker of markers) {
    const el = marker.getElement();
    const isSelected =
      selectedEntityId !== undefined &&
      selectedEntityId.length > 0 &&
      el.dataset.entityId === selectedEntityId;
    el.classList.toggle('ds-map-entity-marker--selected', isSelected);
    el.classList.toggle('ds-first-paint-pin--focus', isSelected);
  }
}
