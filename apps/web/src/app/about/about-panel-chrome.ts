/**
 * Pure class-name helpers for About v6 edition panels: Surface card stack, beat
 * variants, and shared atmosphere canvas hooks. Keeps page JSX readable and gives
 * tests a stable contract for CSS and a11y.
 */

import { editionAtmosphereCanvasClassName } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';

/** Mosaic seed for `/about` (distinct scatter from home and stories). */
export const ABOUT_EDITION_MOSAIC_SEED = 'about-edition-v6';

/** Root wrapper on `/about` — pairs with about-edition.css. */
export const ABOUT_EDITION_ROOT_CLASS = 'ds-about-edition';

/** Default Surface edition panel. */
export const ABOUT_EDITION_PANEL_CLASS = 'ds-about-edition__panel';

export type AboutEditionPanelVariant =
  | 'intro'
  | 'pillars'
  | 'mission'
  | 'publish'
  | 'destinations'
  | 'close';

export function aboutEditionRootClassName(): string {
  return `${ABOUT_EDITION_ROOT_CLASS} ${editionAtmosphereCanvasClassName()}`;
}

export function aboutEditionStackClassName(): string {
  return 'ds-about-edition__stack';
}

export function aboutEditionPanelClassName(variant?: AboutEditionPanelVariant): string {
  if (!variant) {
    return ABOUT_EDITION_PANEL_CLASS;
  }
  return `${ABOUT_EDITION_PANEL_CLASS} ds-about-edition__panel--${variant}`;
}
