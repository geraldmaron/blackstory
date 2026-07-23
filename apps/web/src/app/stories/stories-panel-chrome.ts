/**
 * Pure class-name helpers for Stories v6 edition panels: Surface card stack, beat
 * variants, and shared atmosphere canvas hooks. Keeps page JSX readable and gives
 * tests a stable contract for CSS and a11y.
 */

import { editionAtmosphereCanvasClassName } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';

/** Mosaic seed for stories routes (index, article, credits). */
export const STORIES_EDITION_MOSAIC_SEED = 'stories-edition-v6';

/** Root wrapper on stories routes — pairs with stories-edition.css. */
export const STORIES_EDITION_ROOT_CLASS = 'ds-stories-edition';

/** Default Surface edition panel. */
export const STORIES_EDITION_PANEL_CLASS = 'ds-stories-edition__panel';

export type StoriesEditionPanelVariant =
  | 'intro'
  | 'catalog'
  | 'records'
  | 'body'
  | 'sources'
  | 'credits';

export function storiesEditionRootClassName(): string {
  return `${STORIES_EDITION_ROOT_CLASS} ${editionAtmosphereCanvasClassName()}`;
}

export function storiesEditionStackClassName(): string {
  return 'ds-stories-edition__stack';
}

export function storiesEditionPanelClassName(variant?: StoriesEditionPanelVariant): string {
  if (!variant) {
    return STORIES_EDITION_PANEL_CLASS;
  }
  return `${STORIES_EDITION_PANEL_CLASS} ds-stories-edition__panel--${variant}`;
}
