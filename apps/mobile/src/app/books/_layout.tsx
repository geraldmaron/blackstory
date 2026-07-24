/**
 * Nested Banned books stack — browse index + title detail.
 */
import { Stack } from 'expo-router';
import { useEditionStackScreenOptions } from '@/shell/edition-chrome';

export default function BooksStackLayout() {
  const editionStackScreenOptions = useEditionStackScreenOptions();

  return (
    <Stack
      screenOptions={{
        ...editionStackScreenOptions,
        headerBackTitle: 'Books',
        title: 'Banned books',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Banned books',
          headerBackTitle: 'More',
        }}
      />
      <Stack.Screen
        name="[slug]"
        options={{
          title: 'Book',
          headerBackTitle: 'Books',
        }}
      />
    </Stack>
  );
}
