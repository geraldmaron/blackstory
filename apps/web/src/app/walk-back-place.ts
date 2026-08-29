/**
 * Archive rooms and place pages walk back to the map door, never a featured
 * library name. The visible label is the map, the href is `/`.
 */

export type WalkBackPlace = {
  readonly displayName: string;
  readonly href: '/';
};

export const MAP_BACK: WalkBackPlace = {
  displayName: 'The map',
  href: '/',
};

export async function loadWalkBackPlace(): Promise<WalkBackPlace> {
  return MAP_BACK;
}
