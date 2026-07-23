/**
 * Post-submission confirmation (MOB-016 #3). Shows the opaque receipt code with
 * clear "save this" instructions and a path to the status lookup.
 *
 * XSS-shape safety (MOB-016 #7): the receipt code is rendered inside a React
 * Native `<Text>`, which renders its children as inert text — there is no HTML
 * parser, so an angle-bracket / script-shaped string can only ever appear as
 * literal characters, never execute. The correction body is NOT echoed here at
 * all (it is not re-read from anywhere), minimizing where content is surfaced.
 *
 * Focus movement (MOB-017): `CorrectionsSubmitSheet` swaps this screen in for `CorrectionForm`
 * IN PLACE, inside the same modal route — not a route push — so assistive-tech focus stays
 * wherever it was on the form (often the just-pressed submit button) unless moved explicitly.
 * `useAccessibilityFocus` lands VoiceOver/TalkBack on the confirmation `Notice` on mount, so a
 * screen-reader user is told "Correction received…" and can continue reading forward from there
 * (the receipt code, save instructions, and next actions) instead of being stranded on a submit
 * button that no longer exists.
 */
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, Notice, Text, radius, space, useAccessibilityFocus, useThemeColors } from '@/ui';
import { RECEIPT_SAVE_INSTRUCTIONS } from './copy';

export type CorrectionReceiptProps = {
  readonly receiptCode: string;
  /** Navigate to the status-lookup screen. */
  readonly onCheckStatus: () => void;
  /** Dismiss the sheet. */
  readonly onDone: () => void;
};

export function CorrectionReceipt({ receiptCode, onCheckStatus, onDone }: CorrectionReceiptProps) {
  const theme = useThemeColors();
  const { ref: noticeRef, focus } = useAccessibilityFocus();

  // Fires once, when this confirmation screen first mounts in place of the form (`focus` is a
  // stable, memoized callback, so this never re-runs on a later render).
  useEffect(() => {
    focus();
  }, [focus]);

  return (
    <View style={{ gap: space['3'] }}>
      <Notice
        ref={noticeRef}
        tone="info"
        title="Correction received"
        description="Your correction is in the review queue. It is never published as submitted."
      />

      <View style={{ gap: space['1'] }}>
        <Text variant="bodyEmphasis">Your receipt code</Text>
        {/* A non-interactive box (no `onPress`), so it does not look tappable. The
            code is `selectable` for manual long-press copy; a one-tap copy button
            is not offered because `expo-clipboard` is not a project dependency.
            Inert: RN <Text> never interprets markup. */}
        <View
          accessibilityRole="text"
          accessibilityLabel={`Receipt code ${receiptCode}`}
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: radius.sm,
            padding: space['3'],
            backgroundColor: theme.surfaceRaised,
          }}
        >
          <Text variant="code" selectable>
            {receiptCode}
          </Text>
        </View>
        <Text variant="bodySmall" colorRole="inkMuted">
          {RECEIPT_SAVE_INSTRUCTIONS}
        </Text>
      </View>

      <Button label="Done" variant="primary" onPress={onDone} />
      <Button label="Check status with this code" variant="secondary" onPress={onCheckStatus} />
    </View>
  );
}
