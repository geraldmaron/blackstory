/**
 * Shared label-name expression for OpenMapTiles-backed symbol layers.
 *
 * OpenMapTiles ships localised name fields inconsistently across planet releases: `name:en` is
 * present on some features and absent on others, so a style that pins `name:en` silently drops a
 * large share of its labels rather than failing loudly. Coalescing through `name_en` and
 * `name:latin` to the raw `name` keeps a label on every feature that has one.
 *
 * Verified against tiles.openfreemap.org/planet on 2026-07-30 (Birmingham, z13.4, 26 rendered
 * `transportation_name` features): that build exposes `name`, `name:latin`, `name_int`, `name_de`
 * and `name_en` — note the *underscore*. `name:en` with a colon is absent from that build, so the
 * first branch below did not match there and labels fell through to `name:latin`. Both spellings
 * are kept: the colon form is the OpenMapTiles schema spelling and does appear in other planet
 * builds, and the underscore form is what openfreemap.org/planet actually ships, which is the
 * whole reason this is a coalesce.
 *
 * Applies to layers reading the OpenFreeMap vector source only. Layers backed by our own GeoJSON
 * (county lines, memorial names) carry a plain `name` property and must keep using `['get','name']`
 * — routing them through this expression would imply a localisation they do not have.
 *
 * See docs/ui/design-direction-v9-atlas.md §3.
 */
import type { ExpressionSpecification } from 'maplibre-gl';

export const MAP_LABEL_NAME_FIELD: ExpressionSpecification = [
  'coalesce',
  ['get', 'name:en'],
  ['get', 'name_en'],
  ['get', 'name:latin'],
  ['get', 'name'],
];
