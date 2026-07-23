/**
 * Shared snap bottom-sheet host for Explore and future map-adjacent sheets.
 * Peek / half / full snaps, ≥44px handle, reduce-motion safe. Explore wraps
 * this with attribution inset via `bottomInset`.
 *
 * Content modes:
 * - `scrollable`: BottomSheetScrollView (entity preview facts below the fold)
 * - `sheetList`: bare children so BottomSheetFlatList owns sheet scrolling
 * - default: BottomSheetView (non-scrolling chrome)
 */
import { useCallback, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useThemeColors, duration, radius, space, MIN_TOUCH_TARGET, Z_LAYER } from '@/ui/tokens';
import type { StyleProp, ViewStyle } from 'react-native';

export const SHEET_PEEK = 0;
export const SHEET_HALF = 1;
export const SHEET_FULL = 2;

const HANDLE_MIN = MIN_TOUCH_TARGET;

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
  /** Use a scroll container so expanded preview content clears the tab bar. */
  readonly scrollable?: boolean;
  /**
   * Children include a BottomSheetFlatList (or similar) that must be a direct
   * sheet descendant — skip BottomSheetView / ScrollView wrappers.
   */
  readonly sheetList?: boolean;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
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
  scrollable = false,
  sheetList = false,
  contentContainerStyle,
}: AppBottomSheetProps) {
  const theme = useThemeColors();
  const snapPoints = useMemo(
    () => [...(snapPointsProp ?? ['16%', '32%', '48%'])],
    [snapPointsProp],
  );
  const targetIndex = snapIndex ?? (expanded ? SHEET_HALF : SHEET_PEEK);
  // List/scroll bodies must pan with content so sheet + nested scroll gestures cooperate.
  const contentPanning = scrollable || sheetList;

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

  // Dims the map once the sheet leaves peek; tapping collapses back to peek.
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={SHEET_HALF}
        disappearsOnIndex={SHEET_PEEK}
        pressBehavior="collapse"
        opacity={1}
        style={[props.style, { backgroundColor: theme.overlay }]}
      />
    ),
    [theme.overlay],
  );

  // Reduce-motion collapses the snap animation instead of disabling snapping.
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: reduceMotion ? duration.durationInstant : duration.durationBase,
  });

  // NOTE: snapping is driven purely by the controlled `index` prop below. An
  // additional imperative `snapToIndex` effect used to race it and produce a
  // visible snap-back — do not reintroduce one.

  const sheetContentProps = {
    style: styles.content,
    testID,
    ...(scrollable
      ? {
          contentContainerStyle: [styles.scrollContent, contentContainerStyle],
          keyboardShouldPersistTaps: 'handled' as const,
        }
      : {}),
  };

  return (
    <BottomSheet
      index={targetIndex}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableOverDrag={!reduceMotion}
      enableContentPanningGesture={contentPanning}
      bottomInset={bottomInset}
      handleComponent={handleComponent}
      backdropComponent={renderBackdrop}
      animateOnMount={!reduceMotion}
      animationConfigs={animationConfigs}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={handleChange}
      backgroundStyle={[
        styles.background,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      style={styles.sheet}
      // Deliberately NOT `accessible` — that collapses the whole sheet body into a
      // single VoiceOver element, making the content inside unreachable.
      accessibilityLabel={accessibilityLabel}
    >
      {sheetList ? (
        children
      ) : scrollable ? (
        <BottomSheetScrollView {...sheetContentProps}>{children}</BottomSheetScrollView>
      ) : (
        <BottomSheetView {...sheetContentProps}>{children}</BottomSheetView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    // Above map attribution; below Explore floating chrome.
    zIndex: Z_LAYER.sheet,
    elevation: Z_LAYER.sheet,
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
    // No minHeight: a floor plus the 44dp handle exceeds the peek detent and clips peek content.
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: space['3'],
  },
});
