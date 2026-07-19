/**
 * Error/offline-state primitive. Uses accessibilityLiveRegion="assertive" so
 * assistive tech announces the failure as soon as it renders (e.g. after a
 * failed fetch), distinct from EmptyState's neutral, non-interrupting tone.
 */
import { StyleSheet, View } from 'react-native';
import { Button, type ButtonProps } from './Button';
import { Text } from './Text';
import { space, useStatusColors } from './tokens';

export type ErrorStateProps = {
  title: string;
  description?: string;
  /** e.g. "Try again" — omit for errors with no useful retry action. */
  retry?: { label: string; onPress: ButtonProps['onPress'] };
};

export function ErrorState({ title, description, retry }: ErrorStateProps) {
  const status = useStatusColors();

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={styles.container}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.glyph, { borderColor: status.error.border }]}
      />
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
  glyph: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
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
