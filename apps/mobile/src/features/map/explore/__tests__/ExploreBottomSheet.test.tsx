/**
 * Explore bottom sheet host: flush bottom inset so attribution overlays the map
 * above the peek instead of reserving a sandwich gap under the sheet.
 */
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockBottomSheetProps: Record<string, unknown>[] = [];

jest.mock('../../../../ui/AppBottomSheet', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheet: (props: Record<string, unknown>) => {
      mockBottomSheetProps.push(props);
      return React.createElement(
        View,
        { testID: props.testID as string },
        props.children as never,
      );
    },
  };
});

// eslint-disable-next-line import/first
import {
  ExploreBottomSheet,
  EXPLORE_SHEET_ATTRIBUTION_INSET,
} from '../ExploreBottomSheet';

beforeEach(() => {
  mockBottomSheetProps.length = 0;
});

describe('ExploreBottomSheet — attribution inset', () => {
  it('uses bottomInset 0 so the sheet does not leave a sandwich gap for attribution', async () => {
    expect(EXPLORE_SHEET_ATTRIBUTION_INSET).toBe(0);
    await render(
      <ExploreBottomSheet>
        <Text>In view</Text>
      </ExploreBottomSheet>,
    );
    expect(mockBottomSheetProps[0]?.bottomInset).toBe(0);
  });

  it('forwards onSnapIndexChange to AppBottomSheet for attribution visibility', async () => {
    const onSnapIndexChange = jest.fn();
    await render(
      <ExploreBottomSheet onSnapIndexChange={onSnapIndexChange}>
        <Text>In view</Text>
      </ExploreBottomSheet>,
    );
    expect(mockBottomSheetProps[0]?.onSnapIndexChange).toBe(onSnapIndexChange);
  });
});
