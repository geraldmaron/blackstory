/**
 * Search tab — canonical mobile counterpart of web's `/search`. Bounded mobile search itself is
 * MOB-013 scope; this screen (MOB-008) wires the route surface: the `q` query param is always
 * read and written through `parseSearchQuery`, never used raw, satisfying threat-model T4 for
 * this route ("Strict ID-format validation before use" generalizes here to "strict query
 * sanitization before use" — an overlong, control-character-laden, or open-redirect-shaped `q`
 * is discarded to the empty-query default, never forwarded to a request or rendered raw).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseSearchQuery } from '../_lib/route-params';
import { EmptyState, Text, useThemeColors } from '@/ui';

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string | string[] }>();
  const activeQuery = parseSearchQuery(q);
  const [draft, setDraft] = useState(activeQuery);
  const theme = useThemeColors();

  function submit() {
    const safeQuery = parseSearchQuery(draft);
    router.setParams({ q: safeQuery });
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <View style={{ padding: 16, gap: 12, flex: 1 }}>
        <Text variant="title" isHeading>
          Search
        </Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          returnKeyType="search"
          placeholder="Search names, places, events…"
          placeholderTextColor={theme.inkMuted}
          accessibilityLabel="Search"
          maxLength={200}
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: theme.ink,
          }}
        />

        {activeQuery ? (
          <Text variant="body" colorRole="inkMuted">
            Results for “{activeQuery}” (bounded search itself lands in MOB-013).
          </Text>
        ) : (
          <EmptyState title="Search BlackStory" description="Type a name, place, or event to search." />
        )}
      </View>
    </SafeAreaView>
  );
}
