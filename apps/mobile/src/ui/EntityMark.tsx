/**
 * Flat, non-figurative placeholder for an entity without a rights-cleared
 * `primaryImage`. Mirrors the web convention (apps/web/src/components/entity/
 * EntityRecordMark.tsx): a geometric mark keyed to entity kind — never a
 * portrait, silhouette-of-a-person, or generated avatar. This is a deliberate
 * program non-goal (no skin-tone classification, no decorative anonymous
 * portrait/avatar system) — do not add a face/head/body shape to any variant
 * here, on mobile or otherwise.
 *
 * Built from plain Views (rectangles/circles), not react-native-svg — SDK 56
 * config plugins/native rebuild for a new native module were out of scope
 * for this pass, and these three shapes are simple enough to approximate
 * geometrically without a path-drawing library. If a future bead needs
 * closer parity with the web SVG paths, introduce react-native-svg then.
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
};

const REASON_CAPTION: Record<EntityMarkReason, string> = {
  absent: 'No image available',
  'pending-rights-review': 'Image pending rights review',
  redacted: 'Image withheld',
};

export function EntityMark({ entityName, shape = 'book', kindLabel, reason = 'absent' }: EntityMarkProps) {
  const theme = useThemeColors();
  const caption = REASON_CAPTION[reason];
  const accessibleName = kindLabel
    ? `${entityName}, ${kindLabel}. ${caption}.`
    : `${entityName}. ${caption}.`;

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibleName}
        style={[styles.frame, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
      >
        <ShapeGraphic shape={shape} accentColor={theme.accentGraphic} inkColor={theme.ink} />
      </View>
      <Text variant="caption" colorRole="inkSubtle" style={styles.caption}>
        {caption}
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
  // book (default)
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
  frame: {
    width: 96,
    height: 112,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shapeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    textAlign: 'center',
  },
  // "book": a rounded cover with a colored spine accent, echoing the brand's
  // book-and-pin motif at a purely geometric, non-figurative level.
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
  // "pin": circle head + rotated-square point, the standard geometric
  // map-pin construction (no path/svg needed).
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
  // "arch": a doorway/archway silhouette via large top corner radii.
  arch: {
    width: 56,
    height: 76,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
});
