/**
 * Nested Learn stack — human titles only. Never surfaces route patterns
 * (`learn/[section]/[slug]`) or group names (`(tabs)`) in chrome.
 */
import { Stack } from 'expo-router';

const compactHeader = {
  headerLargeTitle: false,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
  headerTitleStyle: { fontSize: 17 },
};

export default function LearnStackLayout() {
  return (
    <Stack
      screenOptions={{
        ...compactHeader,
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
