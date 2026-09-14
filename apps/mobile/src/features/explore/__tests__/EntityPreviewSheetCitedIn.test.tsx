/**
 * "Cited in" on the Explore preview, mirroring web's `RecordSheet` group — including its rule
 * that the group renders only when a story actually cites the selected record.
 *
 * Kept out of `EntityPreviewSheet.test.tsx`, which owns the focus-movement contract and mocks
 * `AccessibilityInfo` for it.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { EntityPreviewSheet } from '../EntityPreviewSheet';
import type { ExploreFeature } from '../explore-feature';

function feature(citingStories?: readonly Record<string, string>[]): ExploreFeature {
  return {
    type: 'Feature',
    id: 'ent_a',
    entityId: 'ent_a',
    label: 'Bethel AME Church',
    kind: 'place',
    coordinates: [-95.37, 29.76],
    properties: {
      entityId: 'ent_a',
      kind: 'place',
      displayName: 'Bethel AME Church',
      precision: 'city',
      ...(citingStories ? { citingStories } : {}),
    },
  } as ExploreFeature;
}

const STORIES = [
  {
    slug: 'blockbusting',
    title: 'Blockbusting',
    relation: 'mapped in',
    href: '/stories/blockbusting',
  },
];

describe('EntityPreviewSheet — cited in', () => {
  it('names the stories that cite the selected record', async () => {
    const { getByTestId, getByText } = await render(
      <EntityPreviewSheet
        feature={feature(STORIES)}
        onOpenEntity={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByTestId('entity-preview-cited-in')).toBeTruthy();
    expect(getByText('Blockbusting')).toBeTruthy();
    expect(getByText('mapped in')).toBeTruthy();
  });

  it('shows no group at all when no story cites the record', async () => {
    const { queryByTestId } = await render(
      <EntityPreviewSheet feature={feature()} onOpenEntity={jest.fn()} onClose={jest.fn()} />,
    );
    expect(queryByTestId('entity-preview-cited-in')).toBeNull();
  });

  it('opens a cited story by slug', async () => {
    const onOpenStory = jest.fn();
    const { getByLabelText } = await render(
      <EntityPreviewSheet
        feature={feature(STORIES)}
        onOpenEntity={jest.fn()}
        onOpenStory={onOpenStory}
        onClose={jest.fn()}
      />,
    );
    fireEvent.press(getByLabelText(/Blockbusting, mapped in this record/i));
    expect(onOpenStory).toHaveBeenCalledWith('blockbusting');
  });
});
