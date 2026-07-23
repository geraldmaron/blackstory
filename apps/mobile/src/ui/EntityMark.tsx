/**
 * Flat, non-figurative placeholder for an entity without a rights-cleared
 * `primaryImage`. Geometric mark keyed to entity kind — never a portrait or
 * generated avatar. Built from plain Views (no SVG).
 */
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { radius, space, useThemeColors } from './tokens';

export type EntityMarkShape = 'book' | 'pin' | 'arch';
export type EntityMarkReason = 'absent' | 'pending-rights-review' | 'redacted';

export type EntityMarkProps = {
  entityName: string;
  shape?: EntityMarkShape;
  kindLabel?: string;
  reason?: EntityMarkReason;
  /** When true, fill the parent frame (image mast fallback) instead of a fixed card. */
  fill?: boolean;
};

const REASON_CAPTION: Record<EntityMarkReason, string> = {
  absent: 'No image available',
  'pending-rights-review': 'Image pending rights review',
  redacted: 'Image withheld',
};

export function EntityMark({
  entityName,
  shape = 'book',
  kindLabel,
  reason = 'absent',
  fill = false,
}: EntityMarkProps) {
  const theme = useThemeColors();
  const caption = REASON_CAPTION[reason];
  const accessibleName = kindLabel
    ? `${entityName}, ${kindLabel}. ${caption}.`
    : `${entityName}. ${caption}.`;

  return (
    <View
      style={[
        styles.container,
        fill ? styles.fillContainer : undefined,
        fill ? { backgroundColor: theme.surfaceRaised } : undefined,
      ]}
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibleName}
        style={[
          fill ? styles.fillFrame : styles.frame,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ShapeGraphic shape={shape} accentColor={theme.accentGraphic} inkColor={theme.ink} />
      </View>
      <Text variant="caption" colorRole="inkSubtle" style={styles.caption}>
        {kindLabel ? `${kindLabel} · ${caption}` : caption}
      </Text>
    </View>
  );
}

function ShapeGraphic({
  shape,
  accentColor,
  inkColor,
}: {
  shape: EntityMarkShape;
  accentColor: string;
  inkColor: string;
}) {
  if (shape === 'pin') {
    return (
      <View style={styles.shapeWrap} accessibilityElementsHidden importantForAccessibility="no">
        <View style={[styles.pinHead, { backgroundColor: inkColor }]} />
        <View style={[styles.pinPoint, { backgroundColor: inkColor }]} />
        <View style={[styles.pinCore, { backgroundColor: accentColor }]} />
      </View>
    );
  }
  if (shape === 'arch') {
    return (
      <View style={styles.shapeWrap} accessibilityElementsHidden importantForAccessibility="no">
        <View style={[styles.arch, { backgroundColor: inkColor }]} />
      </View>
    );
  }
  return (
    <View style={styles.shapeWrap} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.bookCover, { backgroundColor: inkColor }]} />
      <View style={[styles.bookSpine, { backgroundColor: accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: space['1'],
  },
  fillContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    padding: space['3'],
  },
  frame: {
    width: 96,
    height: 112,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fillFrame: {
    width: 96,
    height: 112,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  caption: {
    textAlign: 'center',
  },
  shapeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookCover: {
    width: 56,
    height: 72,
    borderRadius: 6,
  },
  bookSpine: {
    position: 'absolute',
    left: 20,
    top: 0,
    width: 4,
    height: 72,
    borderRadius: 2,
  },
  pinHead: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  pinPoint: {
    position: 'absolute',
    top: 40,
    width: 24,
    height: 24,
    transform: [{ rotate: '45deg' }],
    borderRadius: 4,
  },
  pinCore: {
    position: 'absolute',
    top: 14,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  arch: {
    width: 56,
    height: 76,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
});
