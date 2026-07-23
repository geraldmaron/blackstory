/**
 * DataScreen smoke tests: web `/data` copy, fixture metrics, degraded Census, nav CTAs.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { DataScreen } from '../DataScreen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('react-native-safe-area-context', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children?: unknown; style?: unknown }) =>
      React.createElement(View, { style }, children as never),
    SafeAreaProvider: ({ children }: { children?: unknown }) => children,
  };
});

describe('DataScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders Data title and lede matching web intent', async () => {
    const { getByText } = await render(<DataScreen />);
    expect(getByText('Data behind the archive')).toBeTruthy();
    expect(getByText(/National Census context plus curated indicators/)).toBeTruthy();
  });

  it('shows honest Census degraded empty state', async () => {
    const { getByText } = await render(<DataScreen />);
    expect(getByText('Census timeline not on this release yet')).toBeTruthy();
  });

  it('renders fixture wealth and housing metric titles', async () => {
    const { getByText } = await render(<DataScreen />);
    expect(getByText('Median family net worth, Black vs White')).toBeTruthy();
    expect(getByText('Homeownership by householder race, Cook County')).toBeTruthy();
    expect(getByText('State imprisonment rate, Black vs White adults')).toBeTruthy();
  });

  it('navigates Explore from the Census empty action', async () => {
    const { getByText } = await render(<DataScreen />);
    fireEvent.press(getByText('Open Explore'));
    expect(mockPush).toHaveBeenCalledWith('/explore');
  });

  it('navigates Explore and Methodology from next-step actions', async () => {
    const { getByText } = await render(<DataScreen />);
    fireEvent.press(getByText('Explore the map'));
    expect(mockPush).toHaveBeenCalledWith('/explore');
    fireEvent.press(getByText('Read methodology'));
    expect(mockPush).toHaveBeenCalledWith('/learn/methodology');
  });
});
