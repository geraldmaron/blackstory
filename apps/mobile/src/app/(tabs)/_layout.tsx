/**
 * Four primary tabs (v6 mobile shell): Explore, History, Stories, More.
 * Edition tab bar from `shell/edition-chrome.tsx` — not Expo template defaults.
 */
import { Tabs } from 'expo-router';

import { editionTabIcon, useEditionTabBarOptions } from '@/shell/edition-chrome';
import { MOBILE_PRIMARY_TABS } from '@/shell/mobile-nav';

export default function TabLayout() {
  const tabBarOptions = useEditionTabBarOptions();

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="index" options={{ href: null }} />
      {MOBILE_PRIMARY_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.id}
          name={tab.id === 'stories' ? 'learn' : tab.id}
          options={{
            title: tab.label,
            tabBarIcon: editionTabIcon(tab.icon),
          }}
        />
      ))}
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}
