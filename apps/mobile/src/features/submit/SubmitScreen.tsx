/**
 * Native Submit shell — honest contribute entry when lead intake is web-only.
 * Corrections hand off to the web form via /corrections/submit; leads open the web lead form.
 */
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  LedgerRow,
  LedgerSectionLabel,
  NavIcon,
  Notice,
  ScreenCanvas,
  ScreenHeader,
  Text,
  screenScrollInsets,
  space,
} from '@/ui';

// The live public site. See `features/entity/share.ts` for why this is not `blackstory.app`.
const CANONICAL_WEB_ORIGIN = 'https://blackstory.app';

export const SUBMIT_INTRO = {
  kicker: 'Contribute',
  title: 'Submit',
  lede: 'Help improve the archive. Corrections and new leads both use moderated forms on the website.',
} as const;

export function SubmitScreen() {
  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>
        <ScreenHeader
          kicker={SUBMIT_INTRO.kicker}
          title={SUBMIT_INTRO.title}
          dek={SUBMIT_INTRO.lede}
          compact
          dense
        />

        <Notice
          tone="info"
          title="Two different lanes"
          description="Corrections fix published records. Leads point the archive at sources it doesn’t have yet. Either way, nothing is published as you sent it."
        />

        <View style={styles.section}>
          <LedgerSectionLabel>Corrections</LedgerSectionLabel>
          <LedgerRow
            title="Submit a correction"
            summary="Report an error or missing citation on a published record"
            leading={<NavIcon name="correction" size={20} />}
            showChevron
            showDivider={false}
            onPress={() => router.push('/corrections/submit' as never)}
            accessibilityLabel="Submit a correction"
          />
          <View style={styles.actions}>
            <Button
              label="Open corrections form"
              variant="primary"
              density="compact"
              onPress={() => router.push('/corrections/submit' as never)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>New leads</LedgerSectionLabel>
          <Text variant="body" colorRole="ink">
            Leads (a closed group post, a family paper, an account nobody wrote down) go through a
            private review queue on the website. This app doesn’t have its own lead form yet.
          </Text>
          <View style={styles.actions}>
            <Button
              label="Open lead form on web"
              variant="ghost"
              density="compact"
              onPress={() => {
                void Linking.openURL(`${CANONICAL_WEB_ORIGIN}/submit`);
              }}
              accessibilityHint="Opens the BlackStory lead form in your browser"
            />
          </View>
        </View>
      </View>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
    gap: space['3'],
  },
  section: {
    gap: space['2'],
  },
  actions: {
    alignItems: 'flex-start',
    gap: space['2'],
  },
});
