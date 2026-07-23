/**
 * Root Expo Router layout (MOB-008 / repo-8b5h).
 *
 * Route tree:
 *   (tabs)/                 four primary tabs (Explore, History, Stories, More), headerShown:false
 *   data                    stack push — national Data (web `/data`), from More
 *   learn/*                 nested Stories/content stack
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
 * by `@/lib/route-params.ts` at the point of use — matching a route is necessary but not
 * sufficient; the params inside it are never trusted un-parsed.
 *
 * Composition root (repo-8b5h): AppProviders owns QueryClient + PersistQueryClientProvider,
 * bootstrap-sync on launch, App Check init, and observability wiring so features share one
 * data-layer runtime instead of independent singletons. GestureHandlerRootView wraps the
 * tree so Explore's @gorhom/bottom-sheet gestures receive a gesture root.
 */
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProviders } from '@/runtime';
import { useEditionStackScreenOptions } from '@/shell/edition-chrome';
import { useBrandFonts } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or unsupported on this platform (e.g. web) — non-fatal.
});

function EditionStack() {
  const screenOptions = useEditionStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="data"
        options={{
          title: 'Data',
          headerBackTitle: 'More',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="learn"
        options={{ headerShown: false, title: 'Stories' }}
      />
      <Stack.Screen
        name="entity/[id]"
        options={{
          title: 'Record',
          headerBackTitle: 'Back',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="filters-sheet"
        options={{ presentation: 'modal', title: 'Filters', headerShown: true }}
      />
      <Stack.Screen
        name="color-key-sheet"
        options={{ presentation: 'modal', title: 'Color key', headerShown: true }}
      />
      <Stack.Screen
        name="corrections/submit"
        options={{ presentation: 'modal', title: 'Submit a correction', headerShown: true }}
      />
      <Stack.Screen
        name="corrections/status"
        options={{ title: 'Correction status', headerBackTitle: 'Back', headerShown: true }}
      />
    </Stack>
  );
}

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
    <GestureHandlerRootView style={styles.root}>
      <AppProviders>
        <EditionStack />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
