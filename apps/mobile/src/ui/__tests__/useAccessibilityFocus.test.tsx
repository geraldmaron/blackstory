/**
 * `useAccessibilityFocus` (MOB-017): the cross-platform "move assistive-tech focus here"
 * primitive that `CorrectionReceipt`/`EntityPreviewSheet` use for content that mounts or is
 * swapped in place (not a route push), where VoiceOver/TalkBack do not move focus on their own.
 */
import { render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { useAccessibilityFocus } from '../useAccessibilityFocus';

function FocusOnMount() {
  const { ref, focus } = useAccessibilityFocus();
  useEffect(() => {
    focus();
  }, [focus]);
  return <View ref={ref} testID="focus-target" />;
}

function NeverFocuses() {
  const { ref } = useAccessibilityFocus();
  return <View ref={ref} testID="focus-target" />;
}

// `AccessibilityInfo.sendAccessibilityEvent` is backed by a single persistent module-level jest
// mock in this preset — re-spying per test (or relying on `mockRestore`) leaves prior tests'
// call history visible to later ones, so a single spy is created once and explicitly cleared
// (not restored) before every test instead.
const sendEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});

beforeEach(() => {
  sendEvent.mockClear();
});

describe('useAccessibilityFocus', () => {
  it('calls sendAccessibilityEvent with the attached view handle and "focus" when focus() runs', async () => {
    await render(<FocusOnMount />);

    expect(sendEvent).toHaveBeenCalledTimes(1);
    const [handle, eventType] = sendEvent.mock.calls[0]!;
    expect(eventType).toBe('focus');
    // The handle is the underlying native view instance attached via `ref` — not the
    // `getByTestId` query wrapper — so this asserts a real (non-null) handle was forwarded
    // rather than asserting object identity against a different testing-library abstraction.
    expect(handle).toBeTruthy();
  });

  it('never calls sendAccessibilityEvent when focus() is not invoked', async () => {
    await render(<NeverFocuses />);
    expect(sendEvent).not.toHaveBeenCalled();
  });
});
