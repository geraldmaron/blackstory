/**
 * Shared expo-linear-gradient host for brand elevation presets. All gradient rendering
 * in the mobile shell should flow through this component (or GradientPanel / GradientBackdrop)
 * so stop data from `useGradient` / `getGradient` stays consistent on iOS, Android, and web.
 */
import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import type { GradientDefinition } from './tokens';

export type BrandLinearGradientProps = {
  readonly gradient: GradientDefinition;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
};

function asGradientColors(colors: readonly string[]): LinearGradientProps['colors'] {
  return colors as [ColorValue, ColorValue, ...ColorValue[]];
}

function asGradientLocations(locations: readonly number[]): LinearGradientProps['locations'] {
  return locations as [number, number, ...number[]];
}

export function BrandLinearGradient({ gradient, style, children }: BrandLinearGradientProps) {
  return (
    <LinearGradient
      colors={asGradientColors(gradient.colors)}
      locations={asGradientLocations(gradient.locations)}
      start={gradient.start}
      end={gradient.end}
      style={[StyleSheet.absoluteFill, style]}
    >
      {children}
    </LinearGradient>
  );
}
