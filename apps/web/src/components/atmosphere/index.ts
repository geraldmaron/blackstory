/**
 * Public barrel for the shared atmosphere media plane (story masts today;
 * entity/map surfaces may consume the same selection contract later).
 */
export { AtmospherePlane } from './AtmospherePlane';
export type { AtmospherePlaneProps } from './AtmospherePlane';
export {
  GEOMETRIC_FALLBACKS,
  GEOMETRIC_FALLBACK_IDS,
  geometricFallbackById,
} from './geometric-fallbacks';
export type { GeometricFallback, GeometricFallbackId } from './geometric-fallbacks';
export { selectAtmospherePlane, selectMosaicTiles } from './select-atmosphere-plane';
export type {
  AtmosphereDensity,
  AtmospherePlaneSelection,
  AtmospherePlaneSelectionInput,
} from './select-atmosphere-plane';
export {
  ATMOSPHERE_ATTRIBUTION_HREF,
  ATMOSPHERE_TILE_CREDITS,
} from './tile-credits';
export type { AtmosphereTileCredit } from './tile-credits';
export { renderStoryTitle, STORY_TITLE_ACCENTS } from './story-title';
