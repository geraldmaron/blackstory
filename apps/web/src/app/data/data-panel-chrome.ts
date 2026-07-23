/**
 * Pure class-name helpers for Data v6 edition panels: Surface card stack, beat
 * variants, and shared atmosphere canvas hooks. Keeps page JSX readable and gives
 * tests a stable contract for CSS and a11y.
 */

import { editionAtmosphereCanvasClassName } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';

/** Mosaic seed for `/data` (distinct scatter from home, about, and stories). */
export const DATA_EDITION_MOSAIC_SEED = 'data-edition-v6';

/** Root wrapper on `/data` — pairs with data-edition.css. */
export const DATA_EDITION_ROOT_CLASS = 'ds-data-edition';

/** Default Surface edition panel. */
export const DATA_EDITION_PANEL_CLASS = 'ds-data-edition__panel';

export type DataEditionPanelVariant =
  | 'intro'
  | 'orientation'
  | 'population'
  | 'wealth'
  | 'housing'
  | 'justice'
  | 'themes'
  | 'next';

export function dataEditionRootClassName(): string {
  return `${DATA_EDITION_ROOT_CLASS} ${editionAtmosphereCanvasClassName()}`;
}

export function dataEditionStackClassName(): string {
  return 'ds-data-edition__stack';
}

export function dataEditionPanelClassName(variant?: DataEditionPanelVariant): string {
  if (!variant) {
    return DATA_EDITION_PANEL_CLASS;
  }
  return `${DATA_EDITION_PANEL_CLASS} ds-data-edition__panel--${variant}`;
}
