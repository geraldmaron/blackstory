/**
 * Edition shell chrome — tab bar, stack headers, and shared navigation styling.
 * Single source for v6 mobile shell tokens; tab and stack layouts consume these
 * hooks instead of Expo defaults with an ad-hoc tint.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { BottomTabNavigationOptions } from 'expo-router/build/react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from 'expo-router/build/react-navigation/native-stack';

import { NavIcon, type NavIconName } from '@/ui/NavIcon';
import { resolveFontFamily } from '@/ui/fonts';
import { useThemeColors } from '@/ui/tokens';

const TAB_LABEL_SIZE = 11;

/** Bottom tab bar options — matte Surface plate, copper active, Inter labels. */
export function useEditionTabBarOptions(): BottomTabNavigationOptions {
  const theme = useThemeColors();

  return {
    headerShown: false,
    tabBarActiveTintColor: theme.accent,
    tabBarInactiveTintColor: theme.inkMuted,
    tabBarStyle: {
      backgroundColor: theme.surface,
      borderTopColor: theme.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      ...(Platform.OS === 'android' ? { elevation: 0 } : {}),
      shadowOpacity: 0,
    },
    tabBarLabelStyle: {
      fontFamily: resolveFontFamily('uiBody', '500'),
      fontSize: TAB_LABEL_SIZE,
      fontWeight: '500',
    },
  };
}

/** Stack push/modal headers — canvas fill, ink titles, copper back/actions. */
export function useEditionStackScreenOptions(): NativeStackNavigationOptions {
  const theme = useThemeColors();

  return {
    headerLargeTitle: false,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: theme.canvas },
    headerTintColor: theme.accent,
    headerTitleStyle: {
      color: theme.ink,
      fontFamily: resolveFontFamily('uiBody', '600'),
      fontSize: 17,
    },
    contentStyle: { backgroundColor: theme.canvas },
  };
}

export type EditionTabIconProps = {
  readonly name: NavIconName;
  readonly focused: boolean;
  readonly size?: number;
};

/** Tab bar icon slot — copper when selected, stone when idle. */
export function EditionTabIcon({ name, focused, size = 20 }: EditionTabIconProps) {
  return <NavIcon name={name} size={size} selected={focused} />;
}

export type EditionTabIconRenderer = (props: {
  focused: boolean;
  size: number;
}) => ReactNode;

/** Factory for Expo Router `tabBarIcon` slots. */
export function editionTabIcon(name: NavIconName): EditionTabIconRenderer {
  function EditionTabIconSlot({ focused, size }: { focused: boolean; size: number }) {
    return <EditionTabIcon name={name} focused={focused} size={size} />;
  }
  EditionTabIconSlot.displayName = `EditionTabIcon(${name})`;
  return EditionTabIconSlot;
}
