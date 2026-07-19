/**
 * Inline banner for warning/dispute/error/info messaging. Errors and
 * disputes use accessibilityLiveRegion="assertive" (interrupt) since they
 * represent a state change the user needs immediately; plain info notices
 * use "polite" (announced without interrupting).
 */
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { radius, space, useStatusColors, useThemeColors, type StatusName } from './tokens';

export type NoticeTone = StatusName | 'info';

export type NoticeProps = {
  tone: NoticeTone;
  title: string;
  description?: string;
};

export function Notice({ tone, title, description }: NoticeProps) {
  const status = useStatusColors();
  const theme = useThemeColors();
  const palette =
    tone === 'info'
      ? { fg: theme.ink, bg: theme.surfaceRaised, border: theme.border }
      : status[tone];
  const isUrgent = tone === 'error' || tone === 'dispute';

  return (
    <View
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
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: space['4'],
  },
});
