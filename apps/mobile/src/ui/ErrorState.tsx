/**
 * Error/offline-state primitive. Uses accessibilityLiveRegion="assertive" so
 * assistive tech announces the failure as soon as it renders (e.g. after a
 * failed fetch), distinct from EmptyState's neutral, non-interrupting tone.
 *
 * `accessibilityLiveRegion` is Android-only (see React Native's own docs) — `useAnnounceOnMount`
 * additionally fires a cross-platform `AccessibilityInfo.announceForAccessibility` call once per
 * mount so VoiceOver on iOS gets the same "announced without you having to swipe to find it"
 * behavior TalkBack already gets from the live region (MOB-017).
 */
import { StyleSheet, View } from 'react-native';
import { Button, type ButtonProps } from './Button';
import { Text } from './Text';
import { radius, space, useStatusColors } from './tokens';
import { useAnnounceOnMount } from './useAnnounceOnMount';

export type ErrorStateProps = {
  title: string;
  description?: string;
  /** e.g. "Try again" — omit for errors with no useful retry action. */
  retry?: { label: string; onPress: ButtonProps['onPress'] };
  /**
   * Inline density for use inside an already-padded panel: tighter padding and no
   * decorative glyph. The full treatment is far too heavy nested in a Surface.
   */
  compact?: boolean;
};

export function ErrorState({ title, description, retry, compact = false }: ErrorStateProps) {
  const status = useStatusColors();

  useAnnounceOnMount(`${title}${description ? `. ${description}` : ''}`);

  return (
    // Deliberately NOT `accessible` — on iOS that collapses the subtree and makes the
    // retry Button below unreachable by VoiceOver.
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.container, compact ? styles.containerCompact : null]}
    >
      {compact ? null : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.glyph, { borderColor: status.error.border }]}
        />
      )}
      <Text variant="subtitle" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" colorRole="inkMuted" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {retry ? (
        <View style={styles.action}>
          <Button label={retry.label} onPress={retry.onPress} variant="primary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: space['8'],
    gap: space['2'],
  },
  containerCompact: {
    padding: space['4'],
  },
  glyph: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: space['2'],
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  action: {
    marginTop: space['4'],
  },
});
