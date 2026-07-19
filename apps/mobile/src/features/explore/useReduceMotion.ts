/**
 * Reads the OS "Reduce Motion" accessibility setting and keeps it live (MOB-012).
 *
 * Used to collapse camera-animation duration to 0 (`cameraMotion`) so the map
 * honors the same reduced-motion contract as the rest of the app (ADR-022 /
 * accessibility gate). Defensive: `AccessibilityInfo` may be partially stubbed in
 * some runtimes, so both the initial query and the subscription are guarded and
 * default to "motion allowed" (false) rather than throwing.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (mounted) setReduce(Boolean(value));
      })
      .catch(() => {
        /* default: motion allowed */
      });

    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) => {
      setReduce(Boolean(value));
    });

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduce;
}
