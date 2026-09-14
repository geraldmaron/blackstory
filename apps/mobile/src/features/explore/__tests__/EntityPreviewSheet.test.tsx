/**
 * Focus-movement checks for `EntityPreviewSheet` (MOB-017). The preview is sheet *content*
 * hosted on the Explore screen — not a route push — so neither VoiceOver nor TalkBack move
 * focus here on their own; `useAccessibilityFocus` must do it explicitly whenever a NEW
 * feature is selected.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { EntityPreviewSheet } from '../EntityPreviewSheet';
import type { ExploreFeature } from '@/features/explore/explore-feature';

const sendEvent = jest
  .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
  .mockImplementation(() => {});

beforeEach(() => {
  sendEvent.mockClear();
});

function feature(entityId: string, label: string): ExploreFeature {
  return {
    type: 'Feature',
    id: entityId,
    entityId,
    label,
    kind: 'place',
    coordinates: [-95.37, 29.76],
    properties: {
      entityId,
      kind: 'place',
      displayName: label,
      precision: 'city',
    },
  };
}

describe('EntityPreviewSheet — focus movement (MOB-017)', () => {
  it('renders nothing and never moves focus when there is no selected feature', async () => {
    const { queryByTestId } = await render(
      <EntityPreviewSheet feature={null} onOpenEntity={jest.fn()} onClose={jest.fn()} />,
    );
    expect(queryByTestId('entity-preview-sheet')).toBeNull();
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('moves assistive-tech focus onto the sheet when a feature is first selected', async () => {
    await render(
      <EntityPreviewSheet
        feature={feature('ent_a', 'Bethel AME Church')}
        onOpenEntity={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(sendEvent).toHaveBeenCalledTimes(1);
    expect(sendEvent.mock.calls[0]![1]).toBe('focus');
  });

  it('moves focus again when the selection changes to a DIFFERENT feature, but not on an unrelated re-render of the same feature', async () => {
    const { rerender } = await render(
      <EntityPreviewSheet
        feature={feature('ent_a', 'Bethel AME Church')}
        onOpenEntity={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(sendEvent).toHaveBeenCalledTimes(1);

    // Same entity id, re-rendered (e.g. a parent re-render with no real selection change).
    await rerender(
      <EntityPreviewSheet
        feature={feature('ent_a', 'Bethel AME Church')}
        onOpenEntity={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(sendEvent).toHaveBeenCalledTimes(1);

    // A genuinely new selection.
    await rerender(
      <EntityPreviewSheet
        feature={feature('ent_b', 'Greenwood District')}
        onOpenEntity={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(sendEvent).toHaveBeenCalledTimes(2);
  });

  it('exposes an accessible summary label and close control for the selected feature', async () => {
    const onOpenEntity = jest.fn();
    const { getByLabelText } = await render(
      <EntityPreviewSheet
        feature={{
          ...feature('ent_a', 'Bethel AME Church'),
          properties: {
            ...feature('ent_a', 'Bethel AME Church').properties,
            oneLineStory: 'A cornerstone of the district.',
          },
        }}
        onOpenEntity={onOpenEntity}
        onClose={jest.fn()}
      />,
    );

    expect(getByLabelText(/Pinned place: Bethel AME Church\./)).toBeTruthy();
    expect(getByLabelText('Close preview')).toBeTruthy();
    expect(getByLabelText('Open place for Bethel AME Church')).toBeTruthy();
    expect(getByLabelText('Open Bethel AME Church in Maps at public precision')).toBeTruthy();

    fireEvent.press(getByLabelText('Bethel AME Church'));
    expect(onOpenEntity).toHaveBeenCalledWith('ent_a');
  });

  it('shows the evidence grade and linked theme hooks when present on the feature', async () => {
    const { getByLabelText, getByTestId } = await render(
      <EntityPreviewSheet
        feature={{
          ...feature('ent_a', 'Bethel AME Church'),
          properties: {
            ...feature('ent_a', 'Bethel AME Church').properties,
            oneLineStory: 'A cornerstone of the district.',
            stateName: 'District of Columbia',
            eraBuckets: ['1900s'],
            evidenceCount: 4,
            confidenceTier: 'high',
            topicTags: ['education', 'faith'],
            status: 'historic',
          },
        }}
        onOpenEntity={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const summary = getByLabelText(/Pinned place: Bethel AME Church\./);
    // One evidence fact, in the language the site prints — not "High confidence" beside
    // "4 claims", neither of which named a grade.
    expect(summary.props.accessibilityLabel).toMatch(/Evidence: Grade A · 4 sources/);
    expect(summary.props.accessibilityLabel).not.toMatch(/claims/);
    expect(
      getByTestId('entity-preview-evidence-meter', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(getByTestId('entity-preview-linked')).toHaveTextContent(/education · faith/);
  });
});

describe('EntityPreviewSheet — where the browse stepper sits', () => {
  const browseProps = {
    onBrowsePrevious: () => {},
    onBrowseNext: () => {},
    browsePosition: { index: 3, total: 3892 },
  };

  it('keeps the stepper in the header row on a phone sheet', async () => {
    const { getByLabelText, getByText } = await render(
      <EntityPreviewSheet
        feature={feature('ent_a', 'Sixteenth Street Viaduct')}
        onOpenEntity={() => {}}
        onClose={() => {}}
        {...browseProps}
      />,
    );

    expect(getByLabelText('Previous place nearby')).toBeTruthy();
    expect(getByText('4/3892')).toBeTruthy();
    expect(getByText('Pinned here')).toBeTruthy();
  });

  it('offers the same stepper once, and only once, in the rail layout', async () => {
    const { getAllByLabelText, getByText } = await render(
      <EntityPreviewSheet
        layout="rail"
        feature={feature('ent_a', 'Sixteenth Street Viaduct')}
        onOpenEntity={() => {}}
        onClose={() => {}}
        {...browseProps}
      />,
    );

    // Moved, not duplicated — the header version and the row version are the same nodes
    // rendered in one place or the other.
    expect(getAllByLabelText('Previous place nearby')).toHaveLength(1);
    expect(getAllByLabelText('Next place nearby')).toHaveLength(1);
    expect(getByText('4/3892')).toBeTruthy();
    // The kicker is what the header was squeezing out at 300pt; it is present either way,
    // and in the rail it is no longer competing with the stepper for the same line.
    expect(getByText('Pinned here')).toBeTruthy();
  });

  it('shows no stepper row when there is nothing to browse', async () => {
    const { queryByLabelText } = await render(
      <EntityPreviewSheet
        layout="rail"
        feature={feature('ent_a', 'Sixteenth Street Viaduct')}
        onOpenEntity={() => {}}
        onClose={() => {}}
      />,
    );

    expect(queryByLabelText('Previous place nearby')).toBeNull();
  });
});
