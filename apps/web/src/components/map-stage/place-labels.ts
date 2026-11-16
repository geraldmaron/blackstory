/**
 * Place tokens and site names in the house type (`docs/ui/patterns-place-map.md`, "Visual").
 *
 * Map glyphs cannot set Schibsted or Geist Mono, so the plate's names are DOM. MapLibre still does
 * the cartography: invisible symbol layers place every count (always) and every name (when it fits).
 * Counts are always drawn, so they can stack; this layer runs a collision pass over the projected
 * anchors (`token-layout.ts`) and moves a colliding numeral to free space with a tether back to its
 * anchor. Hit testing stays on the map's anchor circle; only a displaced numeral takes a pointer
 * (a click re-fires at its anchor), so the target never lies about which place it opens.
 */
import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';
import { queryRenderedLayers } from './query-rendered';
import {
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_PLACE_NAME_LAYER_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_SITE_NAME_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import {
  COUNT_DIGIT_EM,
  MAP_TYPE,
  NAME_TRACKING_EM,
  PLACE_STATE_NAME_MIN_ZOOM,
} from '../../app/map/explore-style';
import { layoutTokens, markBox, type Box, type TokenInput } from './token-layout';

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

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A displaced numeral's tether: a hairline from the numeral to a dot on the true anchor. */
function buildLeader(): { g: SVGGElement; line: SVGLineElement; dot: SVGCircleElement } {
  const g = document.createElementNS(SVG_NS, 'g');
  const line = document.createElementNS(SVG_NS, 'line');
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('r', '2');
  g.append(line, dot);
  return { g, line, dot };
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
  /** The selected record: its name is on the callout, so its plate name steps aside. */
  readonly setSelected: (entityId: string | undefined) => void;
  readonly dispose: () => void;
};

export function bindPlaceLabels(map: MapLibreMap): PlaceLabelsHandle {
  const layer = document.createElement('div');
  layer.className = 'ds-place-labels';
  layer.setAttribute('aria-hidden', 'true');
  map.getCanvasContainer().appendChild(layer);
  const tethers = document.createElementNS(SVG_NS, 'svg');
  tethers.setAttribute('class', 'ds-place-leaders');
  layer.append(tethers);

  const tokens = new Map<string, TokenLabel>();
  const leaders = new Map<string, ReturnType<typeof buildLeader>>();
  const tokenAnchors = new Map<string, [number, number]>();
  const sites = new Map<string, HTMLElement>();
  let hovered: string | undefined;
  let pressed = false;
  let selected: string | undefined;
  let frame = 0;

  const query = (layerId: string) =>
    queryRenderedLayers<MapGeoJSONFeature>(map, undefined, [layerId]);

  /**
   * A displaced numeral is a DOM target. Its hit circle stays on the anchor, so a click re-fires at
   * the anchor and the stage's own pointer hit test opens the place, the same path a tap there takes.
   */
  function tokenClick(key: string): void {
    const at = tokenAnchors.get(key);
    if (!at) return;
    const point = map.project(at);
    map.fire('click', {
      point,
      lngLat: map.unproject(point),
      originalEvent: new MouseEvent('click'),
    } as never);
  }

  function update(): void {
    frame = 0;
    const zoom = map.getZoom();
    const named = new Set<string>();
    for (const feature of query(EXPLORE_PLACE_NAME_LAYER_ID)) {
      const key = feature.properties?.placeKey;
      if (typeof key === 'string') named.add(key);
    }

    // 1. Every token MapLibre placed, with its numeral and name boxes.
    type Placed = { props: Record<string, unknown>; input: TokenInput };
    const placed = new Map<string, Placed>();
    for (const feature of query(EXPLORE_CLUSTER_COUNT_LAYER_ID)) {
      const props = feature.properties ?? {};
      const key = props.placeKey;
      const at = pointOf(feature);
      if (typeof key !== 'string' || placed.has(key) || !at) continue;
      tokenAnchors.set(key, at);
      const { x, y } = map.project(at);
      const count = String(props.point_count_abbreviated ?? '');
      const tier = Math.min(2, Math.max(0, Number(props.tier) || 0));
      const size = MAP_TYPE.count[tier] ?? MAP_TYPE.count[0];
      const nameSize = MAP_TYPE.name[tier] ?? MAP_TYPE.name[0];
      const label = placeLabelText(props, zoom);
      placed.set(key, {
        props,
        input: {
          key,
          x,
          y,
          count: Number(props.point_count) || 0,
          width: count.length * size * COUNT_DIGIT_EM,
          height: size,
          ...(named.has(key) && label
            ? {
                name: {
                  dx: count.length * size * 0.31 + 8,
                  width: label.length * nameSize * (0.6 + NAME_TRACKING_EM),
                  height: nameSize,
                },
              }
            : {}),
        },
      });
    }

    // 2. The pins a numeral must not cover: drawn sites, areas and the selected ring.
    const obstacles: Box[] = [];
    const pinned = new Set<string>();
    for (const [layerId, diameter] of [
      [EXPLORE_UNCLUSTERED_POINT_LAYER_ID, MAP_TYPE.ring + MAP_TYPE.keyline],
      [EXPLORE_SELECTED_POINT_LAYER_ID, MAP_TYPE.ring * 1.6 + MAP_TYPE.keyline],
    ] as const) {
      for (const feature of query(layerId)) {
        const at = pointOf(feature);
        if (!at) continue;
        const { x, y } = map.project(at);
        const id = `${layerId}:${x.toFixed(1)},${y.toFixed(1)}`;
        if (pinned.has(id)) continue;
        pinned.add(id);
        obstacles.push(markBox(x, y, diameter));
      }
    }

    // The callout naming the selected record (home's spotlight or explore's flag) is a card on
    // the plate; numerals step around it rather than hide under it.
    const box = map.getContainer().getBoundingClientRect();
    for (const card of document.querySelectorAll<HTMLElement>('.ds-map-callout__card')) {
      const r = card.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(card).visibility === 'hidden')
        continue;
      obstacles.push({
        x0: r.left - box.left,
        y0: r.top - box.top,
        x1: r.right - box.left,
        y1: r.bottom - box.top,
      });
    }

    // 3. Lay out, then print.
    const layout = layoutTokens(
      [...placed.values()].map((p) => p.input),
      obstacles,
    );
    const seenTokens = new Set<string>();
    for (const spot of layout) {
      const { props } = placed.get(spot.key)!;
      seenTokens.add(spot.key);
      let token = tokens.get(spot.key);
      if (!token) {
        token = buildToken(String(props.level ?? ''), String(props.tier ?? 0));
        tokens.set(spot.key, token);
        const key = spot.key;
        token.count.addEventListener('click', () => tokenClick(key));
        // Keep the map from reading the press as a pan or a click on empty plate.
        for (const type of ['mousedown', 'mouseup', 'dblclick', 'touchstart', 'pointerdown']) {
          token.count.addEventListener(type, (event) => event.stopPropagation());
        }
        layer.append(token.root);
      }
      const count = String(props.point_count_abbreviated ?? '');
      if (token.count.textContent !== count) {
        token.count.textContent = count;
        token.root.style.setProperty('--ds-place-digits', String(count.length));
      }
      setText(token.name, placeLabelText(props, zoom));
      token.root.classList.toggle('is-named', named.has(spot.key) && spot.nameShown);
      token.root.classList.toggle('is-displaced', spot.displaced);
      token.root.classList.toggle('is-hovered', spot.key === hovered);
      token.root.classList.toggle('is-pressed', spot.key === hovered && pressed);
      token.root.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px)`;

      let leader = leaders.get(spot.key);
      if (!spot.leader) {
        leader?.g.remove();
        leaders.delete(spot.key);
        continue;
      }
      if (!leader) {
        leader = buildLeader();
        leaders.set(spot.key, leader);
        tethers.append(leader.g);
      }
      leader.line.setAttribute('x1', spot.leader.from.x.toFixed(1));
      leader.line.setAttribute('y1', spot.leader.from.y.toFixed(1));
      leader.line.setAttribute('x2', spot.leader.to.x.toFixed(1));
      leader.line.setAttribute('y2', spot.leader.to.y.toFixed(1));
      leader.dot.setAttribute('cx', spot.leader.to.x.toFixed(1));
      leader.dot.setAttribute('cy', spot.leader.to.y.toFixed(1));
    }
    for (const [key, token] of tokens) {
      if (seenTokens.has(key)) continue;
      token.root.remove();
      tokens.delete(key);
      tokenAnchors.delete(key);
      leaders.get(key)?.g.remove();
      leaders.delete(key);
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
      leaders.clear();
      tokenAnchors.clear();
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
