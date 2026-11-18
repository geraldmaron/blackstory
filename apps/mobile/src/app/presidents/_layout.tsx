/**
 * `/presidents` stack: the list and each entry. Mirrors the site's addresses.
 */
import { Stack } from 'expo-router';
import { useEditionStackScreenOptions } from '@/shell/edition-chrome';

export default function PresidentsStackLayout() {
  const editionStackScreenOptions = useEditionStackScreenOptions();
  return (
    <Stack
      screenOptions={{ ...editionStackScreenOptions, headerBackTitle: 'Presidents', title: 'Presidents' }}
    >
      <Stack.Screen name="index" options={{ title: 'Presidents', headerBackTitle: 'More' }} />
      <Stack.Screen name="[slug]" options={{ title: 'President', headerBackTitle: 'Presidents' }} />
    </Stack>
  );
}
