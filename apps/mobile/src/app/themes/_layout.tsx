/**
 * Nested Themes stack — browse index + theme detail with packet stacks.
 */
import { Stack } from 'expo-router';
import { useEditionStackScreenOptions } from '@/shell/edition-chrome';

export default function ThemesStackLayout() {
  const editionStackScreenOptions = useEditionStackScreenOptions();

  return (
    <Stack
      screenOptions={{
        ...editionStackScreenOptions,
        headerBackTitle: 'Themes',
        title: 'Themes',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Themes',
          headerBackTitle: 'More',
        }}
      />
      <Stack.Screen
        name="[themeId]"
        options={{
          title: 'Theme',
          headerBackTitle: 'Themes',
        }}
      />
    </Stack>
  );
}
