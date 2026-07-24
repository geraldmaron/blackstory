/**
 * Selected-state exposure for the filter sheet's kind + era pickers (MOB-017 #2).
 * Facets apply live on chip press (no Apply confirm). Done only dismisses with
 * the already-committed filter state.
 */
import { fireEvent, render } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
    canGoBack: () => false,
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));

// eslint-disable-next-line import/first
import FiltersSheet from './filters-sheet';
// eslint-disable-next-line import/first
import { EXPLORE_ERA_OPTIONS } from '@/features/map/explore/ExploreFiltersPanel';

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetOptions.mockClear();
});

describe('FiltersSheet — kind picker selected state (MOB-017)', () => {
  it('renders kind and era radios with All kinds selected when no filter is active', async () => {
    const { getAllByRole, getByLabelText } = await render(<FiltersSheet />);
    const radios = getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    expect(getByLabelText('All kinds').props.accessibilityState?.selected).toBe(true);
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
    expect(getByLabelText('All kinds').props.accessibilityState?.selected).toBe(true);
  });
});

describe('FiltersSheet — live facet apply (no Apply gate)', () => {
  it('offers decade-literal era options including 1860s / 1910s / 1950s / 1960s / 1970s', async () => {
    const { getByLabelText } = await render(<FiltersSheet />);
    for (const era of ['1860s', '1910s', '1950s', '1960s', '1970s'] as const) {
      expect(EXPLORE_ERA_OPTIONS).toContain(era);
      expect(getByLabelText(era)).toBeTruthy();
    }
  });

  it('chip press navigates with filters immediately (no Apply confirm)', async () => {
    const { getByLabelText, queryByText } = await render(<FiltersSheet />);
    expect(queryByText('Apply')).toBeNull();

    await fireEvent.press(getByLabelText('Places'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/explore',
        params: expect.objectContaining({ kind: 'places' }),
      }),
    );

    await fireEvent.press(getByLabelText('1950s'));
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pathname: '/explore',
        params: expect.objectContaining({ kind: 'places', era: '1950s' }),
      }),
    );
  });

  it('Clear resets facets and syncs live', async () => {
    const { getByLabelText, getByText } = await render(<FiltersSheet />);
    await fireEvent.press(getByLabelText('Events'));
    await fireEvent.press(getByLabelText('1960s'));
    mockNavigate.mockClear();

    await fireEvent.press(getByText('Clear'));

    expect(getByLabelText('Events').props.accessibilityState?.selected).toBe(false);
    expect(getByLabelText('1960s').props.accessibilityState?.selected).toBe(false);
    expect(getByLabelText('All kinds').props.accessibilityState?.selected).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/explore',
        params: expect.objectContaining({
          kind: '',
          era: '',
        }),
      }),
    );
  });

  it('Done dismisses with the already-live filter state', async () => {
    const { getByLabelText, getByText } = await render(<FiltersSheet />);
    await fireEvent.press(getByLabelText('Places'));
    mockNavigate.mockClear();
    await fireEvent.press(getByText('Done'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/explore',
        params: expect.objectContaining({ kind: 'places' }),
      }),
    );
  });
});
