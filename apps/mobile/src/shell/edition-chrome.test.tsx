/**
 * Edition shell chrome — tab bar and stack header option hooks.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { render, renderHook } from '@testing-library/react-native';
import { BottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs';

import {
  EDITION_TAB_BAR_BODY,
  EditionTabLabel,
  editionTabIcon,
  useEditionStackScreenOptions,
  useEditionTabBarInset,
  useEditionTabBarOptions,
} from './edition-chrome';
import { CHROME_MAX_FONT_SCALE, themeColors } from '@/ui/tokens';

jest.mock('@/ui/tokens', () => {
  const actual = jest.requireActual('@/ui/tokens');
  return {
    ...actual,
    useThemeColors: () => actual.themeColors.light,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

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

  // iOS: the navigator turns label scaling off and sets the Large Content Viewer title itself.
  it('caps the label at the chrome scale on Android and leaves the iOS label to the navigator', async () => {
    const ios = await renderHook(() => useEditionTabBarOptions());
    expect(ios.result.current.tabBarLabel).toBeUndefined();

    const os = jest.replaceProperty(Platform, 'OS', 'android');
    const android = await renderHook(() => useEditionTabBarOptions());
    os.restore();
    expect(android.result.current.tabBarLabel).toBe(EditionTabLabel);

    const { getByText } = await render(
      <EditionTabLabel color="#123456" position="below-icon">
        Archive
      </EditionTabLabel>,
    );
    const label = getByText('Archive');
    expect(label.props.maxFontSizeMultiplier).toBe(CHROME_MAX_FONT_SCALE);
    expect(label.props.numberOfLines).toBe(1);
    expect((StyleSheet.flatten(label.props.style) as TextStyle).color).toBe('#123456');
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

describe('useEditionTabBarInset', () => {
  it('falls back to body height plus safe-area bottom outside a tab navigator', async () => {
    const { result } = await renderHook(() => useEditionTabBarInset());
    expect(result.current).toBe(EDITION_TAB_BAR_BODY + 34);
  });

  it('prefers measured bottom-tab bar height when context is available', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <BottomTabBarHeightContext.Provider value={83}>{children}</BottomTabBarHeightContext.Provider>
    );
    const { result } = await renderHook(() => useEditionTabBarInset(), { wrapper });
    expect(result.current).toBe(83);
  });
});
