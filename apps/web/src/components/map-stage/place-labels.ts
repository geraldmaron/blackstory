/**
 * Place tokens and site names in the house type (`docs/ui/patterns-place-map.md`, "Visual").
 *
 * Map glyphs cannot set Schibsted or Geist Mono, so the plate's names are DOM. MapLibre still does
 * the cartography: invisible symbol layers place every count (always) and every name (when it fits),
 * and this layer prints exactly what they placed, at the same anchor, every frame. Hit testing stays
 * on the map layers too, so the labels never take a pointer event.
 */
import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';
import {
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_PLACE_NAME_LAYER_ID,
  EXPLORE_SITE_NAME_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import { PLACE_STATE_NAME_MIN_ZOOM } from '../../app/map/explore-style';

/** The name a token prints at a zoom: the same rule as the style's `PLACE_NAME_TEXT`. */
export function placeLabelText(
  properties: { readonly level?: unknown; readonly mapName?: unknown; readonly postal?: unknown },
  zoom: number,
): string {
  const name = typeof properties.mapName === 'string' ? properties.mapName : '';
  if (properties.level === 'state') {
    const postal = typeof properties.postal === 'string' ? properties.postal : '';
    return zoom < PLACE_STATE_NAME_MIN_ZOOM && postal ? postal : name;
  }
  return name;
}

type TokenLabel = {
  readonly root: HTMLElement;
  readonly count: HTMLElement;
  readonly name: HTMLElement;
};

function buildToken(level: string, tier: string): TokenLabel {
  const root = document.createElement('div');
  root.className = 'ds-place-token';
  root.dataset.level = level;
  root.dataset.tier = tier;
  const count = document.createElement('span');
  count.className = 'ds-place-token__count';
  const name = document.createElement('span');
  name.className = 'ds-place-token__name';
  root.append(count, name);
  return { root, count, name };
}

function buildSite(name: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'ds-site-name';
  root.textContent = name;
  return root;
}

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

function pointOf(feature: MapGeoJSONFeature): [number, number] | undefined {
  return feature.geometry.type === 'Point'
    ? (feature.geometry.coordinates as [number, number])
    : undefined;
}

export type PlaceLabelsHandle = {
  /** The token under the pointer, drawn in its hover state. */
  readonly setHovered: (placeKey: string | undefined) => void;
  /** The selected record: its name is on the selection flag, so its plate name steps aside. */
  readonly setSelected: (entityId: string | undefined) => void;
  readonly dispose: () => void;
};

export function bindPlaceLabels(map: MapLibreMap): PlaceLabelsHandle {
  const layer = document.createElement('div');
  layer.className = 'ds-place-labels';
  layer.setAttribute('aria-hidden', 'true');
  map.getCanvasContainer().appendChild(layer);

  const tokens = new Map<string, TokenLabel>();
  const sites = new Map<string, HTMLElement>();
  let hovered: string | undefined;
  let pressed = false;
  let selected: string | undefined;
  let frame = 0;

  const query = (layerId: string) =>
    map.getLayer(layerId) ? map.queryRenderedFeatures({ layers: [layerId] }) : [];

  function update(): void {
    frame = 0;
    const zoom = map.getZoom();
    const named = new Set<string>();
    for (const feature of query(EXPLORE_PLACE_NAME_LAYER_ID)) {
      const key = feature.properties?.placeKey;
      if (typeof key === 'string') named.add(key);
    }

    const seenTokens = new Set<string>();
    for (const feature of query(EXPLORE_CLUSTER_COUNT_LAYER_ID)) {
      const props = feature.properties ?? {};
      const key = props.placeKey;
      const at = pointOf(feature);
      if (typeof key !== 'string' || seenTokens.has(key) || !at) continue;
      seenTokens.add(key);
      let token = tokens.get(key);
      if (!token) {
        token = buildToken(String(props.level ?? ''), String(props.tier ?? 0));
        tokens.set(key, token);
        layer.append(token.root);
      }
      const count = String(props.point_count_abbreviated ?? '');
      if (token.count.textContent !== count) {
        token.count.textContent = count;
        token.root.style.setProperty('--ds-place-digits', String(count.length));
      }
      setText(token.name, placeLabelText(props, zoom));
      token.root.classList.toggle('is-named', named.has(key));
      token.root.classList.toggle('is-hovered', key === hovered);
      token.root.classList.toggle('is-pressed', key === hovered && pressed);
      const { x, y } = map.project(at);
      token.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
    for (const [key, token] of tokens) {
      if (seenTokens.has(key)) continue;
      token.root.remove();
      tokens.delete(key);
    }

    const seenSites = new Set<string>();
    for (const feature of query(EXPLORE_SITE_NAME_LAYER_ID)) {
      const props = feature.properties ?? {};
      const id = props.entityId;
      const at = pointOf(feature);
      if (typeof id !== 'string' || id === selected || seenSites.has(id) || !at) continue;
      seenSites.add(id);
      let site = sites.get(id);
      if (!site) {
        site = buildSite(String(props.displayName ?? ''));
        sites.set(id, site);
        layer.append(site);
      }
      const { x, y } = map.project(at);
      site.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
    for (const [id, site] of sites) {
      if (seenSites.has(id)) continue;
      site.remove();
      sites.delete(id);
    }
  }

  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(update);
  };
  const press = () => {
    if (!hovered) return;
    pressed = true;
    schedule();
  };
  const release = () => {
    if (!pressed) return;
    pressed = false;
    schedule();
  };
  // Once the camera moves the token is no longer under the pointer; the next mousemove re-hits.
  const settle = () => {
    pressed = false;
    hovered = undefined;
    schedule();
  };
  map.on('render', schedule);
  map.on('mousedown', press);
  map.on('mouseup', release);
  map.on('movestart', settle);
  schedule();

  return {
    setHovered(placeKey) {
      if (placeKey === hovered) return;
      hovered = placeKey;
      if (!placeKey) pressed = false;
      schedule();
    },
    setSelected(entityId) {
      if (entityId === selected) return;
      selected = entityId;
      schedule();
    },
    dispose() {
      if (frame !== 0) cancelAnimationFrame(frame);
      map.off('render', schedule);
      map.off('mousedown', press);
      map.off('mouseup', release);
      map.off('movestart', settle);
      layer.remove();
      tokens.clear();
      sites.clear();
    },
  };
}

/**
 * One record's name beside its pin, for a map that holds a single record (the `RecordMap` embed).
 * The same DOM label the plate prints from street scale (`ds-site-name`), but at any zoom: an embed
 * frames closer than the plate's own name layer places. Returns its disposer.
 */
export function bindRecordName(
  map: MapLibreMap,
  at: readonly [number, number],
  name: string,
): () => void {
  const layer = document.createElement('div');
  layer.className = 'ds-place-labels';
  layer.setAttribute('aria-hidden', 'true');
  const label = buildSite(name);
  layer.append(label);
  map.getCanvasContainer().appendChild(layer);
  const place = () => {
    const { x, y } = map.project([at[0], at[1]]);
    label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };
  place();
  map.on('render', place);
  return () => {
    map.off('render', place);
    layer.remove();
  };
}
