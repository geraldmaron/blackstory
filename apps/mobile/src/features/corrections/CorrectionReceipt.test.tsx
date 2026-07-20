/**
 * MOB-016 #7: XSS-shaped strings render as inert text. React Native's `<Text>`
 * has no HTML parser, so a script-shaped string can only ever appear verbatim as
 * characters — never execute. This proves the confirmation screen echoes such a
 * value as literal text.
 *
 * Also covers MOB-017's focus movement: `CorrectionsSubmitSheet` swaps this screen in for
 * `CorrectionForm` IN PLACE (not a route push), so `useAccessibilityFocus` must explicitly move
 * VoiceOver/TalkBack focus onto the confirmation `Notice` on mount.
 */
import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { CorrectionReceipt } from './CorrectionReceipt';

const sendEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});

beforeEach(() => {
  sendEvent.mockClear();
});

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

describe('CorrectionReceipt — focus movement (MOB-017)', () => {
  it('moves assistive-tech focus onto the confirmation notice on mount', async () => {
    await render(<CorrectionReceipt receiptCode="RC-TEST-0001" onCheckStatus={() => {}} onDone={() => {}} />);
    expect(sendEvent).toHaveBeenCalledTimes(1);
    expect(sendEvent.mock.calls[0]![1]).toBe('focus');
  });
});
