/**
 * Reads the OS Reduce Motion accessibility setting and keeps it live.
 * Shared by edition atmosphere mosaic (and any UI that needs the same contract).
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
