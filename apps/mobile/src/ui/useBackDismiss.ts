/**
 * Lets the Android back button (and any hardware back) dismiss an in-place overlay.
 *
 * A route push gets back handling from the navigator. A panel swapped in on a screen that is
 * already showing does not: without this, back leaves the whole screen with the overlay still
 * open. While `active`, back calls `onDismiss` and is consumed; otherwise it falls through.
 * Pair with `onAccessibilityEscape` on the container for the iOS two-finger scrub.
 */
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

export function useBackDismiss(active: boolean, onDismiss: () => void): void {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismissRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [active]);
}
