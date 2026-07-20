/**
 * Inline banner for warning/dispute/error/info messaging. Errors and
 * disputes use accessibilityLiveRegion="assertive" (interrupt) since they
 * represent a state change the user needs immediately; plain info notices
 * use "polite" (announced without interrupting).
 *
 * `accessibilityLiveRegion` is Android-only (see React Native's own docs), so this also fires
 * `useAnnounceOnMount` — a cross-platform `AccessibilityInfo.announceForAccessibility` call —
 * once per mount, which is what actually carries the same "you were just told about this"
 * behavior to VoiceOver on iOS (MOB-017). Forwards its ref to the underlying `View` so a caller
 * that also wants explicit assistive-tech FOCUS (not just an announcement) — e.g. a form's error
 * banner appearing above the fold, via `useAccessibilityFocus` — can still target this element
 * directly instead of needing a second wrapper.
 */
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { radius, space, useStatusColors, useThemeColors, type StatusName } from './tokens';
import { useAnnounceOnMount } from './useAnnounceOnMount';

export type NoticeTone = StatusName | 'info';

export type NoticeProps = {
  tone: NoticeTone;
  title: string;
  description?: string;
};

export const Notice = forwardRef<View, NoticeProps>(function Notice({ tone, title, description }, ref) {
  const status = useStatusColors();
  const theme = useThemeColors();
  const palette =
    tone === 'info'
      ? { fg: theme.ink, bg: theme.surfaceRaised, border: theme.border }
      : status[tone];
  const isUrgent = tone === 'error' || tone === 'dispute';

  useAnnounceOnMount(`${title}${description ? `. ${description}` : ''}`);

  return (
    <View
      ref={ref}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion={isUrgent ? 'assertive' : 'polite'}
      style={[styles.base, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text variant="bodyEmphasis" style={{ color: palette.fg }}>
        {title}
      </Text>
      {description ? (
        <Text variant="bodySmall" style={{ color: palette.fg, marginTop: space['1'] }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: space['4'],
  },
});
