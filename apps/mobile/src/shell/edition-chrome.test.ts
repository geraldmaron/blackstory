/**
 * Edition shell chrome — tab bar and stack header option hooks.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { renderHook } from '@testing-library/react-native';

import { editionTabIcon, useEditionStackScreenOptions, useEditionTabBarOptions } from './edition-chrome';
import { themeColors } from '@/ui/tokens';

jest.mock('@/ui/tokens', () => {
  const actual = jest.requireActual('@/ui/tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
  };
});

describe('useEditionTabBarOptions', () => {
  it('uses matte Surface plate and copper active tint', async () => {
    const { result } = await renderHook(() => useEditionTabBarOptions());
    const light = themeColors.light;

    const tabBarStyle = StyleSheet.flatten(result.current.tabBarStyle) as ViewStyle;

    expect(result.current.tabBarActiveTintColor).toBe(light.accent);
    expect(result.current.tabBarInactiveTintColor).toBe(light.inkMuted);
    expect(tabBarStyle.backgroundColor).toBe(light.surface);
    expect(tabBarStyle.borderTopColor).toBe(light.border);
    expect(result.current.headerShown).toBe(false);
  });
});

describe('useEditionStackScreenOptions', () => {
  it('uses canvas header fill and ink title', async () => {
    const { result } = await renderHook(() => useEditionStackScreenOptions());
    const light = themeColors.light;

    const headerStyle = StyleSheet.flatten(result.current.headerStyle) as ViewStyle;
    const headerTitleStyle = StyleSheet.flatten(result.current.headerTitleStyle) as TextStyle;
    const contentStyle = StyleSheet.flatten(result.current.contentStyle) as ViewStyle;

    expect(headerStyle.backgroundColor).toBe(light.canvas);
    expect(result.current.headerTintColor).toBe(light.accent);
    expect(headerTitleStyle.color).toBe(light.ink);
    expect(result.current.headerShadowVisible).toBe(false);
    expect(contentStyle.backgroundColor).toBe(light.canvas);
  });
});

describe('editionTabIcon', () => {
  it('returns a render function for tab slots', () => {
    const renderer = editionTabIcon('explore');
    expect(typeof renderer).toBe('function');
  });
});
