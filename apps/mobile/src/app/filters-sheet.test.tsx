/**
 * Selected-state exposure for the filter sheet's kind + era pickers (MOB-017 #2).
 * Selection was previously conveyed only through a visible "✓ " label prefix and a
 * primary/secondary color swap — neither reaches VoiceOver/TalkBack's selection
 * semantics. This asserts the radio role/state wiring and that Apply keeps both
 * kind and era (no longer drops era).
 */
import { fireEvent, render } from '@testing-library/react-native';

const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  useLocalSearchParams: () => ({}),
}));

// eslint-disable-next-line import/first
import FiltersSheet from './filters-sheet';
// eslint-disable-next-line import/first
import { EXPLORE_ERA_OPTIONS } from '@/features/map/explore/ExploreFiltersPanel';

beforeEach(() => {
  mockNavigate.mockClear();
});

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

describe('FiltersSheet — kind + era Apply', () => {
  it('offers decade-literal era options including 1860s / 1910s / 1950s / 1960s / 1970s', async () => {
    const { getByLabelText } = await render(<FiltersSheet />);
    for (const era of ['1860s', '1910s', '1950s', '1960s', '1970s'] as const) {
      expect(EXPLORE_ERA_OPTIONS).toContain(era);
      expect(getByLabelText(era)).toBeTruthy();
    }
  });

  it('Apply navigates with both kind and era (does not drop era)', async () => {
    const { getByLabelText, getByText } = await render(<FiltersSheet />);
    await fireEvent.press(getByLabelText('Place'));
    await fireEvent.press(getByLabelText('1950s'));
    await fireEvent.press(getByText('Apply'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/explore',
        params: { kind: 'place', era: '1950s' },
      }),
    );
  });

  it('Clear resets both kind and era before Apply', async () => {
    const { getByLabelText, getByText, getAllByRole } = await render(<FiltersSheet />);
    await fireEvent.press(getByLabelText('School'));
    await fireEvent.press(getByLabelText('1960s'));
    await fireEvent.press(getByText('Clear'));

    for (const radio of getAllByRole('radio')) {
      expect(radio.props.accessibilityState?.selected).toBe(false);
    }

    await fireEvent.press(getByText('Apply'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/explore',
        params: {},
      }),
    );
  });
});
