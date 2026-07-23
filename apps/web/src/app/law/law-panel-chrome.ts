/**
 * Pure class-name helpers for Law v6 edition panels: Surface card stack, beat
 * variants, and shared atmosphere canvas hooks. Keeps page JSX readable and gives
 * tests a stable contract for CSS and a11y.
 */

import { editionAtmosphereCanvasClassName } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';

/** Mosaic seed for `/law` browse and detail routes. */
export const LAW_EDITION_MOSAIC_SEED = 'law-edition-v6';

/** Root wrapper on law routes — pairs with law-edition.css. */
export const LAW_EDITION_ROOT_CLASS = 'ds-law-edition';

/** Default Surface edition panel. */
export const LAW_EDITION_PANEL_CLASS = 'ds-law-edition__panel';

export type LawEditionPanelVariant =
  | 'intro'
  | 'disclaimer'
  | 'browse'
  | 'about'
  | 'explainer'
  | 'provenance'
  | 'close';

export function lawEditionRootClassName(): string {
  return `${LAW_EDITION_ROOT_CLASS} ${editionAtmosphereCanvasClassName()}`;
}

export function lawEditionStackClassName(): string {
  return 'ds-law-edition__stack';
}

export function lawEditionPanelClassName(variant?: LawEditionPanelVariant): string {
  if (!variant) {
    return LAW_EDITION_PANEL_CLASS;
  }
  return `${LAW_EDITION_PANEL_CLASS} ds-law-edition__panel--${variant}`;
}
