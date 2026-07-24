/**
 * Native Law feature surface — catalog, browse, and detail screens.
 */
export { LawBrowseScreen } from './LawBrowseScreen';
export { LawDetailScreen } from './LawDetailScreen';
export {
  catalogPulse,
  filterCatalogRows,
  getLawBySlug,
  listCatalogRows,
  loadLawCatalog,
  parseLawSlug,
  plainDashCopy,
} from './catalog';
export { LAW_INTRO, LAW_CATALOG, LAW_DETAIL, LAW_DISCLAIMER } from './law-copy';
export type { LawCatalogEntry, LawCatalogRow } from './types';
