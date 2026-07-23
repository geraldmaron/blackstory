/**
 * Structure + a11y tests for the Explore filters panel: collapsible Kind/Era
 * groups, dense chip radios (≥44px), and sticky Clear/Apply affordances.
 */
import { fireEvent, render } from '@testing-library/react-native';
import {
  ExploreFiltersPanel,
  EXPLORE_ERA_OPTIONS,
  filterStateFromPanel,
} from '../ExploreFiltersPanel';

describe('ExploreFiltersPanel — structure', () => {
  it('renders collapsible Kind and Era groups with sticky Apply / Clear', async () => {
    const { getByTestId, getByText, getByLabelText } = await render(
      <ExploreFiltersPanel
        kind={undefined}
        era={undefined}
        onKindChange={() => undefined}
        onEraChange={() => undefined}
        onClear={() => undefined}
        onApply={() => undefined}
      />,
    );

    expect(getByTestId('explore-filters-panel')).toBeTruthy();
    expect(getByTestId('filter-group-kind')).toBeTruthy();
    expect(getByTestId('filter-group-era')).toBeTruthy();
    expect(getByTestId('explore-filters-actions')).toBeTruthy();
    expect(getByText('Apply')).toBeTruthy();
    expect(getByText('Clear')).toBeTruthy();
    expect(getByLabelText('Kind filters').props.accessibilityState?.expanded).toBe(true);
    expect(getByLabelText('Era filters').props.accessibilityState?.expanded).toBe(true);
  });

  it('collapses a group so chip radios unmount, then expands again', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <ExploreFiltersPanel
        kind={undefined}
        era={undefined}
        onKindChange={() => undefined}
        onEraChange={() => undefined}
        onClear={() => undefined}
        onApply={() => undefined}
      />,
    );

    expect(getByLabelText('Place')).toBeTruthy();
    await fireEvent.press(getByLabelText('Kind filters'));
    expect(queryByLabelText('Place')).toBeNull();
    await fireEvent.press(getByLabelText('Kind filters'));
    expect(getByLabelText('Place')).toBeTruthy();
  });

  it('exposes chips as radios with selected state and min 44px hit target', async () => {
    const onKindChange = jest.fn();
    const { getByLabelText } = await render(
      <ExploreFiltersPanel
        kind={undefined}
        era={undefined}
        onKindChange={onKindChange}
        onEraChange={() => undefined}
        onClear={() => undefined}
        onApply={() => undefined}
      />,
    );

    const place = getByLabelText('Place');
    expect(place.props.accessibilityRole).toBe('radio');
    expect(place.props.accessibilityState?.selected).toBe(false);
    // Pressable may expose style as a function; evaluate for the idle state.
    const styleProp = place.props.style;
    const resolved =
      typeof styleProp === 'function' ? styleProp({ pressed: false }) : styleProp;
    const flat = Array.isArray(resolved) ? Object.assign({}, ...resolved.filter(Boolean)) : resolved;
    expect(flat.minHeight).toBe(44);
    expect(flat.minWidth).toBe(44);

    await fireEvent.press(place);
    expect(onKindChange).toHaveBeenCalledWith('place');
  });

  it('offers decade-literal era chips including mid-century buckets', async () => {
    const { getByLabelText } = await render(
      <ExploreFiltersPanel
        kind={undefined}
        era={undefined}
        onKindChange={() => undefined}
        onEraChange={() => undefined}
        onClear={() => undefined}
        onApply={() => undefined}
      />,
    );
    for (const era of ['1860s', '1910s', '1950s', '1960s', '1970s'] as const) {
      expect(EXPLORE_ERA_OPTIONS).toContain(era);
      expect(getByLabelText(era)).toBeTruthy();
    }
  });
});

describe('filterStateFromPanel', () => {
  it('drops unset fields', () => {
    expect(filterStateFromPanel(undefined, undefined)).toEqual({});
    expect(filterStateFromPanel('place', undefined)).toEqual({ kind: 'place' });
    expect(filterStateFromPanel(undefined, '1950s')).toEqual({ era: '1950s' });
    expect(filterStateFromPanel('school', '1960s')).toEqual({ kind: 'school', era: '1960s' });
  });
});
