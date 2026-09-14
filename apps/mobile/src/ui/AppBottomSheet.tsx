/**
 * Shared snap bottom-sheet host for Explore and future map-adjacent sheets.
 * Peek / half / full snaps, ≥44px handle, reduce-motion safe. Explore wraps
 * this with attribution inset via `bottomInset`.
 *
 * Not a modal. The sheet rides over a live map that stays touchable and readable by assistive
 * tech in every posture, so it never hides what is behind it or traps focus. Its handle is a
 * real adjustable control: a screen reader swipes up or down on it to move between detents,
 * which is the non-drag route to the same snaps.
 *
 * Content modes:
 * - `scrollable`: BottomSheetScrollView (entity preview facts below the fold)
 * - `sheetList`: bare children so BottomSheetFlatList owns sheet scrolling
 * - default: BottomSheetView (non-scrolling chrome)
 */
import { useCallback, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useThemeColors, duration, radius, space, MIN_TOUCH_TARGET, Z_LAYER } from '@/ui/tokens';

export const SHEET_PEEK = 0;
export const SHEET_HALF = 1;
export const SHEET_FULL = 2;

const HANDLE_MIN = MIN_TOUCH_TARGET;

/** Spoken value of the handle at each detent of the default three-snap sheet. */
const SNAP_VALUE_TEXT = ['Collapsed', 'Half height', 'Full height'] as const;

export function sheetSnapValueText(index: number, snapCount: number): string {
  if (snapCount === SNAP_VALUE_TEXT.length) return SNAP_VALUE_TEXT[index] ?? SNAP_VALUE_TEXT[0];
  return `${index + 1} of ${snapCount}`;
}

const HANDLE_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

export type AppBottomSheetProps = {
  readonly children: ReactNode;
  /** Snap toward half when true (e.g. selection preview). Ignored when `snapIndex` is set. */
  readonly expanded?: boolean;
  /** Controlled snap index (0=peek, 1=half, 2=full). */
  readonly snapIndex?: number;
  readonly reduceMotion?: boolean;
  /** Clears map attribution / safe areas under the sheet. */
  readonly bottomInset?: number;
  /** Mixed list: a point height for a content-sized detent, a percentage for a proportional one. */
  readonly snapPoints?: readonly (string | number)[];
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
    () => [...(snapPointsProp ?? ['11%', '34%', '52%'])],
    [snapPointsProp],
  );
  const targetIndex = snapIndex ?? (expanded ? SHEET_HALF : SHEET_PEEK);
  // List/scroll bodies must pan with content so sheet + nested scroll gestures cooperate.
  const contentPanning = scrollable || sheetList;

  const snapCount = snapPoints.length;
  // "adjustable" promises that swiping up or down does something. It used to promise it with no
  // actions behind it, so a screen reader user heard a slider that never moved.
  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const step =
        event.nativeEvent.actionName === 'increment'
          ? 1
          : event.nativeEvent.actionName === 'decrement'
            ? -1
            : 0;
      const next = Math.min(snapCount - 1, Math.max(0, targetIndex + step));
      if (step !== 0 && next !== targetIndex) onSnapIndexChange?.(next);
    },
    [onSnapIndexChange, snapCount, targetIndex],
  );

  const handleComponent = useCallback(
    () => (
      <View
        style={styles.handleWrap}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Sheet handle"
        accessibilityHint="Resizes the sheet"
        accessibilityValue={{ text: sheetSnapValueText(targetIndex, snapCount) }}
        accessibilityActions={HANDLE_ACTIONS}
        onAccessibilityAction={handleAccessibilityAction}
        testID="app-bottom-sheet-handle"
      >
        <View style={[styles.handlePill, { backgroundColor: theme.border }]} />
      </View>
    ),
    [handleAccessibilityAction, snapCount, targetIndex, theme.border],
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
        // Not a focus stop. At peek the backdrop is fully transparent but still mounted, so it
        // was an invisible "Bottom sheet backdrop, button" laid over the map for TalkBack, and
        // above peek it read "Tap to close" for a press that only collapses. The same collapse
        // is reachable from the handle's adjust actions and the screen's own controls.
        accessible={false}
        opacity={1}
        style={[props.style, { backgroundColor: theme.overlay }]}
      />
    ),
    [theme.overlay],
  );

  // Pin Pulse: snappy detent travel; reduce-motion collapses to instant.
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: reduceMotion ? duration.durationInstant : duration.durationFast,
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
      // Explicitly NOT `accessible`, and no role. gorhom defaults its content view to
      // `accessible` + "adjustable" when these are omitted, which collapses the whole sheet body
      // into one VoiceOver element and makes every row and button inside it unreachable.
      accessible={false}
      accessibilityRole={null}
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
    // Visual grip is compact; minHeight keeps the ≥44dp touch target for Pin Pulse peek.
    minHeight: HANDLE_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  handlePill: {
    width: 36,
    height: 3,
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
