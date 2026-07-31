/**
 * Shared label-name expression for OpenMapTiles-backed symbol layers.
 *
 * OpenMapTiles ships localised name fields inconsistently across planet releases: `name:en` is
 * present on some features and absent on others, so a style that pins `name:en` silently drops a
 * large share of its labels rather than failing loudly. Coalescing through `name:latin` to the
 * raw `name` keeps a label on every feature that has one.
 *
 * Verified against tiles.openfreemap.org/planet on 2026-07-30 (Birmingham, z13.4, 26 rendered
 * `transportation_name` features): that build exposes `name`, `name:latin`, `name_int`, `name_de`
 * and `name_en` — note the *underscore*. `name:en` with a colon is absent, so the first branch
 * below currently never matches and every label resolves through `name:latin`. The branch is kept
 * because the colon form is the OpenMapTiles schema spelling and does appear in other planet
 * builds, which is the whole reason this is a coalesce. Adding an explicit `name_en` branch is
 * tracked separately; it is a design-doc change (§3), not a style-file change.
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
  ['get', 'name:latin'],
  ['get', 'name'],
];
