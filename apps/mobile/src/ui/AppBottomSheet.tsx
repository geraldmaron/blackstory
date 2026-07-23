/**
 * Shared snap bottom-sheet host for Explore and future map-adjacent sheets.
 * Peek / half / full snaps, ≥44px handle, reduce-motion safe. Explore wraps
 * this with attribution inset via `bottomInset`.
 */
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useThemeColors, radius } from '@/ui/tokens';

export const SHEET_PEEK = 0;
export const SHEET_HALF = 1;
export const SHEET_FULL = 2;

const HANDLE_MIN = 44;

export type AppBottomSheetProps = {
  readonly children: ReactNode;
  /** Snap toward half when true (e.g. selection preview). Ignored when `snapIndex` is set. */
  readonly expanded?: boolean;
  /** Controlled snap index (0=peek, 1=half, 2=full). */
  readonly snapIndex?: number;
  readonly reduceMotion?: boolean;
  /** Clears map attribution / safe areas under the sheet. */
  readonly bottomInset?: number;
  readonly snapPoints?: readonly string[];
  readonly testID?: string;
  readonly accessibilityLabel?: string;
  /** Fired when the sheet settles on a snap index (0=peek, 1=half, 2=full). */
  readonly onSnapIndexChange?: (index: number) => void;
};

export function AppBottomSheet({
  children,
  expanded = false,
  snapIndex,
  reduceMotion = false,
  bottomInset = 0,
  snapPoints: snapPointsProp,
  testID = 'app-bottom-sheet',
  accessibilityLabel = 'Bottom sheet',
  onSnapIndexChange,
}: AppBottomSheetProps) {
  const theme = useThemeColors();
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(
    () => [...(snapPointsProp ?? ['22%', '42%', '58%'])],
    [snapPointsProp],
  );
  const targetIndex = snapIndex ?? (expanded ? SHEET_HALF : SHEET_PEEK);

  const handleComponent = useCallback(
    () => (
      <View
        style={styles.handleWrap}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Sheet handle"
        accessibilityHint="Drag to resize"
      >
        <View style={[styles.handlePill, { backgroundColor: theme.border }]} />
      </View>
    ),
    [theme.border],
  );

  const handleChange = useCallback(
    (index: number) => {
      onSnapIndexChange?.(index);
    },
    [onSnapIndexChange],
  );

  useEffect(() => {
    sheetRef.current?.snapToIndex(targetIndex);
  }, [targetIndex]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={targetIndex}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableOverDrag={!reduceMotion}
      bottomInset={bottomInset}
      handleComponent={handleComponent}
      animateOnMount={!reduceMotion}
      onChange={handleChange}
      backgroundStyle={[
        styles.background,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      style={styles.sheet}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <BottomSheetView style={styles.content} testID={testID}>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    // Above map attribution (z=1); below Explore floating chrome (z=3).
    zIndex: 2,
    elevation: 2,
  },
  background: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  handleWrap: {
    minHeight: HANDLE_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  handlePill: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    minHeight: 120,
  },
});
