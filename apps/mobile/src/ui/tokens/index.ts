/**
 * Hand-written barrel + theme resolution over the generated brand tokens.
 * This file is NOT generated — it is safe to edit. The generated/*.ts files
 * it re-exports are not (see their headers).
 *
 * Theme resolution follows the web bootstrap: explicit OS light/dark when
 * available; Archive Paper (light) when the scheme is null or unspecified.
 */
import { useColorScheme, type ColorSchemeName } from 'react-native';
import type { ViewStyle } from 'react-native';
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
import { getShadowStyle, type ShadowLevel } from './elevation';

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
  getShadowStyle,
};
export type {
  ShadowLevel,
  ConfidenceLevel,
  StatusName,
  ThemeName,
  ThemeRole,
  RadiusKey,
  SpaceKey,
  FontFamilyRole,
  TypeScaleRole,
};

/**
 * Resolves theme from an OS color scheme value. Matches web bootstrap:
 * explicit `light` / `dark` when set; Archive Paper (light) when null or
 * unspecified — no v5 dark-cockpit default outside the map plate (ADR-013).
 */
export function resolveThemeName(scheme: ColorSchemeName | null | undefined): ThemeName {
  if (scheme === 'dark') return 'dark';
  return 'light';
}

/** Resolves the active theme name from the system color scheme. */
export function useThemeName(): ThemeName {
  return resolveThemeName(useColorScheme());
}

/** Shadow style for the active theme — default to `none` (flat matte). */
export function useShadowStyle(level: ShadowLevel): ViewStyle {
  return getShadowStyle(level, useThemeName());
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
