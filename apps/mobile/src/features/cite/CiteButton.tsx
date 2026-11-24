/**
 * The Cite control on a record and a story. It renders nothing while `CITE_ENABLED` is off.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text, useAnnounceOnChange } from '@/ui';
import { CITE_ENABLED, shareCitation, type CiteSource } from './cite';

const SHARE_FAILED = 'The share sheet could not open.';

export function CiteButton({
  source,
  enabled = CITE_ENABLED,
}: {
  readonly source: CiteSource;
  /** Defaults to the one constant. A test passes `true` to exercise the control. */
  readonly enabled?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useAnnounceOnChange(enabled && failed ? SHARE_FAILED : null);
  if (!enabled) return null;

  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Button
        label="Cite"
        variant="secondary"
        density="compact"
        accessibilityLabel={`Cite ${source.title}`}
        accessibilityHint="Opens the share sheet with MLA, APA and Chicago citations"
        onPress={() => {
          // Cleared first so a second failure in a row is announced again.
          setFailed(false);
          void shareCitation(source).then((result) => setFailed(result === 'unavailable'));
        }}
        testID="cite-button"
      />
      {failed ? (
        <Text variant="caption" colorRole="inkMuted" accessibilityLiveRegion="polite">
          {SHARE_FAILED}
        </Text>
      ) : null}
    </View>
  );
}
