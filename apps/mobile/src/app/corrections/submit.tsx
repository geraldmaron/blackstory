/**
 * Correction hand-off. Corrections are filed on the website: no public API host accepts them
 * from the phone, and the web form owns intake, receipts and status. Only a validated entityId
 * enters the URL; correction text never leaves the web form.
 */
import { useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { CANONICAL_WEB_ORIGIN } from '@/features/entity/share';
import { parseEntityId, parseReturnTo } from '@/lib/route-params';
import { Button, Text, UtilityScreenShell, space } from '@/ui';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

function correctionsWebUrl(entityId: string | null): string {
  const url = new URL('/corrections', CANONICAL_WEB_ORIGIN);
  if (entityId) {
    url.searchParams.set('target', entityId);
    url.searchParams.set('targetType', 'entity');
  }
  return url.toString();
}

export default function CorrectionsSubmitSheet() {
  const params = useLocalSearchParams<{
    entityId?: string | string[];
    returnTo?: string | string[];
  }>();
  const entityId = parseEntityId(params.entityId);

  useEditionStackBack({
    fallbackHref: parseReturnTo(params.returnTo) ?? '/more',
    accessibilityHint: 'Closes this sheet when there is no previous screen',
  });

  return (
    <UtilityScreenShell
      kicker="Trust"
      title="Submit a correction"
      dek="Say what should change and link to evidence someone else can check."
      edges={['left', 'right', 'bottom']}
    >
      <View style={styles.body}>
        <Text variant="body" colorRole="ink">
          Corrections are filed on the BlackStory website. You get a receipt code there to check on
          it later.
        </Text>
        <View style={styles.actions}>
          <Button
            label="Open corrections form"
            variant="primary"
            density="compact"
            onPress={() => {
              void Linking.openURL(correctionsWebUrl(entityId));
            }}
            accessibilityHint="Opens the BlackStory corrections form in your browser"
          />
        </View>
      </View>
    </UtilityScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { gap: space['3'] },
  actions: { alignItems: 'flex-start' },
});
