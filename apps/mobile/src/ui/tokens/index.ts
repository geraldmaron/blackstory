/**
 * Hand-written barrel + theme resolution over the generated brand tokens.
 * This file is NOT generated — it is safe to edit. The generated/*.ts files
 * it re-exports are not (see their headers).
 *
 * Theme resolution is dark-first: when the OS color scheme is null or
 * unspecified, consumers resolve to the dark palette (see resolveThemeName).
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
import {
  getGradient,
  getShadowStyle,
  type GradientDefinition,
  type GradientName,
  type ShadowLevel,
} from './elevation';

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
  getGradient,
  getShadowStyle,
};
export type {
  GradientDefinition,
  GradientName,
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
 * Resolves theme from an OS color scheme value. Dark-first: only an explicit
 * `'light'` scheme selects the light palette; null/undefined/dark → dark.
 */
export function resolveThemeName(scheme: ColorSchemeName | null | undefined): ThemeName {
  return scheme === 'light' ? 'light' : 'dark';
}

/** Resolves the active theme name from the system color scheme (dark-first default). */
export function useThemeName(): ThemeName {
  return resolveThemeName(useColorScheme());
}

/** Shadow style for the active theme — spread onto any View that needs controlled lift. */
export function useShadowStyle(level: ShadowLevel): ViewStyle {
  return getShadowStyle(level, useThemeName());
}

/** Gradient preset for the active theme — consumed by `BrandLinearGradient` / `GradientPanel`. */
export function useGradient(name: GradientName): GradientDefinition {
  return getGradient(name, useThemeName());
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
