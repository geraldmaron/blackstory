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
import { radius, space, useThemeColors } from './tokens';

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: { label: string; onPress: ButtonProps['onPress'] };
  /**
   * Inline density for use inside an already-padded panel: tighter padding and no
   * decorative glyph. The full treatment is far too heavy nested in a Surface.
   */
  compact?: boolean;
};

export function EmptyState({ title, description, action, compact = false }: EmptyStateProps) {
  const theme = useThemeColors();

  return (
    // Deliberately NOT `accessible` — on iOS that collapses the subtree and makes the
    // action Button below unreachable by VoiceOver.
    <View
      accessibilityRole="summary"
      style={[styles.container, compact ? styles.containerCompact : null]}
    >
      {compact ? null : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.glyph, { backgroundColor: theme.accentMuted }]}
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
  containerCompact: {
    padding: space['4'],
  },
  glyph: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
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
