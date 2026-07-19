/**
 * Root Expo Router layout (MOB-008).
 *
 * Route tree:
 *   (tabs)/                 four primary tabs (Explore, Search, Learn, More), headerShown:false
 *   entity/[id]             stack push over the tabs, reachable from any tab
 *   filters-sheet           modal presentation (Explore filter sheet)
 *   corrections/submit      modal presentation (correction-submission sheet stub)
 *   +not-found              catch-all for any unmatched/unrecognized path — see below
 *
 * Deep-link safety (threat-model T4): Expo Router only ever matches an incoming URL against
 * this explicit, enumerated file tree — there is no dynamic string-dispatch anywhere in this
 * app. Any path that doesn't match one of the routes above (unknown host, unknown path, or a
 * malformed one) falls through to `+not-found.tsx`, which redirects to the safe default surface
 * (the Explore tab) rather than rendering a raw 404 or attempting to interpret the string.
 * Parameters *within* a matched route (the entity id, search query, filter state) are validated
 * by `./_lib/route-params.ts` at the point of use — matching a route is necessary but not
 * sufficient; the params inside it are never trusted un-parsed.
 */
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useBrandFonts } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or unsupported on this platform (e.g. web) — non-fatal.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useBrandFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="entity/[id]" options={{ title: 'Record', headerShown: true }} />
      <Stack.Screen
        name="filters-sheet"
        options={{ presentation: 'modal', title: 'Filters', headerShown: true }}
      />
      <Stack.Screen
        name="corrections/submit"
        options={{ presentation: 'modal', title: 'Submit a correction', headerShown: true }}
      />
    </Stack>
  );
}
