/**
 * Custom dark, desaturated "archive of record" MapLibre style.
 *
 * This is the DEMO-STAGE basemap: background + data layers only, no tile
 * source, no glyphs/sprite, so it renders with zero network requests and
 * works in a repo-only, no-live-deployment environment. It intentionally
 * does not attempt to look like a photorealistic/street basemap see
 * docs/adr/ADR-013-map-stack.md for why (archive-of-record register, not a
 * cheerful tourism basemap) and for the TARGET basemap (self-hosted
 * Protomaps PMTiles, dark/desaturated land+water+admin style) — this demo
 * stands in.
 *
 * Colors route through `DIGNITY_PALETTE` (`../../lib/map-experience/dignity-style.ts`) the
 * same single token source `explore-style.ts` uses (BB-099 basemap-conformance pass), which
 * itself reuses @black-book/ui's brand palette, so this demo style and the production style can
 * never drift onto two different color surfaces.
 */
import type { StyleSpecification } from 'maplibre-gl';
import type { UsStateInfo } from '@black-book/domain';
import { DIGNITY_PALETTE } from '../../lib/map-experience/dignity-style';

/**
 * Loosely-typed GeoJSON feature collection. maplibre-gl's own types express
 * `source.data` as the ambient `GeoJSON.GeoJSON` namespace (from
 * `@types/geojson`), but this project's tsconfig pins the global `types`
 * array to `["node"]` only (see packages/typescript-config/base.json) so
 * that namespace is never loaded. We accept a structurally-compatible plain
 * object here instead of fighting that project-wide restriction, and hand
 * it to maplibre-gl with a narrow, well-commented cast at the call site.
 */
type LooseFeatureCollection = {
  readonly type: string;
  readonly features: readonly Record<string, unknown>[];
};

function stateBoundsFeatureCollection(states: readonly UsStateInfo[]) {
  return {
    type: 'FeatureCollection' as const,
    features: states.map((state) => {
      const [west, south, east, north] = state.bbox;
      return {
        type: 'Feature' as const,
        id: state.fips,
        properties: { postalCode: state.postalCode, name: state.name },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      };
    }),
  };
}

/**
 * Build the demo dark-archive style. `states` renders as thin approximate
 * bounding-box outlines (explicitly NOT administrative boundaries see
 * ADR-013 "known gaps") giving the otherwise-empty dark canvas visual
 * structure without vendoring polygon boundary data or fetching tiles.
 */
export function buildDarkArchiveStyle(
  featureCollection: LooseFeatureCollection,
  states: readonly UsStateInfo[],
): StyleSpecification {
  return {
    version: 8,
    name: 'Black Book — Archive Dark (demo)',
    sources: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see LooseFeatureCollection comment above
      'state-bounds': { type: 'geojson', data: stateBoundsFeatureCollection(states) as any },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see LooseFeatureCollection comment above
      entities: { type: 'geojson', data: featureCollection as any },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': DIGNITY_PALETTE.background },
      },
      {
        id: 'state-bounds-line',
        type: 'line',
        source: 'state-bounds',
        paint: {
          'line-color': DIGNITY_PALETTE.border,
          'line-width': 1,
          'line-opacity': 0.7,
        },
      },
      {
        id: 'entities-halo',
        type: 'circle',
        source: 'entities',
        paint: {
          'circle-radius': 8,
          'circle-color': DIGNITY_PALETTE.point,
          'circle-opacity': 0.18,
        },
      },
      {
        id: 'entities-point',
        type: 'circle',
        source: 'entities',
        paint: {
          'circle-radius': 4,
          'circle-color': DIGNITY_PALETTE.point,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': DIGNITY_PALETTE.selected,
        },
      },
    ],
  };
}
