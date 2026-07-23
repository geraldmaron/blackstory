/**
 * Four primary tabs (MOB-008): Explore, Search, Learn, More. Quiet matte bar
 * with copper active tint — no heavy elevation wash.
 */
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, type ColorValue } from 'react-native';

import { NavIcon, type NavIconName, useThemeColors } from '@/ui';

function tabIcon(name: NavIconName) {
  return ({ size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <NavIcon name={name} size={size} selected={focused} />
  );
}

export default function TabLayout() {
  const theme = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.inkMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'android' ? { elevation: 0 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Explore', tabBarIcon: tabIcon('explore') }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Search', tabBarIcon: tabIcon('search') }}
      />
      <Tabs.Screen
        name="learn"
        options={{ title: 'Stories', tabBarIcon: tabIcon('stories') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: tabIcon('more') }}
      />
    </Tabs>
  );
}
