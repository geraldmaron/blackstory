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
  it('renders kind and era radios with Any selected when no filter is active', async () => {
    const { getAllByRole, getByLabelText } = await render(<FiltersSheet />);
    const radios = getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    expect(getByLabelText('Any kind').props.accessibilityState?.selected).toBe(true);
  });

  it('marks exactly the pressed kind option as selected (no checkmark glyph in label)', async () => {
    const { getAllByRole, getByLabelText } = await render(<FiltersSheet />);
    const target = getByLabelText('Places');

    await fireEvent.press(target);

    const after = getAllByRole('radio');
    const selected = after.filter((r) => r.props.accessibilityState?.selected === true);
    expect(selected.length).toBeGreaterThanOrEqual(1);
    expect(getByLabelText('Places').props.accessibilityState?.selected).toBe(true);
    for (const radio of selected) {
      expect(radio.props.accessibilityLabel).not.toContain('✓');
    }
  });

  it('pressing the selected kind option again clears the kind selection', async () => {
    const { getByLabelText } = await render(<FiltersSheet />);

    await fireEvent.press(getByLabelText('Places'));
    expect(getByLabelText('Places').props.accessibilityState?.selected).toBe(true);

    await fireEvent.press(getByLabelText('Places'));
    expect(getByLabelText('Places').props.accessibilityState?.selected).toBe(false);
    expect(getByLabelText('Any kind').props.accessibilityState?.selected).toBe(true);
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
    await fireEvent.press(getByLabelText('Places'));
    await fireEvent.press(getByLabelText('1950s'));
    await fireEvent.press(getByText('Apply'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/explore',
        params: { kind: 'places', era: '1950s' },
      }),
    );
  });

  it('Clear resets both kind and era before Apply', async () => {
    const { getByLabelText, getByText } = await render(<FiltersSheet />);
    await fireEvent.press(getByLabelText('Events'));
    await fireEvent.press(getByLabelText('1960s'));
    await fireEvent.press(getByText('Clear'));

    expect(getByLabelText('Events').props.accessibilityState?.selected).toBe(false);
    expect(getByLabelText('1960s').props.accessibilityState?.selected).toBe(false);
    expect(getByLabelText('Any kind').props.accessibilityState?.selected).toBe(true);

    await fireEvent.press(getByText('Apply'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/explore',
        params: {},
      }),
    );
  });
});
