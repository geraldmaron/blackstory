/**
 * The four primary tabs: Explore, Stories, Records, More.
 *
 * Names come straight from `MOBILE_PRIMARY_TABS`, which derives them from the shared destination
 * catalog. This file used to translate one of them by hand — `name={tab.id === 'stories' ?
 * 'learn' : tab.id}` — which is how the tab bar could say "Stories" while pushing `/learn`.
 *
 * `search` and `history` are registered but hidden: both are legacy roots that still arrive as
 * deep links and as restored navigation state, and both normalize to Records while keeping the
 * reader's query.
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
          name={tab.id}
          options={{
            title: tab.label,
            tabBarIcon: editionTabIcon(tab.icon),
          }}
        />
      ))}
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
    </Tabs>
  );
}
