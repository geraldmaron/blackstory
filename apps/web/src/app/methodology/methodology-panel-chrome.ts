/**
 * Pure class-name helpers for Methodology v6 edition panels: Surface card stack,
 * beat variants, and shared atmosphere canvas hooks.
 */

import { editionAtmosphereCanvasClassName } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';

/** Mosaic seed for `/methodology` (distinct scatter from home, about, stories). */
export const METHODOLOGY_EDITION_MOSAIC_SEED = 'methodology-edition-v6';

/** Root wrapper on `/methodology` — pairs with methodology-edition.css. */
export const METHODOLOGY_EDITION_ROOT_CLASS = 'ds-methodology-edition';

/** Default Surface edition panel. */
export const METHODOLOGY_EDITION_PANEL_CLASS = 'ds-methodology-edition__panel';

export type MethodologyEditionPanelVariant =
  | 'intro'
  | 'mission'
  | 'evidence'
  | 'pipeline'
  | 'how-to-read'
  | 'definitions'
  | 'sources'
  | 'standards'
  | 'operations'
  | 'close';

export function methodologyEditionRootClassName(): string {
  return `${METHODOLOGY_EDITION_ROOT_CLASS} ${editionAtmosphereCanvasClassName()}`;
}

export function methodologyEditionStackClassName(): string {
  return 'ds-methodology-edition__stack';
}

export function methodologyEditionPanelClassName(
  variant?: MethodologyEditionPanelVariant,
): string {
  if (!variant) {
    return METHODOLOGY_EDITION_PANEL_CLASS;
  }
  return `${METHODOLOGY_EDITION_PANEL_CLASS} ds-methodology-edition__panel--${variant}`;
}
