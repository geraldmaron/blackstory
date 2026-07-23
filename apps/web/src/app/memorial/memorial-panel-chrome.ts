/**
 * Class-name helpers for the Memorial v6 edition: Surface stack over a names-only
 * memorial wall atmosphere (no photo mosaic).
 */

export const MEMORIAL_EDITION_WALL_SEED = 'memorial-edition-v6';

export const MEMORIAL_EDITION_ROOT_CLASS = 'ds-memorial-edition';

export const MEMORIAL_EDITION_PANEL_CLASS = 'ds-memorial-edition__panel';

export type MemorialEditionPanelVariant = 'intro' | 'list' | 'close';

export function memorialEditionRootClassName(): string {
  return MEMORIAL_EDITION_ROOT_CLASS;
}

export function memorialEditionStackClassName(): string {
  return 'ds-memorial-edition__stack';
}

export function memorialEditionPanelClassName(variant?: MemorialEditionPanelVariant): string {
  if (!variant) {
    return MEMORIAL_EDITION_PANEL_CLASS;
  }
  return `${MEMORIAL_EDITION_PANEL_CLASS} ds-memorial-edition__panel--${variant}`;
}
