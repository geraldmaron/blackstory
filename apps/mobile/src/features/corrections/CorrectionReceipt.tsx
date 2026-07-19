/**
 * Post-submission confirmation (MOB-016 #3). Shows the opaque receipt code with
 * clear "save this" instructions and a path to the status lookup.
 *
 * XSS-shape safety (MOB-016 #7): the receipt code is rendered inside a React
 * Native `<Text>`, which renders its children as inert text — there is no HTML
 * parser, so an angle-bracket / script-shaped string can only ever appear as
 * literal characters, never execute. The correction body is NOT echoed here at
 * all (it is not re-read from anywhere), minimizing where content is surfaced.
 */
import { Pressable, View } from 'react-native';

import { Button, Notice, Text, radius, space, useThemeColors } from '@/ui';
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
  return (
    <View style={{ padding: space['4'], gap: space['4'] }}>
      <Notice
        tone="info"
        title="Correction received"
        description="Your correction is in the review queue. It is never published as submitted."
      />

      <View style={{ gap: space['1'] }}>
        <Text variant="bodyEmphasis">Your receipt code</Text>
        <Pressable
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
          {/* Inert: RN <Text> never interprets markup. */}
          <Text variant="code" selectable>
            {receiptCode}
          </Text>
        </Pressable>
        <Text variant="bodySmall" colorRole="inkMuted">
          {RECEIPT_SAVE_INSTRUCTIONS}
        </Text>
      </View>

      <Button label="Check status with this code" variant="secondary" onPress={onCheckStatus} />
      <Button label="Done" variant="primary" onPress={onDone} />
    </View>
  );
}
