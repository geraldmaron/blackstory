import type { MapColorScheme } from '../../lib/map-experience/dignity-style';

export function readDocumentColorScheme(): MapColorScheme {
  // v11: the world is always night (design-direction-v11.md §1). The reader's light or dark
  // choice governs the reading sheets, never the plate.
  return 'dark';
}
