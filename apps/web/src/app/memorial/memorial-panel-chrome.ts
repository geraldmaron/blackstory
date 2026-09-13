/**
 * Class-name helpers for the memorial room: the wall seed and the root class.
 *
 * A frame around a list of names is chrome asserting itself over them.
 */

export const MEMORIAL_EDITION_WALL_SEED = 'memorial-edition-v6';

export const MEMORIAL_EDITION_ROOT_CLASS = 'ds-memorial-edition';

export function memorialEditionRootClassName(): string {
  return MEMORIAL_EDITION_ROOT_CLASS;
}

export function memorialEditionStackClassName(): string {
  return 'ds-memorial-edition__stack';
}
