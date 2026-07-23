/**
 * Compact story index row — ledger density for the Stories home and section indexes (meta, title,
 * optional dek). Meets 44dp touch target without full ListRow chrome.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Divider, NavIcon, Text, space, useThemeColors } from '@/ui';
import type { LearnContentEntry } from './content-catalog';

const MIN_ROW_HEIGHT = 44;

export interface StoryCompactRowProps {
  readonly entry: LearnContentEntry;
  readonly onPress: () => void;
  readonly showDivider?: boolean;
}

export function StoryCompactRow({ entry, onPress, showDivider = true }: StoryCompactRowProps) {
  const theme = useThemeColors();
  const { page } = entry;
  const meta = [page.eraLabel, page.placeLabel].filter(Boolean).join(' · ');

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${page.title}${meta ? `, ${meta}` : ''}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          { backgroundColor: pressed ? theme.surfaceRaised : 'transparent' },
        ]}
      >
        <NavIcon name="story" size={20} />
        <View style={styles.textColumn}>
          {meta ? (
            <Text variant="code" colorRole="inkMuted">
              {meta}
            </Text>
          ) : null}
          <Text variant="bodyEmphasis">{page.title}</Text>
          {page.dek ? (
            <Text variant="bodySmall" colorRole="inkMuted" numberOfLines={2}>
              {page.dek}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.inkMuted} accessibilityElementsHidden />
      </Pressable>
      {showDivider ? <Divider /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: MIN_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['3'],
    paddingVertical: space['2'],
    gap: space['2'],
  },
  textColumn: {
    flex: 1,
    gap: space['1'],
  },
});
