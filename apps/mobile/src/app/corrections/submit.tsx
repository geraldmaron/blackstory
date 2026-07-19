/**
 * Correction-submission sheet stub — a modal route (`presentation: 'modal'`), reachable from the
 * More tab and, in the future, from an entity record's own correction CTA (MOB-014/MOB-016).
 *
 * Program invariant 7 / this bead's requirement #7: correction content and precise location are
 * NEVER encoded in a URL parameter. The only route params this screen accepts are an optional
 * `entityId` (context — which record the correction is about, validated the same way the entity
 * detail route validates it) and an optional `returnTo` (validated against the safe-route
 * allowlist, same as the filter sheet). The correction text itself lives only in local component
 * state and would be POSTed by MOB-016's real submission flow (through `apps/api-public`, with
 * App Check attestation) — it never becomes a query string, and this screen has no
 * `router.push`/`setParams` call anywhere near the free-text field, by design.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { parseEntityId, parseReturnTo } from '../_lib/route-params';
import { Button, Notice, Text, useThemeColors } from '@/ui';

export default function CorrectionsSubmitSheet() {
  const params = useLocalSearchParams<{ entityId?: string | string[]; returnTo?: string | string[] }>();
  const entityId = parseEntityId(params.entityId);
  const safeReturnTo = parseReturnTo(params.returnTo) ?? '/more';
  const theme = useThemeColors();

  // Local-only state. Deliberately never passed through router.push/setParams/any URL —
  // see the module docblock.
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    // Stub: MOB-016 wires the real POST to apps/api-public with App Check attestation and
    // returns an opaque receipt id. Nothing here reaches a URL, a log, or a crash report.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Notice
          tone="info"
          title="Correction queued"
          description="Real submission and opaque receipt status are MOB-016 scope."
        />
        <Button label="Done" variant="primary" onPress={() => router.replace(safeReturnTo as never)} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {entityId ? (
        <Text variant="body" colorRole="inkMuted">
          About record: {entityId}
        </Text>
      ) : (
        <Text variant="body" colorRole="inkMuted">
          General correction (no specific record context).
        </Text>
      )}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Describe the correction…"
        placeholderTextColor={theme.inkMuted}
        multiline
        numberOfLines={6}
        maxLength={4000}
        accessibilityLabel="Correction details"
        style={{
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 8,
          padding: 12,
          minHeight: 140,
          textAlignVertical: 'top',
          color: theme.ink,
        }}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        <Button
          label="Submit"
          variant="primary"
          disabled={draft.trim().length === 0}
          onPress={submit}
        />
      </View>
    </ScrollView>
  );
}
