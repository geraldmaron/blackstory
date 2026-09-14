/**
 * AppBottomSheet accessibility contract: the sheet body is never collapsed into one element, the
 * backdrop is not a focus stop over the map, the adjustable handle really adjusts, and reduced
 * motion turns detent travel instant.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockSheetProps: Record<string, unknown>[] = [];
const mockBackdropProps: Record<string, unknown>[] = [];

jest.mock('@gorhom/bottom-sheet', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheet = (props: Record<string, unknown>) => {
    mockSheetProps.push(props);
    const handle = props.handleComponent as (() => unknown) | undefined;
    const backdrop = props.backdropComponent as ((mockArg: unknown) => unknown) | undefined;
    return React.createElement(
      View,
      { testID: 'sheet-host' },
      backdrop ? backdrop({ style: {}, animatedIndex: { value: 0 } }) : null,
      handle ? handle() : null,
      props.children as never,
    );
  };
  const Passthrough = ({ children, testID }: { children?: unknown; testID?: string }) =>
    React.createElement(View, { testID }, children as never);
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: Passthrough,
    BottomSheetScrollView: Passthrough,
    BottomSheetBackdrop: (props: Record<string, unknown>) => {
      mockBackdropProps.push(props);
      return null;
    },
    useBottomSheetTimingConfigs: (config: unknown) => config,
  };
});

// eslint-disable-next-line import/first
import { AppBottomSheet, sheetSnapValueText } from '../AppBottomSheet';
// eslint-disable-next-line import/first
import { duration } from '../tokens';

function lastSheetProps() {
  return mockSheetProps[mockSheetProps.length - 1]!;
}

beforeEach(() => {
  mockSheetProps.length = 0;
  mockBackdropProps.length = 0;
});

describe('AppBottomSheet — screen reader reachability', () => {
  it('opts the sheet body out of gorhom’s accessible + adjustable default so its rows stay reachable', async () => {
    const { getByText } = await render(
      <AppBottomSheet accessibilityLabel="Explore records sheet">
        <Text>Howard Theatre</Text>
      </AppBottomSheet>,
    );
    expect(lastSheetProps().accessible).toBe(false);
    expect(lastSheetProps().accessibilityRole).toBeNull();
    expect(getByText('Howard Theatre')).toBeTruthy();
  });

  it('keeps the backdrop out of the accessibility tree, so it is no invisible stop over the map', async () => {
    await render(
      <AppBottomSheet>
        <Text>Body</Text>
      </AppBottomSheet>,
    );
    expect(mockBackdropProps[mockBackdropProps.length - 1]?.accessible).toBe(false);
  });
});

describe('AppBottomSheet — adjustable handle', () => {
  it('speaks the current detent as its value', async () => {
    const { getByTestId } = await render(
      <AppBottomSheet snapIndex={1}>
        <Text>Body</Text>
      </AppBottomSheet>,
    );
    const handle = getByTestId('app-bottom-sheet-handle');
    expect(handle.props.accessibilityRole).toBe('adjustable');
    expect(handle.props.accessibilityValue).toEqual({ text: 'Half height' });
    expect(handle.props.accessibilityActions).toEqual([
      { name: 'increment' },
      { name: 'decrement' },
    ]);
  });

  it('raises and lowers the sheet one detent per adjust action, clamped at both ends', async () => {
    const onSnapIndexChange = jest.fn();
    const { getByTestId, rerender } = await render(
      <AppBottomSheet snapIndex={1} onSnapIndexChange={onSnapIndexChange}>
        <Text>Body</Text>
      </AppBottomSheet>,
    );
    const adjust = (name: string) =>
      fireEvent(getByTestId('app-bottom-sheet-handle'), 'accessibilityAction', {
        nativeEvent: { actionName: name },
      });

    await adjust('increment');
    expect(onSnapIndexChange).toHaveBeenLastCalledWith(2);
    await adjust('decrement');
    expect(onSnapIndexChange).toHaveBeenLastCalledWith(0);

    onSnapIndexChange.mockClear();
    await rerender(
      <AppBottomSheet snapIndex={2} onSnapIndexChange={onSnapIndexChange}>
        <Text>Body</Text>
      </AppBottomSheet>,
    );
    await adjust('increment');
    expect(onSnapIndexChange).not.toHaveBeenCalled();
  });

  it('falls back to a position when the sheet does not have three detents', () => {
    expect(sheetSnapValueText(0, 3)).toBe('Collapsed');
    expect(sheetSnapValueText(2, 3)).toBe('Full height');
    expect(sheetSnapValueText(1, 2)).toBe('2 of 2');
  });
});

describe('AppBottomSheet — reduced motion', () => {
  it('makes detent travel instant and skips the mount animation and overdrag', async () => {
    await render(
      <AppBottomSheet reduceMotion>
        <Text>Body</Text>
      </AppBottomSheet>,
    );
    const props = lastSheetProps();
    expect(props.animationConfigs).toEqual({ duration: duration.durationInstant });
    expect(props.animateOnMount).toBe(false);
    expect(props.enableOverDrag).toBe(false);
  });

  it('keeps the short detent animation when motion is allowed', async () => {
    await render(
      <AppBottomSheet>
        <Text>Body</Text>
      </AppBottomSheet>,
    );
    const props = lastSheetProps();
    expect(props.animationConfigs).toEqual({ duration: duration.durationFast });
    expect(props.animateOnMount).toBe(true);
  });
});
