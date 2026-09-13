/**
 * Tests for v6 Explore records rail — hairline rows, copper selection rule plus a
 * non-color checkmark mark, fact strips. BottomSheetFlatList is mocked as a
 * passthrough FlatList host for RNTL.
 */
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@gorhom/bottom-sheet', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { FlatList, View } = require('react-native');
  return {
    BottomSheetFlatList: (props: Record<string, unknown>) => {
      const { ListHeaderComponent, ListEmptyComponent, ...rest } = props;
      const header =
        typeof ListHeaderComponent === 'function' ? ListHeaderComponent() : ListHeaderComponent;
      const data = rest.data as unknown[] | undefined;
      const empty =
        (!data || data.length === 0) && ListEmptyComponent
          ? typeof ListEmptyComponent === 'function'
            ? ListEmptyComponent()
            : ListEmptyComponent
          : null;
      return React.createElement(
        View,
        null,
        header ?? null,
        empty ?? null,
        React.createElement(FlatList, rest),
      );
    },
  };
});

// eslint-disable-next-line import/first
import { ExploreRecordsRail } from '../ExploreRecordsRail';
// eslint-disable-next-line import/first
import type { ExploreFeature } from '@/features/explore/explore-feature';

function feature(entityId: string, label: string): ExploreFeature {
  return {
    type: 'Feature',
    id: entityId,
    entityId,
    label,
    kind: 'place',
    coordinates: [-77.03, 38.9],
    properties: {
      entityId,
      kind: 'place',
      displayName: label,
      precision: 'city',
      stateName: 'District of Columbia',
      eraBuckets: ['1900s'],
      evidenceCount: 2,
      confidenceTier: 'high',
      kindFamily: 'places',
    },
  };
}

describe('ExploreRecordsRail', () => {
  it('renders peek invite and hairline rows with fact strips', async () => {
    const { getByLabelText, getByTestId, getByText } = await render(
      <ExploreRecordsRail
        features={[feature('ent_a', 'Howard Theatre')]}
        onSelect={() => undefined}
      />,
    );
    expect(getByTestId('explore-records-rail')).toBeTruthy();
    expect(getByText('Pull up for places')).toBeTruthy();
    expect(getByLabelText(/Nearby, 1 pinned/)).toBeTruthy();
    expect(getByLabelText(/Howard Theatre/)).toBeTruthy();
  });

  it('keeps the dual release count in the header a11y label but not as visible duplicate text', async () => {
    const { getByLabelText, getByText, queryByText } = await render(
      <ExploreRecordsRail
        features={[feature('ent_a', 'Howard Theatre')]}
        scopeLabel="Nearby"
        releaseCount={1365}
        onSelect={() => undefined}
      />,
    );
    // Screen readers still hear the full count on the header…
    expect(getByLabelText('Nearby, 1 nearby, 1,365 in release')).toBeTruthy();
    // …but the visible invite is place-forward (count lives in the floating mast).
    expect(getByText('Pull up for places')).toBeTruthy();
    expect(queryByText('1 · 1,365 in release')).toBeNull();
  });

  it('calls onSelect when a row is pressed', async () => {
    const onSelect = jest.fn();
    const { getByLabelText } = await render(
      <ExploreRecordsRail features={[feature('ent_a', 'Howard Theatre')]} onSelect={onSelect} />,
    );
    fireEvent.press(getByLabelText(/Howard Theatre/));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'ent_a' }));
  });

  it('shows empty state when no features match', async () => {
    const { getByTestId, getByText } = await render(
      <ExploreRecordsRail features={[]} onSelect={() => undefined} />,
    );
    expect(getByTestId('explore-records-empty')).toBeTruthy();
    expect(getByText('No places nearby')).toBeTruthy();
  });

  it('marks the selected row with a non-color checkmark, not the copper rule alone', async () => {
    const { getByLabelText, queryByTestId } = await render(
      <ExploreRecordsRail
        features={[feature('ent_a', 'Howard Theatre')]}
        selectedId="ent_a"
        onSelect={() => undefined}
      />,
    );
    // A shape/presence cue survives even if the reader cannot distinguish the copper rule by hue.
    // The mark is decorative (accessibilityElementsHidden), so it must be looked up explicitly
    // including hidden elements — the row's own accessibilityState/Label carry the a11y signal.
    expect(
      queryByTestId('explore-record-selected-mark', { includeHiddenElements: true }),
    ).toBeTruthy();
    const row = getByLabelText(/Howard Theatre/);
    expect(row.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(row.props.accessibilityLabel).toMatch(/Selected$/);
  });

  it('does not show the selection checkmark on an unselected row', async () => {
    const { getByLabelText, queryByTestId } = await render(
      <ExploreRecordsRail
        features={[feature('ent_a', 'Howard Theatre')]}
        onSelect={() => undefined}
      />,
    );
    expect(
      queryByTestId('explore-record-selected-mark', { includeHiddenElements: true }),
    ).toBeNull();
    const row = getByLabelText(/Howard Theatre/);
    expect(row.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
  });
});
