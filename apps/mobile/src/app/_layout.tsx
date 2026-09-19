/**
 * Root Expo Router layout. Enumerated routes govern deep links; unmatched paths use the safe
 * not-found route and matched parameters are validated by their destinations. AppProviders owns
 * bootstrap, transport and observability so routes share one runtime.
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
      <Stack.Screen name="books" options={{ headerShown: false, title: 'Banned books' }} />
      <Stack.Screen name="law" options={{ headerShown: false, title: 'Law' }} />
      <Stack.Screen
        name="memorial"
        options={{
          title: 'Memorial',
          headerBackTitle: 'More',
          headerShown: true,
        }}
      />
      <Stack.Screen name="themes" options={{ headerShown: false, title: 'Themes' }} />
      <Stack.Screen
        name="submit"
        options={{
          title: 'Submit',
          headerBackTitle: 'More',
          headerShown: true,
        }}
      />
      {/* The Stories stack owns its own header; the group renders none of its own. Leaving a
          route unregistered here is what made `/stories/{slug}` show the raw segment "stories"
          as a title with a second back chevron under the stack's own. */}
      <Stack.Screen name="stories" options={{ headerShown: false, title: 'Stories' }} />
      <Stack.Screen name="about" options={{ title: 'About', headerBackTitle: 'More' }} />
      <Stack.Screen name="faq" options={{ title: 'Questions', headerBackTitle: 'More' }} />
      <Stack.Screen
        name="methodology"
        options={{ title: 'Methodology', headerBackTitle: 'More' }}
      />
      <Stack.Screen name="errata" options={{ title: 'Errata', headerBackTitle: 'More' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy', headerBackTitle: 'More' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms', headerBackTitle: 'More' }} />
      <Stack.Screen name="support" options={{ title: 'Support', headerBackTitle: 'More' }} />
      {/* Legacy `/learn/...` addresses redirect on mount and render nothing. */}
      <Stack.Screen name="learn" options={{ headerShown: false }} />
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
