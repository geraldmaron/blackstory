/**
 * Announces a message to the screen reader once, the first time it becomes non-empty/enabled
 * (MOB-017).
 *
 * WHY THIS EXISTS: `accessibilityLiveRegion` (used by `Notice`/`ErrorState`) is an ANDROID-ONLY
 * React Native prop ("Works for Android API >= 19 only" — see RN's own `View` docs) — it has no
 * effect on iOS at all. A brand-new alert/error/notice `View` mounting on iOS is therefore
 * silently invisible to VoiceOver until the user happens to swipe to it. `announceForAccessibility`
 * IS cross-platform, so this hook uses it everywhere rather than iOS-only, giving VoiceOver users
 * the same "you were just told about this" behavior TalkBack already gets from the live region —
 * the two mechanisms are complementary, not redundant: the live region is Android's native
 * mechanism for "this text just changed", this hook is what carries the equivalent to iOS and
 * doubles as a safety net if a future Android version's live-region timing differs.
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useAnnounceOnMount(message: string, enabled = true): void {
  const announced = useRef(false);
  // Read through a ref inside the effect (rather than listing `message` as a dependency) so a
  // message that changes after the initial announcement (e.g. a relative "ago" label ticking)
  // never triggers a second, re-interrupting announcement — this is intentionally a "once per
  // mount" primitive, not a live-updating one.
  const messageRef = useRef(message);
  messageRef.current = message;

  useEffect(() => {
    if (!enabled || announced.current || messageRef.current.trim().length === 0) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(messageRef.current);
  }, [enabled]);
}
