/**
 * Pure class-name helpers for compact utility v6 edition pages: Surface card stack,
 * intro/body panels, and shared atmosphere canvas hooks (locate, submit, corrections,
 * status, not-found). Keeps page JSX readable and gives tests a stable contract.
 */

import { editionAtmosphereCanvasClassName } from '../edition-atmosphere/edition-atmosphere-canvas';

/** Root wrapper for utility edition routes — pairs with utility-edition.css. */
export const UTILITY_EDITION_ROOT_CLASS = 'ds-utility-edition';

/** Default Surface edition panel. */
export const UTILITY_EDITION_PANEL_CLASS = 'ds-utility-edition__panel';

export type UtilityEditionPanelVariant = 'intro' | 'body' | 'status';

export function utilityEditionRootClassName(): string {
  return `${UTILITY_EDITION_ROOT_CLASS} ${editionAtmosphereCanvasClassName()}`;
}

export function utilityEditionStackClassName(): string {
  return 'ds-utility-edition__stack';
}

export function utilityEditionPanelClassName(variant?: UtilityEditionPanelVariant): string {
  if (!variant) {
    return UTILITY_EDITION_PANEL_CLASS;
  }
  return `${UTILITY_EDITION_PANEL_CLASS} ds-utility-edition__panel--${variant}`;
}
