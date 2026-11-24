/**
 * The exhibit frame (docs/ui/DESIGN.md section 7.3): a label that says the kind and what the
 * year means, the object inside crop marks, and its receipt. Props mirror the web kit's
 * `ExhibitFrame` (packages/ui/src/components/Exhibit.tsx) so a screen reads the same on both.
 *
 *   full     label, crop marks, object, receipt. At most one per screen on a phone.
 *   compact  crop marks only, for rows and thumbnails.
 *   quiet    no crop marks, for a harm-adjacent object.
 *
 * `ground="ink"` is for a map: the object sits on Black Ink in both themes.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { brandCore, space, useThemeColors } from './tokens';

export type ExhibitKind = 'photograph' | 'document' | 'map' | 'figure' | 'name';
export type ExhibitVariant = 'full' | 'compact' | 'quiet';

const KIND_LABEL: Record<ExhibitKind, string> = {
  photograph: 'Photograph',
  document: 'Document',
  map: 'Map',
  figure: 'Figure',
  name: 'Name',
};

export type ExhibitFrameProps = {
  readonly kind: ExhibitKind;
  /** What the year means: "first documented", "date not on record", a precision in words. */
  readonly basis?: string;
  /** Replaces the kind word when the object is not what `kind` would call it (a painting). */
  readonly kindLabel?: string;
  readonly variant?: ExhibitVariant;
  readonly ground?: 'ink';
  readonly receipt?: ReactNode;
  /**
   * Side padding for the label and the receipt only. A story sets its exhibits edge to edge and
   * passes its column padding here, so the words stay on the reading column.
   */
  readonly gutter?: number;
  readonly children: ReactNode;
  readonly testID?: string;
};

const MARK = 12;
const MARK_WEIGHT = 1.5;
const INSET = space['2'];

/** The spoken and printed label: "Photograph · date not on record". */
export function exhibitLabel(kind: ExhibitKind, basis?: string, kindLabel?: string): string {
  return [kindLabel ?? KIND_LABEL[kind], basis].filter(Boolean).join(' · ');
}

function CropMarks({ color }: { readonly color: string }) {
  const corner = (position: ViewStyle, sides: ViewStyle) => (
    <View style={[styles.mark, position, sides, { borderColor: color }]} />
  );
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="exhibit-crop-marks"
    >
      {corner({ top: 0, left: 0 }, { borderTopWidth: MARK_WEIGHT, borderLeftWidth: MARK_WEIGHT })}
      {corner({ top: 0, right: 0 }, { borderTopWidth: MARK_WEIGHT, borderRightWidth: MARK_WEIGHT })}
      {corner(
        { bottom: 0, left: 0 },
        { borderBottomWidth: MARK_WEIGHT, borderLeftWidth: MARK_WEIGHT },
      )}
      {corner(
        { bottom: 0, right: 0 },
        { borderBottomWidth: MARK_WEIGHT, borderRightWidth: MARK_WEIGHT },
      )}
    </View>
  );
}

export function ExhibitFrame({
  kind,
  basis,
  kindLabel,
  variant = 'full',
  ground,
  receipt,
  gutter = 0,
  children,
  testID,
}: ExhibitFrameProps) {
  const theme = useThemeColors();
  const label = exhibitLabel(kind, basis, kindLabel);
  const marked = variant !== 'quiet';

  return (
    <View style={styles.frame} testID={testID}>
      {variant !== 'compact' ? (
        <Text
          variant="meta"
          colorRole="inkMuted"
          style={[styles.label, { paddingHorizontal: gutter }]}
          accessibilityLabel={`${label.replace(' · ', ', ')}.`}
          testID="exhibit-label"
        >
          {label}
        </Text>
      ) : null}
      <View style={marked ? styles.marked : undefined}>
        <View style={ground === 'ink' ? { backgroundColor: brandCore.ebonyInk } : undefined}>
          {children}
        </View>
        {marked ? <CropMarks color={theme.ink} /> : null}
      </View>
      {receipt ? (
        <View style={{ paddingHorizontal: gutter }} testID="exhibit-receipt">
          {receipt}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    gap: space['2'],
  },
  label: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  marked: {
    padding: INSET,
  },
  mark: {
    position: 'absolute',
    width: MARK,
    height: MARK,
  },
});
