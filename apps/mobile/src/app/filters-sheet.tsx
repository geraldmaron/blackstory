/**
 * Filter sheet — a modal route (`presentation: 'modal'`, set in `_layout.tsx`) opened from the
 * Explore tab's "Filters" button. Demonstrates typed + validated filter-state params and a safe
 * `returnTo` handoff: the optional `returnTo` query param is only ever honored if it passes
 * `isSafeInternalPath`/`parseReturnTo` (the app's open-redirect defense, threat-model T4) — an
 * absolute URL or unenumerated path in `returnTo` is discarded and the sheet falls back to
 * `/explore`, it is never used to navigate anywhere unvalidated.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ENTITY_KINDS, type EntityKind, parseFilterState, parseReturnTo } from './_lib/route-params';
import { Button, Text } from '@/ui';

export default function FiltersSheet() {
  const rawParams = useLocalSearchParams();
  const initialFilters = parseFilterState(rawParams as Record<string, unknown>);
  const [kind, setKind] = useState<EntityKind | undefined>(initialFilters.kind);

  // Never trust `returnTo` directly — only a value that survives the safe-route allowlist is
  // used; anything else (an external URL, an unenumerated path) silently falls back to Explore.
  const safeReturnTo = parseReturnTo(rawParams.returnTo) ?? '/explore';

  function apply() {
    router.navigate({
      pathname: safeReturnTo,
      params: kind ? { kind } : {},
    } as never);
  }

  function clear() {
    setKind(undefined);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text variant="body" colorRole="inkMuted">
        Choose a record kind to filter by. (Era filters and the full Explore filter model land in
        MOB-012 — this sheet exists to prove the modal route + typed params for MOB-008.)
      </Text>

      <View style={{ gap: 8 }}>
        {ENTITY_KINDS.map((candidate) => {
          const isSelected = candidate === kind;
          return (
            <Button
              key={candidate}
              label={isSelected ? `✓ ${candidate}` : candidate}
              // The visual "✓ " prefix is sighted-only decoration; the accessible name stays the
              // plain kind name and `accessibilityState.selected` carries the selection to
              // VoiceOver/TalkBack instead (MOB-017 — no redundant/duplicated state in the label).
              accessibilityLabel={candidate}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              variant={isSelected ? 'primary' : 'secondary'}
              onPress={() => setKind(isSelected ? undefined : candidate)}
            />
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button label="Clear" variant="ghost" onPress={clear} />
        <Button label="Apply" variant="primary" onPress={apply} />
      </View>
    </ScrollView>
  );
}
