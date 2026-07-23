/**
 * Tests for v6 Explore records rail — hairline rows, copper selection rule, fact strips.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { ExploreRecordsRail } from '../ExploreRecordsRail';
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
    expect(getByTestId('explore-records-list')).toBeTruthy();
    expect(getByLabelText(/In view, 1 record/)).toBeTruthy();
    expect(getByLabelText(/Howard Theatre/)).toBeTruthy();
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
