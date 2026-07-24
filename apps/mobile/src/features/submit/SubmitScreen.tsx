/**
 * Native Submit shell — honest contribute entry when lead intake is web-only.
 * Primary path: corrections (native). Secondary: optional web lead form.
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

const CANONICAL_WEB_ORIGIN = 'https://blackbook.app';

export const SUBMIT_INTRO = {
  kicker: 'Contribute',
  title: 'Submit',
  lede:
    'Help improve the archive. On mobile you can report an error in a published record now. New leads still use the moderated web form.',
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
          description="Corrections fix published records. Leads point us at sources that are not yet in the archive. Neither path publishes submissions as-is."
        />

        <View style={styles.section}>
          <LedgerSectionLabel>On this device</LedgerSectionLabel>
          <LedgerRow
            title="Submit a correction"
            summary="Report an error or missing citation on a published record"
            leading={<NavIcon name="corrections" size={20} />}
            showChevron
            showDivider={false}
            onPress={() => router.push('/corrections/submit' as never)}
            accessibilityLabel="Submit a correction. Opens the native corrections form."
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
            Lead intake (closed groups, family papers, oral accounts) runs through a moderated
            quarantine queue on the website. A native lead form is not available in this release.
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
