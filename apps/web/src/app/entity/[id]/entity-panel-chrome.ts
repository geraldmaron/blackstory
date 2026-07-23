/**
 * Pure class-name helpers for Entity v6 edition panels: Surface card stack, beat
 * variants, and shared atmosphere canvas hooks. Keeps page JSX readable and gives
 * tests a stable contract for CSS and a11y.
 */

import { editionAtmosphereCanvasClassName } from '../../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';

/** Mosaic seed prefix for entity routes (per-id suffix on detail). */
export const ENTITY_EDITION_MOSAIC_SEED = 'entity-edition-v6';

/** Root wrapper on entity routes — pairs with entity-edition.css. */
export const ENTITY_EDITION_ROOT_CLASS = 'ds-entity-edition';

/** Default Surface edition panel. */
export const ENTITY_EDITION_PANEL_CLASS = 'ds-entity-edition__panel';

export type EntityEditionPanelVariant =
  | 'intro'
  | 'anatomy'
  | 'relevance'
  | 'context'
  | 'reading'
  | 'status'
  | 'claims'
  | 'timeline'
  | 'connected'
  | 'provenance';

export function entityEditionRootClassName(): string {
  return `${ENTITY_EDITION_ROOT_CLASS} ${editionAtmosphereCanvasClassName()}`;
}

export function entityEditionStackClassName(): string {
  return 'ds-entity-edition__stack';
}

export function entityEditionPanelClassName(variant?: EntityEditionPanelVariant): string {
  if (!variant) {
    return ENTITY_EDITION_PANEL_CLASS;
  }
  return `${ENTITY_EDITION_PANEL_CLASS} ds-entity-edition__panel--${variant}`;
}

export function entityEditionMosaicSeedFor(id: string): string {
  return `${ENTITY_EDITION_MOSAIC_SEED}:${id}`;
}
