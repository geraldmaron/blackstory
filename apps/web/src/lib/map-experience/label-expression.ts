/**
 * Shared label-name expression for OpenMapTiles-backed symbol layers.
 *
 * OpenMapTiles ships localised name fields inconsistently across planet releases: `name:en` is
 * present on some features and absent on others, so a style that pins `name:en` silently drops a
 * large share of its labels rather than failing loudly. Coalescing through `name_en` and
 * `name:latin` to the raw `name` keeps a label on every feature that has one.
 *
 * Planet builds expose both schema spellings in practice: OpenMapTiles documents `name:en`, while
 * OpenFreeMap tiles can carry `name_en`. Both remain in the coalesce so localization does not
 * depend on one provider build.
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
