/**
 * Touch-target and state-exposure checks for `CorrectionForm`'s hand-rolled `ChipRow`/`Checkbox`
 * controls (MOB-017 #1). These are not built on `Button` (they need radio/checkbox semantics
 * `Button` doesn't expose — see `CorrectionForm.tsx`), so their own 44pt floor is asserted
 * directly rather than assumed from `Button`'s existing coverage.
 */
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { CorrectionForm } from './CorrectionForm';

function flatMinHeight(style: unknown): number | undefined {
  const flat = StyleSheet.flatten(style as never) as { minHeight?: number };
  return flat.minHeight;
}

describe('CorrectionForm — touch targets and control semantics (MOB-017)', () => {
  it('every ChipRow option (target-type and category pickers) meets the 44pt minimum touch target', async () => {
    const { getAllByRole } = await render(
      <CorrectionForm onSubmit={jest.fn()} onAccepted={jest.fn()} />,
    );
    const radios = getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) {
      expect(flatMinHeight(radio.props.style)).toBeGreaterThanOrEqual(44);
    }
  });

  it('every ChipRow option exposes its selected state via accessibilityState, not label text alone', async () => {
    const { getAllByRole } = await render(
      <CorrectionForm onSubmit={jest.fn()} onAccepted={jest.fn()} />,
    );
    for (const radio of getAllByRole('radio')) {
      expect(typeof radio.props.accessibilityState?.selected).toBe('boolean');
    }
  });

  it('both consent checkboxes meet the 44pt minimum touch target', async () => {
    const { getAllByRole } = await render(
      <CorrectionForm onSubmit={jest.fn()} onAccepted={jest.fn()} />,
    );
    const checkboxes = getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    for (const checkbox of checkboxes) {
      expect(flatMinHeight(checkbox.props.style)).toBeGreaterThanOrEqual(44);
      expect(typeof checkbox.props.accessibilityState?.checked).toBe('boolean');
    }
  });
});
