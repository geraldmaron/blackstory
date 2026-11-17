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
import { findUsStateByPostalCode } from '@repo/domain/map/geography';
import { queryRenderedLayers } from './query-rendered';
import {
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
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
import {
  PHONE_MAP_MAX_WIDTH,
  chooseCounted,
  layoutTokens,
  markBox,
  phoneNumeralBudget,
  placeCountList,
  type Box,
  type TokenInput,
} from './token-layout';

/** A tracked Geist Mono capital is about 0.72em wide at the unit's size. */
const UNIT_CHAR_EM = 0.72;
/** The text list refreshes at most this often; it is a static list, not a live region. */
const LIST_INTERVAL_MS = 400;
/** Levels whose counts a phone budgets (`phoneNumeralBudget`). */
const BUDGETED_LEVELS: ReadonlySet<string> = new Set(['state', 'county']);

/**
 * The place type's size factor: small on a phone and at the national frame, a little larger on a
 * wide screen and as the reader zooms toward the street. Clamped, so counts never become posters.
 */
export function placeTypeScale(width: number, zoom: number): number {
  const byWidth = Math.min(1.1, Math.max(0.85, width / 1280));
  const byZoom = Math.min(1.2, Math.max(1, 1 + (zoom - 4) * 0.04));
  return Number((byWidth * byZoom).toFixed(3));
}

/**
 * A place's name written out: a state token's own name is its postal code, so the state's full
 * name comes from the shared geography table. Used where a code would not read (phone, the list).
 */
export function placeFullName(properties: {
  readonly level?: unknown;
  readonly mapName?: unknown;
  readonly postal?: unknown;
}): string {
  const name = typeof properties.mapName === 'string' ? properties.mapName : '';
  if (properties.level !== 'state' || typeof properties.postal !== 'string') return name;
  return findUsStateByPostalCode(properties.postal)?.name ?? name;
}

/** The name a token prints at a zoom: the same rule as the style's `PLACE_NAME_TEXT`. */
export function placeLabelText(
  properties: { readonly level?: unknown; readonly mapName?: unknown; readonly postal?: unknown },
  zoom: number,
  /** Phone: the name is written out; the postal code is kept for the selected state. */
  phone?: { readonly selected: boolean },
): string {
  const name = typeof properties.mapName === 'string' ? properties.mapName : '';
  if (properties.level === 'state') {
    const postal = typeof properties.postal === 'string' ? properties.postal : '';
    if (phone) return phone.selected && postal ? postal : placeFullName(properties);
    return zoom < PLACE_STATE_NAME_MIN_ZOOM && postal ? postal : name;
  }
  return name;
}

type TokenLabel = {
  readonly root: HTMLElement;
  readonly count: HTMLElement;
  readonly name: HTMLElement;
  readonly unit: HTMLElement;
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
  const unit = document.createElement('span');
  unit.className = 'ds-place-token__unit';
  unit.textContent = 'records';
  root.append(count, name, unit);
  return { root, count, name, unit };
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
  readonly setSelected: (
    entityId: string | undefined,
    at?: readonly [number, number] | undefined,
  ) => void;
  /** The entered or selected place (`state-xx`): its count prints even on a phone's short list. */
  readonly setSelectedPlace: (placeKey: string | undefined) => void;
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

  // The text equivalent of the counts: a static list a reader can browse, never a live region.
  const list = document.createElement('div');
  list.className = 'ds-visually-hidden ds-place-list';
  const listHeading = document.createElement('p');
  const listItems = document.createElement('ul');
  list.append(listHeading, listItems);
  map.getContainer().appendChild(list);
  // The phone's one legend line, worded for the level the counts are drawn at.
  const legend = document.createElement('p');
  legend.className = 'ds-place-legend';
  legend.hidden = true;
  layer.append(legend);
  let listSignature = '';
  let listTimer: ReturnType<typeof setTimeout> | undefined;
  let listLines: string[] = [];
  const flushList = () => {
    listTimer = undefined;
    const signature = listLines.join('|');
    if (signature === listSignature) return;
    listSignature = signature;
    listHeading.textContent = listLines.length ? `Places counted in view, ${listLines.length}` : '';
    listItems.replaceChildren(
      ...listLines.map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
      }),
    );
  };

  const tokens = new Map<string, TokenLabel>();
  const leaders = new Map<string, ReturnType<typeof buildLeader>>();
  const tokenAnchors = new Map<string, [number, number]>();
  const sites = new Map<string, HTMLElement>();
  const siteAnchors = new Map<string, [number, number]>();
  let hovered: string | undefined;
  let pressed = false;
  let selected: string | undefined;
  let selectedAt: readonly [number, number] | undefined;
  let selectedPlace: string | undefined;
  let frame = 0;

  const query = (layerId: string) =>
    queryRenderedLayers<MapGeoJSONFeature>(map, undefined, [layerId]);

  /**
   * A displaced numeral is a DOM target. Its hit circle stays on the anchor, so a click re-fires at
   * the anchor and the stage's own pointer hit test opens the place, the same path a tap there takes.
   */
  /**
   * A county with a count token is already named by it; the basemap's own county name (drawn once
   * per tile a polygon crosses) printed it twice more beside the token. Drop those, keep the rest.
   */
  let hiddenCounties = '';
  function hideNamedCounties(keys: ReadonlySet<string>): void {
    const fips = [...keys].filter((key) => key.startsWith('county-')).map((key) => key.slice(7));
    const signature = fips.sort().join(',');
    if (signature === hiddenCounties || !map.getLayer(EXPLORE_COUNTY_LABEL_LAYER_ID)) return;
    hiddenCounties = signature;
    map.setFilter(
      EXPLORE_COUNTY_LABEL_LAYER_ID,
      fips.length === 0
        ? null
        : ['!', ['in', ['concat', ['get', 'stateFips'], ['get', 'countyFips']], ['literal', fips]]],
    );
  }

  /** A label is its mark: a click on the words is replayed as a click on the anchor it names. */
  function clickAt(at: [number, number] | undefined): void {
    if (!at) return;
    const point = map.project(at);
    map.fire('click', {
      point,
      lngLat: map.unproject(point),
      originalEvent: new MouseEvent('click'),
    } as never);
  }

  /** Wires an element so a press on it opens what it labels and never pans or deselects. */
  function actionable(element: HTMLElement, at: () => [number, number] | undefined): void {
    element.classList.add('is-actionable');
    element.addEventListener('click', () => clickAt(at()));
    for (const type of ['mousedown', 'mouseup', 'dblclick', 'touchstart', 'pointerdown']) {
      element.addEventListener(type, (event) => event.stopPropagation());
    }
  }

  function update(): void {
    frame = 0;
    const zoom = map.getZoom();
    const named = new Set<string>();
    for (const feature of query(EXPLORE_PLACE_NAME_LAYER_ID)) {
      const key = feature.properties?.placeKey;
      if (typeof key === 'string') named.add(key);
    }

    const mapBox = map.getContainer();
    const phone = mapBox.clientWidth > 0 && mapBox.clientWidth < PHONE_MAP_MAX_WIDTH;
    // Type follows the map's width and zoom (`placeTypeScale`); the CSS reads the same factor.
    const scale = placeTypeScale(mapBox.clientWidth, zoom);
    const scaleText = scale.toFixed(3);
    if (layer.style.getPropertyValue('--ds-place-scale') !== scaleText) {
      layer.style.setProperty('--ds-place-scale', scaleText);
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
      const size = (MAP_TYPE.count[tier] ?? MAP_TYPE.count[0]) * scale;
      const nameSize = (MAP_TYPE.name[tier] ?? MAP_TYPE.name[0]) * scale;
      const isSelected =
        selectedPlace !== undefined && key.toLowerCase() === selectedPlace.toLowerCase();
      // On a phone only the selected place carries its unit under the numeral.
      const withUnit = phone && isSelected;
      const unitPx = MAP_TYPE.name[0] * scale;
      const label = placeLabelText(props, zoom, phone ? { selected: isSelected } : undefined);
      placed.set(key, {
        props,
        input: {
          key,
          x,
          y,
          count: Number(props.point_count) || 0,
          // A phone numeral carries its unit below it, often wider than a short numeral, so the
          // box is as wide as whichever is wider and symmetric about the numeral.
          width: Math.max(
            count.length * size * COUNT_DIGIT_EM,
            withUnit ? 'records'.length * unitPx * UNIT_CHAR_EM : 0,
          ),
          height: withUnit ? size + 2 * (unitPx + 2) : size,
          ...((phone || named.has(key)) && label
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

    // 2. The pins a numeral must not cover: drawn sites, areas and the selected ring. The frame's
    // own edges are obstacles too, so a numeral moves inward and a name that would run off the
    // map yields instead of printing half a word.
    const { clientWidth: frameW, clientHeight: frameH } = map.getContainer();
    const obstacles: Box[] = [
      { x0: -1000, y0: -1000, x1: 0, y1: frameH + 1000 },
      { x0: frameW, y0: -1000, x1: frameW + 1000, y1: frameH + 1000 },
      { x0: -1000, y0: -1000, x1: frameW + 1000, y1: 0 },
      { x0: -1000, y0: frameH, x1: frameW + 1000, y1: frameH + 1000 },
    ];
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

    // The callout naming the selected record (home's spotlight or explore's flag) and the phone's
    // count legend sit on the plate; numerals step around them rather than hide under them.
    const box = map.getContainer().getBoundingClientRect();
    for (const card of document.querySelectorAll<HTMLElement>(
      '.ds-map-callout__card, .ds-place-legend',
    )) {
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

    // The text equivalent lists every place in view, printed or not.
    listLines = placeCountList(
      [...placed.values()].map((p) => ({
        key: p.input.key,
        name: placeFullName(p.props),
        count: p.input.count,
      })),
    );
    if (listTimer === undefined) listTimer = setTimeout(flushList, LIST_INTERVAL_MS);

    // On a phone the state and county plates print only the largest few counts, labeled; the
    // selected place and the selected record's place always print. City and square levels, where
    // a frame holds few places, print all.
    let counted = new Set(placed.keys());
    const stateInputs = [...placed.values()]
      .map((p) => p.input)
      .filter((input) => BUDGETED_LEVELS.has(String(placed.get(input.key)!.props.level)));
    if (phone && stateInputs.length > 0) {
      const keep = new Set<string>();
      if (selectedPlace) {
        for (const input of stateInputs)
          if (input.key.toLowerCase() === selectedPlace.toLowerCase()) keep.add(input.key);
      }
      if (selectedAt) {
        const at = map.project([selectedAt[0], selectedAt[1]]);
        let nearest: { key: string; d: number } | undefined;
        for (const input of stateInputs) {
          const d = (input.x - at.x) ** 2 + (input.y - at.y) ** 2;
          if (!nearest || d < nearest.d) nearest = { key: input.key, d };
        }
        if (nearest) keep.add(nearest.key);
      }
      const chosen = chooseCounted(
        stateInputs,
        phoneNumeralBudget(mapBox.clientWidth, mapBox.clientHeight),
        keep,
      );
      counted = new Set(
        [...placed.keys()].filter((k) => chosen.has(k) || !stateInputs.some((i) => i.key === k)),
      );
    }
    const levels = new Set([...placed.values()].map((p) => String(p.props.level ?? '')));
    const level = levels.size === 1 ? [...levels][0]! : '';
    const limited = counted.size < placed.size;
    legend.hidden = !(phone && level && counted.size > 0);
    if (!legend.hidden) {
      setText(
        legend,
        `Numbers count records in each ${level}${limited ? '. Tap or zoom for the rest.' : '.'}`,
      );
    }

    // 3. Lay out, then print.
    const layout = layoutTokens(
      [...placed.values()].map((p) => p.input).filter((input) => counted.has(input.key)),
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
        // The numeral and the name are both the place: a click on "SALT LAKE" used to fall through
        // to empty plate, because only the anchor point under the numeral was hit-tested.
        for (const part of [token.count, token.name]) actionable(part, () => tokenAnchors.get(key));
        layer.append(token.root);
      }
      const count = String(props.point_count_abbreviated ?? '');
      if (token.count.textContent !== count) {
        token.count.textContent = count;
        token.root.style.setProperty('--ds-place-digits', String(count.length));
      }
      const isSelected =
        selectedPlace !== undefined && spot.key.toLowerCase() === selectedPlace.toLowerCase();
      setText(
        token.name,
        placeLabelText(props, zoom, phone ? { selected: isSelected } : undefined),
      );
      token.root.classList.toggle('is-phone', phone);
      token.root.classList.toggle('is-selected', isSelected);
      token.root.classList.toggle('is-named', (phone || named.has(spot.key)) && spot.nameShown);
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
    hideNamedCounties(seenTokens);

    const seenSites = new Set<string>();
    for (const feature of query(EXPLORE_SITE_NAME_LAYER_ID)) {
      const props = feature.properties ?? {};
      const id = props.entityId;
      const at = pointOf(feature);
      if (typeof id !== 'string' || id === selected || seenSites.has(id) || !at) continue;
      seenSites.add(id);
      siteAnchors.set(id, at);
      let site = sites.get(id);
      if (!site) {
        site = buildSite(String(props.displayName ?? ''));
        // The record's name opens the record, like its pin. It used to be inert text beside it.
        actionable(site, () => siteAnchors.get(id));
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
      siteAnchors.delete(id);
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
    setSelected(entityId, at) {
      selectedAt = entityId ? at : undefined;
      if (entityId === selected) return schedule();
      selected = entityId;
      schedule();
    },
    setSelectedPlace(placeKey) {
      if (placeKey === selectedPlace) return;
      selectedPlace = placeKey;
      schedule();
    },
    dispose() {
      if (frame !== 0) cancelAnimationFrame(frame);
      map.off('render', schedule);
      map.off('mousedown', press);
      map.off('mouseup', release);
      map.off('movestart', settle);
      if (listTimer !== undefined) clearTimeout(listTimer);
      list.remove();
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
