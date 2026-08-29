/**
 * First-paint pin payload for `/`. Geography and a public name may ride the
 * first HTML document. Shop tokens may not: `ent_*`, opaque catalog ids such as
 * `42Cb1758`, and evidence grades stay in the archive until `/atlas/catalog`.
 *
 * Walkable pins keep a holding `/place/` href. Every other record stays on the
 * plate without a walk. This is not a second map source; it is the same pin
 * collection with internal labels stripped at the page boundary.
 */
import {
  isHoldingPlaceHref,
  isInternalRecordLabel,
} from '../place/public-place-path';
import type {
  ExploreMapFeature,
  ExploreMapFeatureCollection,
  ExploreMapFeatureProperties,
} from './build-explore-map-source';

const FIRST_PAINT_PIN_PREFIX = 'pin-';

function publicPinName(displayName: string): string {
  if (isInternalRecordLabel(displayName)) return '';
  return displayName.trim();
}

function publicPinHref(href: string): string {
  return isHoldingPlaceHref(href) ? href : '';
}

function firstPaintProperties(
  properties: ExploreMapFeatureProperties,
  pinId: string,
): ExploreMapFeatureProperties {
  return {
    entityId: pinId,
    href: publicPinHref(properties.href),
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

/** Pins that may be serialized into the first `/` document. */
export function toFirstPaintPins(
  features: readonly ExploreMapFeature[],
): ExploreMapFeatureCollection {
  return {
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
}

/** Drop shop tokens from the request-scoped shell before it rides the first document. */
export function toFirstPaintShell<
  T extends { readonly viewState: { readonly selected?: string } },
>(shell: T): T {
  const selected = shell.viewState.selected;
  if (!selected || (!selected.startsWith('ent_') && !isInternalRecordLabel(selected))) {
    return shell;
  }
  const { selected: _selected, ...viewState } = shell.viewState;
  return { ...shell, viewState: viewState as T['viewState'] };
}

/** Holding `/place/` walks, then the rest of the plate, for the no-JS list. */
export function firstPaintWalksFirst(
  pins: ExploreMapFeatureCollection,
): readonly ExploreMapFeature[] {
  const walks: ExploreMapFeature[] = [];
  const rest: ExploreMapFeature[] = [];
  for (const feature of pins.features) {
    if (isHoldingPlaceHref(feature.properties.href) && feature.properties.displayName) {
      walks.push(feature);
    } else {
      rest.push(feature);
    }
  }
  return [...walks, ...rest];
}
