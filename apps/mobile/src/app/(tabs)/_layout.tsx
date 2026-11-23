/**
 * The four primary tabs: Archive, Stories, Data, More (docs/ui/DESIGN.md section 11).
 *
 * Names come straight from `MOBILE_PRIMARY_TABS`.
 *
 * `explore`, `records`, `search` and `history` are registered but hidden: each was a tab or a
 * tab root once and still arrives as a deep link and as restored navigation state. Each
 * redirects into the Archive and keeps the reader's query.
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
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="records" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
    </Tabs>
  );
}
