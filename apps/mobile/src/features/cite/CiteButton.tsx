/**
 * The Cite control on a record and a story. It renders nothing while `CITE_ENABLED` is off.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/ui';
import { CITE_ENABLED, shareCitation, type CiteSource } from './cite';

export function CiteButton({
  source,
  enabled = CITE_ENABLED,
}: {
  readonly source: CiteSource;
  /** Defaults to the one constant. A test passes `true` to exercise the control. */
  readonly enabled?: boolean;
}) {
  const [failed, setFailed] = useState(false);
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
          void shareCitation(source).then((result) => setFailed(result === 'unavailable'));
        }}
        testID="cite-button"
      />
      {failed ? (
        <Text variant="caption" colorRole="inkMuted" accessibilityLiveRegion="polite">
          The share sheet could not open.
        </Text>
      ) : null}
    </View>
  );
}
