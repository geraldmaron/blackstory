/**
 * Native Themes feature surface — impact packet browse and detail.
 */
export { ThemesBrowseScreen } from './ThemesBrowseScreen';
export { ThemesDetailScreen } from './ThemesDetailScreen';
export {
  catalogPulse,
  filterCatalogRows,
  getThemeById,
  listCatalogRows,
  listPacketsForTheme,
  loadThemesCatalog,
  parseThemeId,
  plainDashCopy,
} from './catalog';
export { THEMES_INTRO, THEMES_CATALOG, THEMES_DETAIL } from './themes-copy';
export type { ThemeCatalogEntry, ThemesCatalogRow, ThemePacketView } from './types';
