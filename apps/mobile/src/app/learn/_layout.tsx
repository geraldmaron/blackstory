/**
 * Nested Learn stack — human titles only. Never surfaces route patterns
 * (`learn/[section]/[slug]`) or group names (`(tabs)`) in chrome.
 */
import { Stack } from 'expo-router';
import { useEditionStackScreenOptions } from '@/shell/edition-chrome';

export default function LearnStackLayout() {
  const editionStackScreenOptions = useEditionStackScreenOptions();

  return (
    <Stack
      screenOptions={{
        ...editionStackScreenOptions,
        headerBackTitle: 'Stories',
        title: 'Stories',
      }}
    >
      <Stack.Screen
        name="[section]/index"
        options={{
          title: 'Stories',
          headerBackTitle: 'Stories',
        }}
      />
      <Stack.Screen
        name="[section]/[slug]"
        options={{
          title: 'Story',
          headerBackTitle: 'Stories',
        }}
      />
    </Stack>
  );
}
