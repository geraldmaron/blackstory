/**
 * Structure + a11y tests for the Explore filters panel: collapsible Kind/Era
 * groups, dense chip radios (≥44px), and sticky Clear/Apply affordances.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { buildExploreFacetOptions } from '@/features/explore/explore-filter';
import { makeFeature } from '@/features/explore/__fixtures__/features';
import {
  ExploreFiltersPanel,
  EXPLORE_ERA_OPTIONS,
  filterStateFromPanel,
  type ExploreFiltersPanelProps,
} from '../ExploreFiltersPanel';

const TEST_FEATURES = [
  makeFeature('a', [-77.04, 38.9], {
    label: 'Alpha',
    kind: 'place',
    properties: {
      eraBuckets: ['1950s'],
      mapTone: 'plantation',
      topicIds: ['education'],
      status: 'historic',
      confidenceTier: 'high',
      statePostalCode: 'DC',
    } as never,
  }),
  makeFeature('b', [-95.37, 29.76], {
    label: 'Bravo',
    kind: 'school',
    properties: {
      eraBuckets: ['1960s'],
      confidenceTier: 'low',
      status: 'active',
      statePostalCode: 'TX',
    } as never,
  }),
];

const TEST_FACET_OPTIONS = buildExploreFacetOptions(TEST_FEATURES);

function renderPanel(overrides: Partial<ExploreFiltersPanelProps> = {}) {
  return render(
    <ExploreFiltersPanel
      filters={{}}
      facetOptions={TEST_FACET_OPTIONS}
      onFiltersChange={() => undefined}
      onClear={() => undefined}
      onApply={() => undefined}
      {...overrides}
    />,
  );
}

describe('ExploreFiltersPanel — structure', () => {
  it('renders collapsible Kind and Era groups with sticky Apply / Clear', async () => {
    const { getByTestId, getByText, getByLabelText } = await renderPanel();

    expect(getByTestId('explore-filters-panel')).toBeTruthy();
    expect(getByTestId('filter-group-kind')).toBeTruthy();
    expect(getByTestId('filter-group-era')).toBeTruthy();
    expect(getByTestId('explore-filters-actions')).toBeTruthy();
    expect(getByText('Apply')).toBeTruthy();
    expect(getByText('Clear')).toBeTruthy();
    expect(getByLabelText('Kind filters').props.accessibilityState?.expanded).toBe(true);
    expect(getByLabelText('Era filters').props.accessibilityState?.expanded).toBe(true);
  });

  it('renders the History place-find handoff', async () => {
    const { getByTestId, getByText } = await renderPanel({
      onOpenPlaceFind: () => undefined,
    });
    expect(getByTestId('explore-place-find-handoff')).toBeTruthy();
    expect(getByText('Open History search')).toBeTruthy();
  });

  it('collapses a group so chip radios unmount, then expands again', async () => {
    const { getByLabelText, queryByLabelText } = await renderPanel();

    expect(getByLabelText('Places')).toBeTruthy();
    await fireEvent.press(getByLabelText('Kind filters'));
    expect(queryByLabelText('Places')).toBeNull();
    await fireEvent.press(getByLabelText('Kind filters'));
    expect(getByLabelText('Places')).toBeTruthy();
  });

  it('exposes chips as radios with selected state and min 44px hit target', async () => {
    const onFiltersChange = jest.fn();
    const { getByLabelText } = await renderPanel({ onFiltersChange });

    const places = getByLabelText('Places');
    expect(places.props.accessibilityRole).toBe('radio');
    expect(places.props.accessibilityState?.selected).toBe(false);
    const styleProp = places.props.style;
    const resolved =
      typeof styleProp === 'function' ? styleProp({ pressed: false }) : styleProp;
    const flat = Array.isArray(resolved) ? Object.assign({}, ...resolved.filter(Boolean)) : resolved;
    expect(flat.minHeight).toBe(44);
    expect(flat.minWidth).toBe(44);

    await fireEvent.press(places);
    expect(onFiltersChange).toHaveBeenCalledWith({ kind: 'places' });
  });

  it('offers decade-literal era chips including mid-century buckets', async () => {
    const { getByLabelText } = await renderPanel();
    for (const era of ['1860s', '1910s', '1950s', '1960s', '1970s'] as const) {
      expect(EXPLORE_ERA_OPTIONS).toContain(era);
      expect(getByLabelText(era)).toBeTruthy();
    }
  });

  it('embedded mode renders web-order facet rows including tone and confidence', async () => {
    const { getByTestId } = await renderPanel({ mode: 'embedded' });
    expect(getByTestId('facet-tone')).toBeTruthy();
    expect(getByTestId('facet-confidence')).toBeTruthy();
    expect(getByTestId('facet-state')).toBeTruthy();
  });
});

describe('filterStateFromPanel', () => {
  it('drops unset fields', () => {
    expect(filterStateFromPanel({})).toEqual({});
    expect(filterStateFromPanel({ kind: 'place' })).toEqual({ kind: 'place' });
    expect(filterStateFromPanel({ era: '1950s' })).toEqual({ era: '1950s' });
    expect(filterStateFromPanel({ kind: 'school', era: '1960s', tone: 'plantation' })).toEqual({
      kind: 'school',
      era: '1960s',
      tone: 'plantation',
    });
  });
});
