/**
 * Mobile-only elevation primitives: soft brand shadows and subtle gradients.
 *
 * Intentional exception to the global flat-matte rule (web + logo remain flat).
 * Shadows use ebonyInk/black at low opacity; gradients stay within brand canvas
 * roles with copper reserved for tiny edge accent stops only.
 */
import { Platform, type ViewStyle } from 'react-native';

import { brandCore, themeColors, type ThemeName } from './generated/colors.generated';

/** Shadow tiers for cards, sheets, and floating chrome. `none` clears elevation. */
export type ShadowLevel = 'none' | 'sm' | 'md' | 'lg';

/** Named gradient presets for sibling screens (consume with expo-linear-gradient or equivalent). */
export type GradientName = 'surfaceLift' | 'canvasDepth' | 'panelAtmosphere' | 'copperAccentEdge';

export type GradientDefinition = {
  readonly colors: readonly string[];
  readonly locations: readonly number[];
  readonly start: { readonly x: number; readonly y: number };
  readonly end: { readonly x: number; readonly y: number };
};

const SHADOW_COLOR: Record<ThemeName, string> = {
  light: brandCore.ebonyInk,
  dark: brandCore.ebonyInk,
};

const SHADOW_SPECS: Record<
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

/** Returns a React Native shadow style for the given tier and theme. Safe to spread onto `View`. */
export function getShadowStyle(level: ShadowLevel, theme: ThemeName): ViewStyle {
  if (level === 'none') {
    return {};
  }

  const spec = SHADOW_SPECS[level];
  const style: ViewStyle = {
    shadowColor: SHADOW_COLOR[theme],
    shadowOffset: { width: 0, height: spec.offsetY },
    shadowOpacity: spec.opacity[theme],
    shadowRadius: spec.radius,
  };

  if (Platform.OS === 'android') {
    style.elevation = spec.elevation;
  }

  return style;
}

/** Returns gradient stop data for the named preset. Does not render — siblings supply the gradient host. */
export function getGradient(name: GradientName, theme: ThemeName): GradientDefinition {
  const palette = themeColors[theme];

  switch (name) {
    case 'surfaceLift':
      return {
        colors: [palette.canvas, palette.surface],
        locations: [0, 1],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
      };
    case 'canvasDepth':
      return {
        colors: [palette.surfaceRaised, palette.canvas, palette.canvas],
        locations: [0, 0.35, 1],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
      };
    case 'panelAtmosphere':
      return theme === 'light'
        ? {
            colors: [palette.canvas, palette.surface, palette.surfaceRaised],
            locations: [0, 0.55, 1],
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
          }
        : {
            colors: [palette.canvas, palette.surface, palette.surfaceRaised],
            locations: [0, 0.5, 1],
            start: { x: 0, y: 0 },
            end: { x: 0, y: 1 },
          };
    case 'copperAccentEdge':
      return {
        colors: [palette.surface, palette.surface, palette.accentGraphic],
        locations: [0, 0.93, 1],
        start: { x: 0, y: 0.5 },
        end: { x: 1, y: 0.5 },
      };
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}
