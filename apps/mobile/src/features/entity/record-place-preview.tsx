/**
 * Compact matte place frame for record anatomy on mobile. Static preview (no
 * embedded MapLibre) with honest empty state when geo is absent.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, Text, space, useThemeColors } from '@/ui';
import type { RecordAnatomyPlace } from './entity-anatomy-facts';

export type RecordPlacePreviewProps = {
  readonly place?: RecordAnatomyPlace;
  readonly onOpenInMaps?: () => void;
};

const PREVIEW_HEIGHT = 120;

export function RecordPlacePreview({ place, onOpenInMaps }: RecordPlacePreviewProps) {
  const theme = useThemeColors();

  if (!place) {
    return (
      <View
        style={[styles.frame, styles.empty, { borderColor: theme.border, backgroundColor: theme.surface }]}
        accessibilityRole="image"
        accessibilityLabel="Place not pinned on the archive map"
        testID="record-place-empty"
      >
        <Text variant="code" colorRole="inkMuted">
          Place not pinned
        </Text>
      </View>
    );
  }

  const label = `Map preview for ${place.label} at public precision`;
  // Background swap on press (surfaceRaised → surfacePressed), matching row/button primitives.
  const renderFrame = (pressed: boolean) => (
    <View
      style={[
        styles.frame,
        { borderColor: theme.border, backgroundColor: pressed ? theme.surfacePressed : theme.surfaceRaised },
      ]}
      accessibilityRole="image"
      accessibilityLabel={label}
      testID="record-place-preview"
    >
      <View style={[styles.pinHead, { backgroundColor: theme.accentGraphic }]} />
      <View style={[styles.pinStem, { backgroundColor: theme.inkMuted }]} />
      <Text variant="caption" colorRole="inkMuted" numberOfLines={2} style={styles.placeLabel}>
        {place.label}
      </Text>
    </View>
  );

  if (onOpenInMaps) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${place.label} in Maps at public precision`}
        onPress={onOpenInMaps}
      >
        {({ pressed }) => renderFrame(pressed)}
      </Pressable>
    );
  }

  return renderFrame(false);
}

const styles = StyleSheet.create({
  frame: {
    minHeight: PREVIEW_HEIGHT,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space['3'],
    gap: space['1'],
  },
  empty: {
    justifyContent: 'center',
  },
  pinHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pinStem: {
    width: 2,
    height: 10,
    borderRadius: 1,
    marginTop: -2,
  },
  placeLabel: {
    textAlign: 'center',
    marginTop: space['1'],
  },
});
