/**
 * The app has one elevation: `float`, for a sheet over the map (docs/ui/DESIGN.md section 7.4).
 * Nothing on a paper screen casts a shadow.
 *
 * The layers are generated from `packages/ui/src/styles/tokens.css` (web `--ds-shadow-float`), so
 * edit them there and run `npm run tokens:generate`.
 */
import type { ViewStyle } from 'react-native';

import type { ThemeName } from './generated/colors.generated';
import { shadows } from './generated/shadows.generated';

/** The React Native `boxShadow` style for a sheet floating over the map. */
export function getFloatShadowStyle(theme: ThemeName): ViewStyle {
  return { boxShadow: shadows[theme].float };
}
