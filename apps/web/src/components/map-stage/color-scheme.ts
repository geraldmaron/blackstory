import { brandPalette, darkTheme, lightTheme } from '@repo/ui';
import type { MapColorScheme } from '../../lib/map-experience/dignity-style';
import * as stateLabels from '../../lib/map-experience/state-labels';

export function readDocumentColorScheme(): MapColorScheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Theme-aware label colors; prefers `stateLabelColorsForScheme` from state-labels when exported. */
export function stateLabelColorFor(scheme: MapColorScheme, selected: boolean): string {
  const colorsForScheme = (
    stateLabels as {
      stateLabelColorsForScheme?: (colorScheme: MapColorScheme) => {
        readonly muted: string;
        readonly selected: string;
      };
    }
  ).stateLabelColorsForScheme;
  if (colorsForScheme) {
    const colors = colorsForScheme(scheme);
    return selected ? colors.selected : colors.muted;
  }
  const theme = scheme === 'light' ? lightTheme : darkTheme;
  return selected ? brandPalette.copperDark : theme.inkMuted;
}
