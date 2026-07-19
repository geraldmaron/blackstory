/**
 * MOB-016 #7: XSS-shaped strings render as inert text. React Native's `<Text>`
 * has no HTML parser, so a script-shaped string can only ever appear verbatim as
 * characters — never execute. This proves the confirmation screen echoes such a
 * value as literal text.
 */
import { render } from '@testing-library/react-native';

import { CorrectionReceipt } from './CorrectionReceipt';

describe('CorrectionReceipt renders untrusted strings inertly', () => {
  it('shows an XSS-shaped receipt string verbatim as text', async () => {
    const xss = '<script>alert(1)</script>';
    const { getByText } = await render(
      <CorrectionReceipt receiptCode={xss} onCheckStatus={() => {}} onDone={() => {}} />,
    );
    // The exact string is present as inert text content.
    expect(getByText(xss)).toBeTruthy();
  });
});
