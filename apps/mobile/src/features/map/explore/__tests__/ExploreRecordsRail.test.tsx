/**
 * Tests for v6 Explore records rail — hairline rows, copper selection rule, fact strips.
 * BottomSheetFlatList is mocked as a passthrough FlatList host for RNTL.
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
        typeof ListHeaderComponent === 'function'
          ? ListHeaderComponent()
          : ListHeaderComponent;
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
  it('renders scope header and hairline rows with fact strips', async () => {
    const { getByLabelText, getByTestId } = await render(
      <ExploreRecordsRail
        features={[feature('ent_a', 'Howard Theatre')]}
        onSelect={() => undefined}
      />,
    );
    expect(getByTestId('explore-records-rail')).toBeTruthy();
    expect(getByLabelText(/In view, 1 record/)).toBeTruthy();
    expect(getByLabelText(/Howard Theatre/)).toBeTruthy();
  });

  it('shows dual release copy in the header when viewport-scoped', async () => {
    const { getByLabelText, getByText } = await render(
      <ExploreRecordsRail
        features={[feature('ent_a', 'Howard Theatre')]}
        scopeLabel="In view"
        releaseCount={1365}
        onSelect={() => undefined}
      />,
    );
    expect(getByLabelText('In view, 1 in view, 1,365 in release')).toBeTruthy();
    // Rail keeps scope on the left; count omits a second "in view".
    expect(getByText('1 · 1,365 in release')).toBeTruthy();
  });

  it('calls onSelect when a row is pressed', async () => {
    const onSelect = jest.fn();
    const { getByLabelText } = await render(
      <ExploreRecordsRail
        features={[feature('ent_a', 'Howard Theatre')]}
        onSelect={onSelect}
      />,
    );
    fireEvent.press(getByLabelText(/Howard Theatre/));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'ent_a' }));
  });

  it('shows empty state when no features match', async () => {
    const { getByTestId } = await render(
      <ExploreRecordsRail features={[]} onSelect={() => undefined} />,
    );
    expect(getByTestId('explore-records-empty')).toBeTruthy();
  });
});
