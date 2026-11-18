/**
 * Mobile elevation tokens: the web living-archive planes
 * (`docs/ui/patterns-living-archive.md`), from the same values.
 *
 *   sheet  reading paper and record surfaces (web `--ds-shadow-sheet`)
 *   lift   a linked sheet while pressed (web `--ds-shadow-lift`)
 *   float  header, map chrome and dialogs (web `--ds-shadow-float`)
 *
 * The layers are generated from `packages/ui/src/styles/tokens.css`, so edit them there and
 * run `npm run tokens:generate`. `none` is for surfaces that sit flush with the page.
 */
import type { ViewStyle } from 'react-native';

import type { ThemeName } from './generated/colors.generated';
import { shadows } from './generated/shadows.generated';

export type ShadowLevel = 'none' | keyof typeof shadows.light;

/** Returns the React Native `boxShadow` style for a plane in the given theme. */
export function getShadowStyle(level: ShadowLevel, theme: ThemeName): ViewStyle {
  return level === 'none' ? {} : { boxShadow: shadows[theme][level] };
}
