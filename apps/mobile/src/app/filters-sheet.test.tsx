/**
 * Selected-state exposure for the filter sheet's kind picker (MOB-017 #2). Selection was
 * previously conveyed only through a visible "✓ " label prefix and a primary/secondary color
 * swap — neither reaches VoiceOver/TalkBack's selection semantics. This asserts the radio
 * role/state wiring directly.
 */
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

// eslint-disable-next-line import/first
import FiltersSheet from './filters-sheet';

describe('FiltersSheet — kind picker selected state (MOB-017)', () => {
  it('renders every kind option as a radio with no option initially selected', async () => {
    const { getAllByRole } = await render(<FiltersSheet />);
    const radios = getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) {
      expect(radio.props.accessibilityState?.selected).toBe(false);
    }
  });

  it('marks exactly the pressed option as accessibilityState.selected, and the accessible name carries no literal checkmark glyph', async () => {
    const { getAllByRole } = await render(<FiltersSheet />);
    const radios = getAllByRole('radio');
    const target = radios[0]!;

    await fireEvent.press(target);

    const after = getAllByRole('radio');
    const selected = after.filter((r) => r.props.accessibilityState?.selected === true);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.props.accessibilityLabel).not.toContain('✓');
  });

  it('pressing the selected option again clears the selection', async () => {
    const { getAllByRole } = await render(<FiltersSheet />);
    const target = getAllByRole('radio')[0]!;

    await fireEvent.press(target);
    await fireEvent.press(getAllByRole('radio')[0]!);

    for (const radio of getAllByRole('radio')) {
      expect(radio.props.accessibilityState?.selected).toBe(false);
    }
  });
});
