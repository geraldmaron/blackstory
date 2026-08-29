/**
 * Archive rooms and place pages walk back to `/`. The door is BlackStory,
 * never a map label, never a sit-script place label, never a featured library name.
 */

export type WalkBackPlace = {
  readonly displayName: string;
  readonly href: '/';
};

export const MAP_BACK: WalkBackPlace = {
  displayName: 'BlackStory',
  href: '/',
};

export async function loadWalkBackPlace(): Promise<WalkBackPlace> {
  return MAP_BACK;
}
