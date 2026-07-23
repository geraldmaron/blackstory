/**
 * Shared brand elevation gradient host. Prefer this (or GradientPanel) over raw
 * expo-linear-gradient so stop data stays consistent. When the native
 * LinearGradient view is missing (Expo Go / stale native binary), falls back to
 * a flat matte fill from the first gradient stop so screens never crash with
 * "Unimplemented component: ViewManagerAdapter_ExpoLinearGradient".
 */
import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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

/** Native LinearGradient is unreliable outside a rebuilt Expo dev client. */
function canUseNativeGradient(): boolean {
  // Web uses CSS under the hood and is fine.
  if (Platform.OS === 'web') return true;
  // Prefer matte fill on native until the binary ships the view manager —
  // crash overlay is worse than losing a subtle elevation wash.
  return false;
}

export function BrandLinearGradient({ gradient, style, children }: BrandLinearGradientProps) {
  const fill = gradient.colors[0] ?? '#F4EFE5';

  if (!canUseNativeGradient()) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }, style]}>{children}</View>
    );
  }

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
