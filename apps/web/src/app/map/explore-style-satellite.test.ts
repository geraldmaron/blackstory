/**
 * The satellite basemap (`?sat=1`).
 *
 * Two things are under test, and the second is the one that matters. The first is plumbing: the
 * imagery layer exists, sits in the right place in the stack, and costs nothing when it is off.
 *
 * The second is that turning imagery on does not quietly break the archive drawn over it. The
 * plate's ink is contrast-held against two flat fills by design law §3 (`map-contrast.test.ts`);
 * aerial imagery is not a flat fill, so every one of those guarantees lapses the moment this
 * toggle flips. These pin the compensations — scrim, re-inked cartography, widened halos, backed
 * off overlay tints — and pin the line they must not cross: record encoding is not a basemap
 * concern, so a pin's colour and size must be byte-identical either way.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExploreMapStyle } from './explore-style';
import {
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  SATELLITE_LAYER_ID,
} from './explore-layer-ids';
import {
  SATELLITE_RASTER_PAINT,
  USGS_IMAGERY_SOURCE_ID,
  USGS_IMAGERY_TILE_URL,
  type MapColorScheme,
} from '../../lib/map-experience/dignity-style';

type LayerLike = {
  readonly id: string;
  readonly type: string;
  readonly layout?: Record<string, unknown>;
  readonly paint?: Record<string, unknown>;
};

const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] } as const;

function build(satellite: boolean, colorScheme: MapColorScheme = 'dark') {
  return buildExploreMapStyle({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- empty fixture, no geometry needed
    featureCollection: EMPTY_COLLECTION as any,
    jurisdictionAreaFeatures: [],
    layerMode: 'off',
    colorScheme,
    satellite,
  });
}

function layers(style: ReturnType<typeof build>): readonly LayerLike[] {
  return style.layers as unknown as readonly LayerLike[];
}

function layerById(style: ReturnType<typeof build>, id: string): LayerLike {
  const layer = layers(style).find((candidate) => candidate.id === id);
  assert.ok(layer, `expected a layer with id "${id}"`);
  return layer;
}

function visibility(layer: LayerLike): string {
  // MapLibre treats an absent `visibility` as 'visible'.
  return (layer.layout?.visibility as string | undefined) ?? 'visible';
}

/* ---- plumbing ------------------------------------------------------------------------------ */

test('the imagery tile URL is an ArcGIS {z}/{y}/{x} path, not an XYZ one', () => {
  // The single easiest way to break this basemap. USGS serves an ArcGIS MapServer tile endpoint,
  // which puts ROW before COLUMN — swapping them yields tiles that load with no error and show
  // the wrong part of the country, which no test of "did it render" would catch.
  assert.ok(
    USGS_IMAGERY_TILE_URL.endsWith('/tile/{z}/{y}/{x}'),
    `imagery URL must end in /tile/{z}/{y}/{x}, got ${USGS_IMAGERY_TILE_URL}`,
  );
  assert.ok(USGS_IMAGERY_TILE_URL.startsWith('https://'), 'imagery must be fetched over TLS');
});

test('the imagery source is declared and attributed whether or not it is showing', () => {
  for (const satellite of [true, false]) {
    const source = build(satellite).sources[USGS_IMAGERY_SOURCE_ID] as {
      type?: string;
      tiles?: readonly string[];
      attribution?: string;
    };
    assert.ok(source, `imagery source missing with satellite=${satellite}`);
    assert.equal(source.type, 'raster');
    assert.deepEqual(source.tiles, [USGS_IMAGERY_TILE_URL]);
    // USGS imagery is public domain, but the attribution is how a reader learns whose photograph
    // of the ground they are reading the archive against.
    assert.match(String(source.attribution), /USGS/);
  }
});

test('imagery is hidden when satellite is off, so a reader who never asks never fetches a tile', () => {
  assert.equal(visibility(layerById(build(false), SATELLITE_LAYER_ID)), 'none');
  assert.equal(visibility(layerById(build(true), SATELLITE_LAYER_ID)), 'visible');
});

test('imagery sits directly above the background and below every other layer', () => {
  // Above `background` because that layer is the scrim it composites against; below everything
  // else because it is a basemap. Anywhere else in the stack and it covers the archive.
  const ids = layers(build(true)).map((layer) => layer.id);
  assert.equal(ids[0], 'background');
  assert.equal(ids[1], SATELLITE_LAYER_ID);
});

/* ---- contrast ------------------------------------------------------------------------------ */

test('the imagery is scrimmed rather than painted at full strength', () => {
  const paint = layerById(build(true), SATELLITE_LAYER_ID).paint ?? {};
  const opacity = paint['raster-opacity'] as number;
  // Full opacity would mean the background layer beneath contributes nothing, which is the whole
  // first half of the contrast strategy. Too low and it is a tinted ghost, not imagery.
  assert.ok(opacity > 0.4 && opacity < 1, `raster-opacity should scrim, got ${opacity}`);
  assert.ok(
    (paint['raster-saturation'] as number) < 0,
    'imagery must be desaturated so it does not compete with kind shade, which is an encoding',
  );
});

test('both schemes declare the same raster channels, so a theme toggle leaves none stale', () => {
  // `syncSingleLayerPaint` pushes only the keys the incoming style names. A channel present in
  // one scheme and absent in the other would survive the switch and scrim the wrong plate.
  assert.deepEqual(
    Object.keys(SATELLITE_RASTER_PAINT.light).sort(),
    Object.keys(SATELLITE_RASTER_PAINT.dark).sort(),
  );
});

test('the flat land and water fills come off, so imagery is not painted over', () => {
  for (const id of ['plate-landcover', 'plate-water']) {
    assert.equal(visibility(layerById(build(false), id)), 'visible', `${id} belongs on flat plate`);
    assert.equal(visibility(layerById(build(true), id)), 'none', `${id} would hide the imagery`);
  }
});

test('every label halo widens over imagery, in both schemes', () => {
  // A halo sized for a flat fill leaves the label chewed against aerial texture.
  const haloLayers = ['plate-place-city', 'explore-street-label', 'explore-county-labels'];
  for (const scheme of ['light', 'dark'] as const) {
    for (const id of haloLayers) {
      const flat = layerById(build(false, scheme), id).paint?.['text-halo-width'] as number;
      const sat = layerById(build(true, scheme), id).paint?.['text-halo-width'] as number;
      assert.ok(
        sat > flat,
        `${id} (${scheme}): halo ${sat} should exceed the flat plate's ${flat}`,
      );
    }
  }
});

test('label and boundary ink is re-toned for imagery, in the direction the scheme needs', () => {
  // Light lifts the imagery toward white and inks it black; dark pulls it toward the archive's
  // near-black and inks it paper. Asserting they merely "differ" would pass if both went grey.
  const lightInk = layerById(build(true, 'light'), 'plate-place-city').paint?.['text-color'];
  const darkInk = layerById(build(true, 'dark'), 'plate-place-city').paint?.['text-color'];
  assert.equal(lightInk, '#0A0A0A');
  assert.equal(darkInk, '#F4EFE5');

  for (const scheme of ['light', 'dark'] as const) {
    const flat = layerById(build(false, scheme), 'explore-state-bounds-line').paint?.['line-color'];
    const sat = layerById(build(true, scheme), 'explore-state-bounds-line').paint?.['line-color'];
    assert.notEqual(sat, flat, `state bounds (${scheme}) kept flat-plate ink over imagery`);
  }
});

test('the presence tint backs off over imagery instead of erasing it', () => {
  const opacityFor = (satellite: boolean) => {
    const style = buildExploreMapStyle({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- empty fixture
      featureCollection: EMPTY_COLLECTION as any,
      jurisdictionAreaFeatures: [],
      layerMode: 'presence',
      satellite,
    });
    return layerById(style, 'explore-state-density-fill').paint?.['fill-opacity'] as number;
  };
  const flat = opacityFor(false);
  const sat = opacityFor(true);
  assert.ok(sat < flat, `density tint should lighten over imagery: ${sat} vs ${flat}`);
  // Still has to encode something — an invisible overlay is not an honest "presence" layer.
  assert.ok(sat > 0.2, `density tint ${sat} is too faint to read as a tier ramp`);
});

/* ---- the line the basemap must not cross --------------------------------------------------- */

test('record encoding is identical with and without imagery', () => {
  // The dignity rule this file must not quietly break: a record's colour and size encode evidence
  // and kind. If they moved with the basemap, the same pin would mean two different things
  // depending on a toggle, and the legend would be wrong on one of them.
  const encodingLayers = [
    EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
    EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
    EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
    EXPLORE_SELECTED_POINT_LAYER_ID,
    EXPLORE_CLUSTER_LAYER_ID,
  ];
  for (const id of encodingLayers) {
    assert.deepEqual(
      layerById(build(true), id).paint,
      layerById(build(false), id).paint,
      `${id} paint changed with the basemap — record encoding must not depend on it`,
    );
  }
});
