/**
 * Empty-state primitive (e.g. "no results", "nothing saved yet"). The
 * decorative glyph is a plain geometric shape (a themed circle), not a
 * figurative illustration or avatar — consistent with the program's
 * non-figurative dignity posture (see EntityMark.tsx for the entity-image
 * placeholder equivalent). It is hidden from assistive tech; the title text
 * alone carries the accessible meaning.
 */
import { StyleSheet, View } from 'react-native';
import { Button, type ButtonProps } from './Button';
import { Text } from './Text';
import { space, useThemeColors } from './tokens';

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: { label: string; onPress: ButtonProps['onPress'] };
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  const theme = useThemeColors();

  return (
    <View accessible accessibilityRole="summary" style={styles.container}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.glyph, { backgroundColor: theme.accentMuted }]}
      />
      <Text variant="subtitle" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" colorRole="inkMuted" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} variant="secondary" />
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
