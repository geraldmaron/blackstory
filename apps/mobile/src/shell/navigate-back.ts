/**
 * Reliable back navigation for stack-pushed mobile routes.
 *
 * Prefers history (`router.back`) when available; otherwise replaces to a
 * sensible tab/section root so deep links and cold starts never strand the user
 * without an exit. Tab roots must not call this for chrome — they have nowhere
 * "up" to go.
 */
import { router } from 'expo-router';

/** Narrow port so unit tests can exercise back-vs-fallback without a full navigator. */
export type NavigateBackPort = {
  readonly canGoBack: () => boolean;
  readonly back: () => void;
  readonly replace: (href: `/${string}`) => void;
};

const defaultPort: NavigateBackPort = {
  canGoBack: () => router.canGoBack(),
  back: () => {
    router.back();
  },
  replace: (href) => {
    router.replace(href as never);
  },
};

/**
 * Go back when history exists; otherwise replace with `fallbackHref`
 * (typically a tab root such as `/explore`, `/learn`, or `/more`).
 */
export function navigateBackOrFallback(
  fallbackHref: `/${string}`,
  port: NavigateBackPort = defaultPort,
): void {
  if (port.canGoBack()) {
    port.back();
    return;
  }
  port.replace(fallbackHref);
}
