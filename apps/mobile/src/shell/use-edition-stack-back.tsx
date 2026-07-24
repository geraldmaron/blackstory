/**
 * Always-visible stack header back control with history-aware fallback.
 *
 * Native stack auto-hides the system back button when there is no history
 * (deep links, cold starts). This hook installs a copper `BackControl` as
 * `headerLeft` that calls `navigateBackOrFallback`.
 */
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';

import { BackControl } from '@/ui/BackControl';

import { navigateBackOrFallback } from './navigate-back';

export type UseEditionStackBackOptions = {
  /** Tab/section root used when `router.canGoBack()` is false. */
  readonly fallbackHref: `/${string}`;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
};

/**
 * Installs a reliable `headerLeft` back affordance on the current stack screen.
 * Call from route screens (and feature screens that already own `setOptions`).
 */
export function useEditionStackBack({
  fallbackHref,
  accessibilityLabel = 'Go back',
  accessibilityHint,
}: UseEditionStackBackOptions): void {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <BackControl
          accessibilityLabel={accessibilityLabel}
          {...(accessibilityHint ? { accessibilityHint } : {})}
          onPress={() => navigateBackOrFallback(fallbackHref)}
        />
      ),
    });
  }, [navigation, fallbackHref, accessibilityLabel, accessibilityHint]);
}
