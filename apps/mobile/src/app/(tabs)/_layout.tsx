/**
 * Four primary tabs (MOB-008): Explore, Search, Learn, More. This mirrors a consolidation of
 * the web app's actual top-level IA (`packages/config/src/shell-nav.ts`'s `PRIMARY_NAV`:
 * Explore, Search, History, Stories, About; `OVERFLOW_NAV`: Data, Quick facts, Legal,
 * Methodology, Myths, Corrections, Errata, Submit) into four mobile tabs — a mobile IA
 * conventionally flattens a 5-primary/8-overflow desktop nav into a small, fixed tab count:
 *   - Explore  -> web's `/explore` (the map/list surface), unchanged
 *   - Search   -> web's `/search`, unchanged
 *   - Learn    -> web's learning-oriented surfaces: History, Stories, Myths, Methodology
 *   - More     -> everything else: About, Data, Quick facts, Legal, Corrections, Errata, Submit
 *
 * `index` is a hidden (href: null) redirect to `/explore` so a bare `/` (the default route Expo
 * Router needs for the group) still lands on a real, canonical tab URL rather than a distinct
 * "home" screen web has no equivalent of.
 */
import { Tabs } from 'expo-router';

import { useThemeColors } from '@/ui';

export default function TabLayout() {
  const theme = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.inkMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
