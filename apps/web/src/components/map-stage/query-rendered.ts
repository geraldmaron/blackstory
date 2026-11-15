/**
 * `queryRenderedFeatures` over the layers that exist, or nothing.
 *
 * MapLibre 5.24 can throw "Out of bounds. Index requested n=0 ..." from a GeoJSON tile whose
 * feature index outlives its tile data while a `setData` is in flight (the tile's layer table
 * decodes empty). The next frame queries a settled tile, so an empty answer for this one frame is
 * correct; any other error is a real bug and still throws.
 */
type QueryableMap = {
  getLayer(id: string): unknown;
  queryRenderedFeatures(...args: never[]): unknown[];
};

export function queryRenderedLayers<F>(
  map: QueryableMap,
  geometry: unknown,
  layerIds: readonly string[],
): F[] {
  const layers = layerIds.filter((id) => map.getLayer(id));
  if (layers.length === 0) return [];
  const query = map.queryRenderedFeatures as unknown as (...args: unknown[]) => F[];
  try {
    return geometry === undefined
      ? query.call(map, { layers })
      : query.call(map, geometry, { layers });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Out of bounds. Index requested')) {
      return [];
    }
    throw error;
  }
}
