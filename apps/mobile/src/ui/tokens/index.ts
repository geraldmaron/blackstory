/**
 * Hand-written barrel + theme resolution over the generated brand tokens.
 * This file is NOT generated — it is safe to edit. The generated/*.ts files
 * it re-exports are not (see their headers).
 */
import { useColorScheme } from 'react-native';
import {
  brandCore,
  confidenceColors,
  statusColors,
  themeColors,
  type ConfidenceLevel,
  type StatusName,
  type ThemeName,
  type ThemeRole,
} from './generated/colors.generated';
import { radius, type RadiusKey } from './generated/radius.generated';
import { space, type SpaceKey } from './generated/spacing.generated';
import {
  duration,
  easingStandardBezier,
  easingStandardCss,
} from './generated/motion.generated';
import {
  fontFamilies,
  typeScale,
  type FontFamilyRole,
  type TypeScaleRole,
} from './generated/typography.generated';
import { logoConstraints } from './generated/logo.generated';

export {
  brandCore,
  confidenceColors,
  statusColors,
  themeColors,
  radius,
  space,
  duration,
  easingStandardBezier,
  easingStandardCss,
  fontFamilies,
  typeScale,
  logoConstraints,
};
export type {
  ConfidenceLevel,
  StatusName,
  ThemeName,
  ThemeRole,
  RadiusKey,
  SpaceKey,
  FontFamilyRole,
  TypeScaleRole,
};

/** Resolves the active theme's role palette from the system color scheme. Defaults to light. */
export function useThemeName(): ThemeName {
  const scheme = useColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}

/** Resolves the full semantic color-role palette for the active color scheme. */
export function useThemeColors(): ThemeRole {
  return themeColors[useThemeName()];
}

/** Resolves status (warning/dispute/error) colors for the active color scheme. */
export function useStatusColors() {
  return statusColors[useThemeName()];
}

/** Resolves confidence-level colors for the active color scheme. */
export function useConfidenceColors() {
  return confidenceColors[useThemeName()];
}
