/**
 * First-paint pin payload for `/`. Geography and a public name may ride the
 * first HTML document. Shop tokens may not: `ent_*`, opaque catalog ids such as
 * `42Cb1758`, and evidence grades stay in the archive until `/atlas/catalog`.
 *
 * Walkable pins keep a holding `/place/` href. Every other record stays on the
 * plate without a walk. This is not a second map source; it is the same pin
 * collection with internal labels stripped at the page boundary.
 */
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import {
  atlasWalkHref,
  isHoldingPlaceHref,
  isInternalRecordLabel,
  isPublicPlaceSlug,
  placePageHolds,
  staysOffPublicMap,
} from '../place/public-place-path';
import { locatorPinPercent } from './albers-usa';
import type {
  ExploreMapFeature,
  ExploreMapFeatureCollection,
  ExploreMapFeatureProperties,
} from './build-explore-map-source';

const FIRST_PAINT_PIN_PREFIX = 'pin-';

export function firstPaintPinId(index: number): string {
  return `${FIRST_PAINT_PIN_PREFIX}${index}`;
}

/** Parse `pin-12` → `12`. Returns null when the id is not a first-paint pin. */
export function parseFirstPaintPinId(pinId: string): number | null {
  if (!pinId.startsWith(FIRST_PAINT_PIN_PREFIX)) return null;
  const index = Number.parseInt(pinId.slice(FIRST_PAINT_PIN_PREFIX.length), 10);
  return Number.isFinite(index) && index >= 0 ? index : null;
}

/** True when a string is a shop token that must not appear in the first document. */
export function isShopToken(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith(FIRST_PAINT_PIN_PREFIX)) return false;
  if (/42Cb1758/i.test(trimmed)) return true;
  if (/\bGrade\s+[ABC]\b/i.test(trimmed)) return true;
  if (/\bent_[a-z0-9_]+/i.test(trimmed)) return true;
  if (trimmed.includes('/entity/')) return true;
  return isInternalRecordLabel(trimmed);
}

function publicPinName(displayName: string): string {
  if (isShopToken(displayName) || isInternalRecordLabel(displayName)) return '';
  return displayName.trim();
}

function publicPinHref(properties: ExploreMapFeatureProperties): string {
  if (!isHoldingPlaceHref(properties.href)) return '';
  if (
    !placePageHolds({
      displayName: properties.displayName,
      entityId: properties.entityId,
    })
  ) {
    return '';
  }
  return properties.href;
}

function doorPlaceHref(href: string): string {
  if (!href.startsWith('/place/')) return '';
  const slug = href.slice('/place/'.length).split('--')[0] ?? '';
  return isPublicPlaceSlug(slug) ? href : '';
}

/**
 * Door Journey link for one pin. Public `/place/` and `/law` ride the first document. `/entity/…`
 * stays server-side — the pin links to `/door/pin/{pinId}` instead.
 */
function doorRecordHref(
  properties: ExploreMapFeatureProperties,
  sourceHref: string,
  pinId: string,
): string {
  if (publicPinName(properties.displayName).length === 0) return '';
  if (staysOffPublicMap({ displayName: properties.displayName })) return '';

  const href = sourceHref.trim();
  if (href.length === 0) return '';

  if (href === '/law') return href;

  const placeHref = doorPlaceHref(href);
  if (placeHref.length > 0) return placeHref;

  if (href.startsWith('/entity/')) {
    return `/door/pin/${encodeURIComponent(pinId)}`;
  }

  return '';
}

/** Resolve an opaque Door pin id to the record href (used by `/door/pin/[pinId]`). */
export function resolveDoorPinTarget(
  pinId: string,
  features: readonly ExploreMapFeature[],
): string | null {
  const index = parseFirstPaintPinId(pinId);
  if (index === null || index < 0 || index >= features.length) return null;

  const feature = features[index]!;
  if (staysOffPublicMap(feature.properties)) return null;
  if (publicPinName(feature.properties.displayName).length === 0) return null;

  const href = feature.properties.href.trim();
  if (href.length === 0) return null;
  if (href === '/law') return href;
  if (href.startsWith('/entity/')) return href;

  const placeHref = doorPlaceHref(href);
  return placeHref.length > 0 ? placeHref : null;
}

function firstPaintProperties(
  properties: ExploreMapFeatureProperties,
  pinId: string,
): ExploreMapFeatureProperties {
  return {
    entityId: pinId,
    href: publicPinHref(properties),
    kind: properties.kind,
    displayName: publicPinName(properties.displayName),
    oneLineStory: '',
    precision: properties.precision,
    geoPrecisionTier: properties.geoPrecisionTier,
    eraBuckets: [],
    evidenceCount: 0,
    confidenceTier: 'unrated',
    topicTags: [],
    shade: properties.shade,
    glyph: properties.glyph,
    kindFamily: properties.kindFamily,
    ...(properties.statePostalCode ? { statePostalCode: properties.statePostalCode } : {}),
  };
}

/**
 * Blank shop-token strings anywhere in a value that will serialize into the
 * first HTML document. Pin ids (`pin-N`) stay; `ent_*`, `42Cb1758`, and
 * evidence grades do not.
 */
export function stripShopTokensFromJson<T>(value: T): T {
  if (typeof value === 'string') {
    return (isShopToken(value) ? '' : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => stripShopTokensFromJson(entry)) as T;
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isShopToken(key)) continue;
      next[key] = stripShopTokensFromJson(child);
    }
    return next as T;
  }
  return value;
}

function buildFirstPaintPinCollection(
  features: readonly ExploreMapFeature[],
  hrefFor: (feature: ExploreMapFeature, pinId: string) => string,
  holdingWalkFor?: (feature: ExploreMapFeature, href: string) => boolean,
): ExploreMapFeatureCollection {
  const pins: ExploreMapFeatureCollection = {
    type: 'FeatureCollection',
    features: features.map((feature, index) => {
      const pinId = firstPaintPinId(index);
      const properties = firstPaintProperties(feature.properties, pinId);
      const href = hrefFor(feature, pinId);
      const holdingWalk = holdingWalkFor?.(feature, href) ?? false;
      return {
        type: 'Feature',
        id: pinId,
        geometry: feature.geometry,
        properties: {
          ...properties,
          href,
          ...(holdingWalk ? { holdingWalk: true as const } : {}),
        },
      };
    }),
  };
  return stripShopTokensFromJson(pins);
}

function isDoorAtlasWalk(feature: ExploreMapFeature, doorHref: string): boolean {
  if (doorHref.length === 0) return false;
  const walkHref = atlasWalkHref({
    displayName: feature.properties.displayName,
    kind: feature.properties.kind,
    entityId: feature.properties.entityId,
  });
  return walkHref !== undefined && walkHref === doorHref;
}

/** Pins that may be serialized into the first `/` document. */
export function toFirstPaintPins(
  features: readonly ExploreMapFeature[],
): ExploreMapFeatureCollection {
  return buildFirstPaintPinCollection(features, (feature) => publicPinHref(feature.properties));
}

/** Door Journey pins: every public record is clickable; entity ids stay off the first document. */
export function toDoorLinkPins(
  features: readonly ExploreMapFeature[],
): ExploreMapFeatureCollection {
  return buildFirstPaintPinCollection(
    features,
    (feature, pinId) => doorRecordHref(feature.properties, feature.properties.href, pinId),
    (feature, href) => isDoorAtlasWalk(feature, href),
  );
}

function shouldDropSelected(selected: string | undefined): boolean {
  return Boolean(selected && isShopToken(selected));
}

/** Drop shop tokens from the request-scoped shell before it rides the first document. */
export function toFirstPaintShell<T extends { readonly viewState: { readonly selected?: string } }>(
  shell: T,
): T {
  const { selected: _selected, ...viewStateRest } = shell.viewState;
  const next = {
    ...shell,
    viewState: {
      ...viewStateRest,
      ...(shouldDropSelected(shell.viewState.selected)
        ? {}
        : shell.viewState.selected
          ? { selected: shell.viewState.selected }
          : {}),
    },
  };
  return stripShopTokensFromJson(next as T);
}

/** Project a lng/lat onto the national plate as CSS percent. */
export function conusPinPercent(
  lng: number,
  lat: number,
): { readonly left: number; readonly top: number } {
  const [west, south, east, north] = US_CONUS_BOUNDS;
  const x = (lng - west) / (east - west);
  const y = (north - lat) / (north - south);
  return {
    left: Math.min(100, Math.max(0, x * 100)),
    top: Math.min(100, Math.max(0, y * 100)),
  };
}

/** True when this first-paint pin is a holding `/place/` walk. */
export function isFirstPaintWalk(feature: ExploreMapFeature): boolean {
  return isHoldingPlaceHref(feature.properties.href);
}

/**
 * Pin-plate walk styling. Explore first paint: any holding `/place/` href. Door link plate:
 * only allowlisted atlas walks (`holdingWalk`), not every linkable `/place/` record.
 */
export function isPinPlateWalk(feature: ExploreMapFeature, linkRecords: boolean): boolean {
  if (linkRecords) {
    return feature.properties.holdingWalk === true;
  }
  return isFirstPaintWalk(feature);
}

/** Resolve a release entity id to the opaque first-paint pin id (`pin-N`). */
export function resolveDoorFocusPinId(
  catalogEntityId: string | null,
  catalogFeatures: readonly ExploreMapFeature[],
): string | null {
  if (catalogEntityId === null || catalogEntityId.length === 0) return null;
  const index = catalogFeatures.findIndex(
    (feature) => feature.properties.entityId === catalogEntityId,
  );
  return index >= 0 ? firstPaintPinId(index) : null;
}

/** Max pins on the Door national field at phone widths (spatial bucket cap). */
export const DOOR_MOBILE_NATIONAL_PIN_CAP = 48;

/** Coarse Albers grid for national mobile — one representative pin per cell. */
export const DOOR_MOBILE_NATIONAL_GRID_COLS = 12;
export const DOOR_MOBILE_NATIONAL_GRID_ROWS = 8;

type DoorPinRegion = 'west' | 'central' | 'east';

const DOOR_PIN_REGIONS: readonly DoorPinRegion[] = ['west', 'central', 'east'];

function doorPinRegion(lng: number): DoorPinRegion {
  if (lng < -102) return 'west';
  if (lng < -90) return 'central';
  return 'east';
}

function doorNationalCellKey(lng: number, lat: number, cols: number, rows: number): string | null {
  const projected = locatorPinPercent(lng, lat);
  if (!projected) return null;
  const col = Math.min(cols - 1, Math.floor((projected.x / 100) * cols));
  const row = Math.min(rows - 1, Math.floor((projected.y / 100) * rows));
  return `${row}:${col}`;
}

/** Prefer a holding walk when two pins compete for the same national grid cell. */
function shouldPreferDoorNationalPin(
  candidate: ExploreMapFeature,
  incumbent: ExploreMapFeature,
): boolean {
  const candidateWalk = candidate.properties.holdingWalk === true;
  const incumbentWalk = incumbent.properties.holdingWalk === true;
  if (candidateWalk !== incumbentWalk) return candidateWalk;
  return candidate.properties.entityId.localeCompare(incumbent.properties.entityId) < 0;
}

function trimDoorNationalPinsToCap(
  features: readonly ExploreMapFeature[],
  cap: number,
  focusEntityId: string | null,
): ExploreMapFeature[] {
  const focus =
    focusEntityId !== null && focusEntityId.length > 0
      ? features.find((feature) => feature.properties.entityId === focusEntityId)
      : undefined;

  const pinnedIds = new Set<string>();
  if (focus) pinnedIds.add(focus.properties.entityId);

  const pinned = focus ? [focus] : [];
  const optional = features.filter((feature) => !pinnedIds.has(feature.properties.entityId));
  const room = cap - pinned.length;
  if (room <= 0) return pinned.slice(0, cap);
  if (optional.length <= room) return [...pinned, ...optional];

  const byRegion: Record<DoorPinRegion, ExploreMapFeature[]> = {
    west: [],
    central: [],
    east: [],
  };
  for (const feature of optional) {
    const [lng] = feature.geometry.coordinates;
    byRegion[doorPinRegion(lng)].push(feature);
  }
  for (const region of DOOR_PIN_REGIONS) {
    byRegion[region].sort((a, b) => a.properties.entityId.localeCompare(b.properties.entityId));
  }

  const baseQuota = Math.floor(room / DOOR_PIN_REGIONS.length);
  let remainder = room - baseQuota * DOOR_PIN_REGIONS.length;
  const selected: ExploreMapFeature[] = [];
  const cursors: Record<DoorPinRegion, number> = { west: 0, central: 0, east: 0 };

  for (const region of DOOR_PIN_REGIONS) {
    let quota = baseQuota;
    if (remainder > 0) {
      quota += 1;
      remainder -= 1;
    }
    const take = byRegion[region].slice(0, quota);
    selected.push(...take);
    cursors[region] = take.length;
  }

  let unfilled = room - selected.length;
  while (unfilled > 0) {
    let progressed = false;
    for (const region of DOOR_PIN_REGIONS) {
      if (unfilled <= 0) break;
      const pool = byRegion[region];
      const cursor = cursors[region];
      if (cursor < pool.length) {
        selected.push(pool[cursor]!);
        cursors[region] = cursor + 1;
        unfilled -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return [...pinned, ...selected];
}

/**
 * Thin the national Door field for mobile: one pin per coarse grid cell, a hard cap, and
 * regional balance so the Eastern seaboard does not read as a solid copper wash. The chapter
 * focus pin is always kept. Door link pins share `/place/` hrefs, so walks are bucketed like
 * every other record instead of bypassing the cap.
 */
export function thinDoorNationalPins(
  pins: ExploreMapFeatureCollection,
  options?: {
    readonly cap?: number;
    readonly focusEntityId?: string | null;
  },
): ExploreMapFeatureCollection {
  const cap = options?.cap ?? DOOR_MOBILE_NATIONAL_PIN_CAP;
  const focusEntityId = options?.focusEntityId ?? null;
  const cols = DOOR_MOBILE_NATIONAL_GRID_COLS;
  const rows = DOOR_MOBILE_NATIONAL_GRID_ROWS;

  const bucketed = new Map<string, ExploreMapFeature>();
  for (const feature of pins.features) {
    const [lng, lat] = feature.geometry.coordinates;
    const cell = doorNationalCellKey(lng, lat, cols, rows);
    if (!cell) continue;
    const existing = bucketed.get(cell);
    if (existing === undefined || shouldPreferDoorNationalPin(feature, existing)) {
      bucketed.set(cell, feature);
    }
  }

  if (focusEntityId) {
    const focusFeature = pins.features.find(
      (feature) => feature.properties.entityId === focusEntityId,
    );
    if (focusFeature) {
      const [lng, lat] = focusFeature.geometry.coordinates;
      const cell = doorNationalCellKey(lng, lat, cols, rows);
      if (cell) bucketed.set(cell, focusFeature);
    }
  }

  const features = trimDoorNationalPinsToCap([...bucketed.values()], cap, focusEntityId);

  return {
    type: 'FeatureCollection',
    features: firstPaintWalksFirst({ type: 'FeatureCollection', features }),
  };
}

/** Holding `/place/` walks, then the rest of the plate. */
export function firstPaintWalksFirst(
  pins: ExploreMapFeatureCollection,
): readonly ExploreMapFeature[] {
  const walks: ExploreMapFeature[] = [];
  const rest: ExploreMapFeature[] = [];
  for (const feature of pins.features) {
    if (feature.properties.holdingWalk === true) {
      walks.push(feature);
    } else {
      rest.push(feature);
    }
  }
  return [...walks, ...rest];
}
