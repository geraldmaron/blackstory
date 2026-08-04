import type { Marker } from 'maplibre-gl';
import { brandPalette } from '@repo/ui';
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
  el.classList.toggle('ds-map-entity-marker--selected', isSelected);
  if (el.getAttribute('aria-label') !== label) {
    el.setAttribute('aria-label', label);
    el.title = label;
  }
  // Mirror the GL circle kind shade so the hit-target disc matches KindBadge / explore-point
  // (transparent overlays previously left only the sand halo readable as "the" circle color).
  const shade =
    typeof feature.properties.shade === 'string' && feature.properties.shade.length > 0
      ? feature.properties.shade
      : brandPalette.copperPin;
  if (el.style.getPropertyValue('--ds-map-entity-shade') !== shade) {
    el.style.setProperty('--ds-map-entity-shade', shade);
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
  }
}
