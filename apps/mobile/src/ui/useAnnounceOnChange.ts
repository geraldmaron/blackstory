/**
 * Announces a message to the screen reader every time it changes to a new non-empty value.
 *
 * The sibling of `useAnnounceOnMount` (read that file for why `accessibilityLiveRegion` is not
 * enough on iOS). That hook speaks once per mount; this one is for a region whose text is
 * replaced in place: a lookup answer, a result count, a failure line. Pass an empty string or
 * `null` while the result is still settling (typing, loading) and nothing is spoken.
 */
import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useAnnounceOnChange(message: string | null | undefined): void {
  const text = message?.trim() ?? '';
  useEffect(() => {
    if (text.length > 0) AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
}
