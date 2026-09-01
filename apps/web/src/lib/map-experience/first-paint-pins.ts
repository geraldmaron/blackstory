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
  isHoldingPlaceHref,
  isInternalRecordLabel,
  placePageHolds,
} from '../place/public-place-path';
import type {
  ExploreMapFeature,
  ExploreMapFeatureCollection,
  ExploreMapFeatureProperties,
} from './build-explore-map-source';

const FIRST_PAINT_PIN_PREFIX = 'pin-';

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

/** Pins that may be serialized into the first `/` document. */
export function toFirstPaintPins(
  features: readonly ExploreMapFeature[],
): ExploreMapFeatureCollection {
  const pins: ExploreMapFeatureCollection = {
    type: 'FeatureCollection',
    features: features.map((feature, index) => {
      const pinId = `${FIRST_PAINT_PIN_PREFIX}${index}`;
      return {
        type: 'Feature',
        id: pinId,
        geometry: feature.geometry,
        properties: firstPaintProperties(feature.properties, pinId),
      };
    }),
  };
  return stripShopTokensFromJson(pins);
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

/** Holding `/place/` walks, then the rest of the plate. */
export function firstPaintWalksFirst(
  pins: ExploreMapFeatureCollection,
): readonly ExploreMapFeature[] {
  const walks: ExploreMapFeature[] = [];
  const rest: ExploreMapFeature[] = [];
  for (const feature of pins.features) {
    if (isFirstPaintWalk(feature)) {
      walks.push(feature);
    } else {
      rest.push(feature);
    }
  }
  return [...walks, ...rest];
}
