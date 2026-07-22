/**
 * Cross-platform "move assistive-tech focus here" hook (MOB-017).
 *
 * WHY THIS EXISTS: a full Expo Router route push is treated by both VoiceOver and TalkBack as a
 * new accessibility "window" and each platform moves focus on its own — but content that mounts
 * or is swapped IN PLACE on an already-visible screen (a bottom sheet appearing over the map, a
 * success screen replacing a form inside the same modal route) gets no such help. Without an
 * explicit focus call, VoiceOver/TalkBack silently keep focus wherever it was before, and a user
 * swiping forward may never even discover the new content exists.
 *
 * Uses `AccessibilityInfo.sendAccessibilityEvent(handle, 'focus')` — the current, non-deprecated
 * replacement for `setAccessibilityFocus(reactTag)` — which takes the native view handle
 * directly (no `findNodeHandle` indirection needed) and works on both iOS and Android.
 */
import { useCallback, useRef } from 'react';
import { AccessibilityInfo, type View } from 'react-native';

export function useAccessibilityFocus<T extends View = View>() {
  const ref = useRef<T>(null);

  const focus = useCallback(() => {
    const handle = ref.current;
    if (!handle) return;
    AccessibilityInfo.sendAccessibilityEvent(handle as never, 'focus');
  }, []);

  return { ref, focus } as const;
}
