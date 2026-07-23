/**
 * Mobile elevation tokens — flat matte per web `--ds-elevation-*: none`.
 *
 * Browse and shell surfaces use hairline borders only. Map floating instruments
 * may opt into `sm` shadow via ADR-013 explore chrome; default is always flat.
 */
import { Platform, type ViewStyle } from 'react-native';

import { brandCore, type ThemeName } from './generated/colors.generated';

/** Shadow tiers — `none` is the default everywhere except explicit map chrome. */
export type ShadowLevel = 'none' | 'sm' | 'md' | 'lg';

const MAP_CHROME_SHADOW: Record<
  Exclude<ShadowLevel, 'none'>,
  {
    offsetY: number;
    radius: number;
    opacity: Record<ThemeName, number>;
    elevation: number;
  }
> = {
  sm: {
    offsetY: 1,
    radius: 3,
    opacity: { light: 0.06, dark: 0.32 },
    elevation: 2,
  },
  md: {
    offsetY: 4,
    radius: 8,
    opacity: { light: 0.08, dark: 0.4 },
    elevation: 4,
  },
  lg: {
    offsetY: 8,
    radius: 16,
    opacity: { light: 0.1, dark: 0.48 },
    elevation: 8,
  },
};

/** Returns a React Native shadow style. Browse/shell surfaces pass `none` (default). */
export function getShadowStyle(level: ShadowLevel, theme: ThemeName): ViewStyle {
  if (level === 'none') {
    return {};
  }

  const spec = MAP_CHROME_SHADOW[level];
  const style: ViewStyle = {
    shadowColor: brandCore.ebonyInk,
    shadowOffset: { width: 0, height: spec.offsetY },
    shadowOpacity: spec.opacity[theme],
    shadowRadius: spec.radius,
  };

  if (Platform.OS === 'android') {
    style.elevation = spec.elevation;
  }

  return style;
}
