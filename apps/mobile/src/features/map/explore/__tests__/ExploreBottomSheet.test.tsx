/**
 * Explore bottom sheet host: v7 prototype detents and controlled snap wiring.
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
  EXPLORE_SHEET_BOTTOM_INSET,
  EXPLORE_SHEET_HALF,
  EXPLORE_SHEET_PEEK,
  EXPLORE_SHEET_PEEK_HEIGHT,
  EXPLORE_SHEET_SNAP_POINTS,
} from '../ExploreBottomSheet';

beforeEach(() => {
  mockBottomSheetProps.length = 0;
});

describe('ExploreBottomSheet — v7 detents', () => {
  it('uses map-first snap points 16% / 32% / 48%', async () => {
    expect(EXPLORE_SHEET_SNAP_POINTS).toEqual(['16%', '32%', '48%']);
    expect(EXPLORE_SHEET_PEEK_HEIGHT).toBe('16%');
    expect(EXPLORE_SHEET_BOTTOM_INSET).toBe(0);
  });

  it('defaults to peek when idle and half when a record is selected', async () => {
    await render(
      <ExploreBottomSheet>
        <Text>In view</Text>
      </ExploreBottomSheet>,
    );
    expect(mockBottomSheetProps[0]?.snapIndex).toBe(EXPLORE_SHEET_PEEK);

    mockBottomSheetProps.length = 0;
    await render(
      <ExploreBottomSheet hasSelection>
        <Text>Preview</Text>
      </ExploreBottomSheet>,
    );
    expect(mockBottomSheetProps[0]?.snapIndex).toBe(EXPLORE_SHEET_HALF);
  });

  it('forwards controlled snapIndex and onSnapIndexChange', async () => {
    const onSnapIndexChange = jest.fn();
    await render(
      <ExploreBottomSheet snapIndex={2} onSnapIndexChange={onSnapIndexChange}>
        <Text>Browse</Text>
      </ExploreBottomSheet>,
    );
    expect(mockBottomSheetProps[0]?.snapIndex).toBe(2);
    expect(mockBottomSheetProps[0]?.snapPoints).toEqual(EXPLORE_SHEET_SNAP_POINTS);
    expect(mockBottomSheetProps[0]?.bottomInset).toBe(0);
    expect(mockBottomSheetProps[0]?.onSnapIndexChange).toBe(onSnapIndexChange);
  });

  it('forwards scrollable preview mode and tab bar inset', async () => {
    await render(
      <ExploreBottomSheet scrollable bottomInset={83}>
        <Text>Preview</Text>
      </ExploreBottomSheet>,
    );
    expect(mockBottomSheetProps[0]?.scrollable).toBe(true);
    expect(mockBottomSheetProps[0]?.bottomInset).toBe(83);
  });

  it('forwards sheetList rail mode for BottomSheetFlatList hosts', async () => {
    await render(
      <ExploreBottomSheet sheetList>
        <Text>Rail</Text>
      </ExploreBottomSheet>,
    );
    expect(mockBottomSheetProps[0]?.sheetList).toBe(true);
    expect(mockBottomSheetProps[0]?.scrollable).toBe(false);
  });
});
