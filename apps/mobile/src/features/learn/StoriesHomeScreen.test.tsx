/**
 * StoriesHomeScreen tests: featured band, archive index, and secondary section links.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { StoriesHomeScreen } from './StoriesHomeScreen';

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

describe('StoriesHomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders Stories title and brand lede', async () => {
    const { getByText } = await render(<StoriesHomeScreen />);
    expect(getByText('Stories')).toBeTruthy();
    expect(getByText(/History pinned to place and era/)).toBeTruthy();
  });

  it('shows a featured story band', async () => {
    const { getByText } = await render(<StoriesHomeScreen />);
    expect(getByText('Featured')).toBeTruthy();
    expect(getByText('Read story')).toBeTruthy();
  });

  it('lists archive stories below the featured band', async () => {
    const { getByText } = await render(<StoriesHomeScreen />);
    expect(getByText('In the archive')).toBeTruthy();
  });

  it('navigates to a story when the featured card is pressed', async () => {
    const { getByLabelText } = await render(<StoriesHomeScreen />);
    fireEvent.press(getByLabelText(/Featured story:/));
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/learn\//));
  });

  it('exposes secondary More to read links for History and Myths', async () => {
    const { getByText } = await render(<StoriesHomeScreen />);
    expect(getByText('More to read')).toBeTruthy();
    expect(getByText('History')).toBeTruthy();
    expect(getByText('Myths')).toBeTruthy();
    expect(getByText('Methodology')).toBeTruthy();
  });
});
