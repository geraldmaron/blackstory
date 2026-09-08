/**
 * Nested Stories stack — human titles only. Never surfaces route patterns (`stories/[slug]`) or
 * group names (`(tabs)`) in chrome.
 */
import { Stack } from 'expo-router';
import { useEditionStackScreenOptions } from '@/shell/edition-chrome';

export default function StoriesStackLayout() {
  const editionStackScreenOptions = useEditionStackScreenOptions();

  return (
    <Stack
      screenOptions={{
        ...editionStackScreenOptions,
        headerBackTitle: 'Stories',
        title: 'Stories',
      }}
    >
      <Stack.Screen name="[slug]" options={{ title: 'Story', headerBackTitle: 'Stories' }} />
    </Stack>
  );
}
