/**
 * Public barrel for the shared atmosphere media plane (story masts today;
 * about living mosaic + entity/map surfaces may consume the same selection contract).
 */
export { AtmospherePlane } from './AtmospherePlane';
export type { AtmospherePlaneProps } from './AtmospherePlane';
export { LivingAtmosphereMosaic } from './LivingAtmosphereMosaic';
export type { LivingAtmosphereMosaicProps } from './LivingAtmosphereMosaic';
export { AboutMosaicRail } from './AboutMosaicRail';
export {
  GEOMETRIC_FALLBACKS,
  GEOMETRIC_FALLBACK_IDS,
  geometricFallbackById,
  PAGE_FIELD_MOTIFS,
  PAGE_FIELD_MOTIF_IDS,
  pageFieldMotifById,
} from './geometric-fallbacks';
export type {
  GeometricFallback,
  GeometricFallbackId,
  PageFieldMotif,
  PageFieldMotifId,
} from './geometric-fallbacks';
export { selectPageField } from './select-page-field';
export type { PageFieldSelection } from './select-page-field';
export { selectAtmospherePlane, selectMosaicTiles } from './select-atmosphere-plane';
export type {
  AtmosphereDensity,
  AtmospherePlaneSelection,
  AtmospherePlaneSelectionInput,
} from './select-atmosphere-plane';
export {
  applyLivingTileSwap,
  pickLivingTileSwap,
} from './select-living-swap';
export type { LivingTileSwap } from './select-living-swap';
export {
  ATMOSPHERE_ATTRIBUTION_HREF,
  ATMOSPHERE_TILE_CREDITS,
} from './tile-credits';
export type { AtmosphereTileCredit } from './tile-credits';
export { renderStoryTitle, STORY_TITLE_ACCENTS } from './story-title';
