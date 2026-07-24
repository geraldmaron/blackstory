/**
 * Ranked coverage strip — which Data beats have live fixtures vs deferred
 * warehouse feeds. Honest modeling status without claiming completeness.
 */
import { StyleSheet, View } from 'react-native';
import { Text, space, useThemeColors } from '@/ui';

export type CoveragePulseItem = {
  readonly id: string;
  readonly label: string;
  readonly status: 'fixture' | 'deferred' | 'catalog';
};

export type CoveragePulseProps = {
  readonly items: readonly CoveragePulseItem[];
};

const STATUS_LABEL: Record<CoveragePulseItem['status'], string> = {
  fixture: 'Fixture',
  deferred: 'Deferred',
  catalog: 'Catalog',
};

export function CoveragePulse({ items }: CoveragePulseProps) {
  const theme = useThemeColors();
  return (
    <View
      style={styles.block}
      accessibilityRole="summary"
      accessibilityLabel={items
        .map((item) => `${item.label}: ${STATUS_LABEL[item.status]}`)
        .join('. ')}
    >
      {items.map((item) => {
        const live = item.status === 'fixture' || item.status === 'catalog';
        return (
          <View
            key={item.id}
            style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: live ? theme.accentGraphic : theme.inkSubtle },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Text variant="caption" colorRole="ink" style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            <Text variant="sectionLabel" colorRole="inkMuted" style={styles.status}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: space['1'],
    paddingHorizontal: space['2'],
    paddingVertical: space['2'],
    minHeight: 36,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    maxWidth: 96,
  },
  status: {
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
