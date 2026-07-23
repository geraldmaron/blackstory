/**
 * Pure class-name helpers for Themes v6 edition panels: Surface card stack, beat
 * variants, and shared atmosphere canvas hooks. Keeps page JSX readable and gives
 * tests a stable contract for CSS and a11y.
 */

import { editionAtmosphereCanvasClassName } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';

/** Mosaic seed for `/themes` index. */
export const THEMES_EDITION_MOSAIC_SEED = 'themes-edition-v6';

/** Root wrapper on themes routes — pairs with themes-edition.css. */
export const THEMES_EDITION_ROOT_CLASS = 'ds-themes-edition';

/** Default Surface edition panel. */
export const THEMES_EDITION_PANEL_CLASS = 'ds-themes-edition__panel';

export type ThemesEditionPanelVariant =
  | 'intro'
  | 'method'
  | 'catalog'
  | 'soon'
  | 'storytelling'
  | 'consumers'
  | 'packets'
  | 'packet'
  | 'close';

export function themesEditionRootClassName(): string {
  return `${THEMES_EDITION_ROOT_CLASS} ${editionAtmosphereCanvasClassName()}`;
}

export function themesEditionStackClassName(): string {
  return 'ds-themes-edition__stack';
}

export function themesEditionPanelClassName(variant?: ThemesEditionPanelVariant): string {
  if (!variant) {
    return THEMES_EDITION_PANEL_CLASS;
  }
  return `${THEMES_EDITION_PANEL_CLASS} ds-themes-edition__panel--${variant}`;
}

/** Per-theme mosaic scatter (detail + question routes). */
export function themesEditionMosaicSeedForTheme(themeId: string): string {
  return `${THEMES_EDITION_MOSAIC_SEED}:${themeId}`;
}
