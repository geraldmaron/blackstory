/**
 * AboutScreen smoke tests: web mission copy, pillars, CTAs, destinations.
 */
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { AboutScreen } from '../AboutScreen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useNavigation: () => ({ setOptions: jest.fn() }),
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

describe('AboutScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders product thesis, pillars, mission, and close', async () => {
    const { getByText } = await render(<AboutScreen />);
    expect(getByText('History, pinned to place.')).toBeTruthy();
    expect(getByText(/Black history, pinned to the places it happened/)).toBeTruthy();
    expect(getByText('Place, evidence and dignity')).toBeTruthy();
    expect(getByText('Pinned to place')).toBeTruthy();
    expect(getByText('Receipts on every claim')).toBeTruthy();
    expect(getByText('Protections that are enforced')).toBeTruthy();
    expect(getByText('History shouldn’t be erased')).toBeTruthy();
    expect(getByText('It shouldn’t be hard to find')).toBeTruthy();
    expect(getByText('Accessible because it’s about you')).toBeTruthy();
    expect(getByText('Only what’s been checked gets published')).toBeTruthy();
    expect(getByText('No account required')).toBeTruthy();
  });

  it('navigates Explore from the accent CTA', async () => {
    const { getAllByText } = await render(<AboutScreen />);
    fireEvent.press(getAllByText('Open the map')[0]!);
    expect(mockPush).toHaveBeenCalledWith('/explore');
  });

  it('navigates Methodology and Data destinations', async () => {
    const { getByText, getAllByText } = await render(<AboutScreen />);
    fireEvent.press(getAllByText('Methodology')[0]!);
    expect(mockPush).toHaveBeenCalledWith('/methodology');
    fireEvent.press(getByText('Data'));
    expect(mockPush).toHaveBeenCalledWith('/data');
  });
});
