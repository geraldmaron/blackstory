/**
 * Focus-movement checks for `EntityPreviewSheet` (MOB-017). The sheet mounts OVER the map on the
 * same screen — not a route push — so neither VoiceOver nor TalkBack move focus here on their
 * own; `useAccessibilityFocus` must do it explicitly whenever a NEW feature is selected.
 */
import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { EntityPreviewSheet } from './EntityPreviewSheet';
import type { ExploreFeature } from './explore-feature';

const sendEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});

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
      <EntityPreviewSheet feature={feature('ent_a', 'Bethel AME Church')} onOpenEntity={jest.fn()} onClose={jest.fn()} />,
    );
    expect(sendEvent).toHaveBeenCalledTimes(1);
    expect(sendEvent.mock.calls[0]![1]).toBe('focus');
  });

  it('moves focus again when the selection changes to a DIFFERENT feature, but not on an unrelated re-render of the same feature', async () => {
    const { rerender } = await render(
      <EntityPreviewSheet feature={feature('ent_a', 'Bethel AME Church')} onOpenEntity={jest.fn()} onClose={jest.fn()} />,
    );
    expect(sendEvent).toHaveBeenCalledTimes(1);

    // Same entity id, re-rendered (e.g. a parent re-render with no real selection change).
    await rerender(
      <EntityPreviewSheet feature={feature('ent_a', 'Bethel AME Church')} onOpenEntity={jest.fn()} onClose={jest.fn()} />,
    );
    expect(sendEvent).toHaveBeenCalledTimes(1);

    // A genuinely new selection.
    await rerender(
      <EntityPreviewSheet feature={feature('ent_b', 'Greenwood District')} onOpenEntity={jest.fn()} onClose={jest.fn()} />,
    );
    expect(sendEvent).toHaveBeenCalledTimes(2);
  });

  it('exposes an accessible summary label and close control for the selected feature', async () => {
    const { getByLabelText } = await render(
      <EntityPreviewSheet
        feature={{
          ...feature('ent_a', 'Bethel AME Church'),
          properties: {
            ...feature('ent_a', 'Bethel AME Church').properties,
            oneLineStory: 'A cornerstone of the district.',
          },
        }}
        onOpenEntity={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(getByLabelText(/Preview: Bethel AME Church\./)).toBeTruthy();
    expect(getByLabelText('Close preview')).toBeTruthy();
    expect(getByLabelText('View full record for Bethel AME Church')).toBeTruthy();
  });
});
