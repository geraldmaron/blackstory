/**
 * Nested Law stack — browse index + entry detail.
 */
import { Stack } from 'expo-router';
import { useEditionStackScreenOptions } from '@/shell/edition-chrome';

export default function LawStackLayout() {
  const editionStackScreenOptions = useEditionStackScreenOptions();

  return (
    <Stack
      screenOptions={{
        ...editionStackScreenOptions,
        headerBackTitle: 'Law',
        title: 'Law',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Law',
          headerBackTitle: 'More',
        }}
      />
      <Stack.Screen
        name="[slug]"
        options={{
          title: 'Law entry',
          headerBackTitle: 'Law',
        }}
      />
    </Stack>
  );
}
