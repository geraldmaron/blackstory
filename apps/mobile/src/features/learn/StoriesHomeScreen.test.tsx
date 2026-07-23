/**
 * StoriesHomeScreen tests: featured band, archive index, and secondary context links.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { StoriesHomeScreen } from './StoriesHomeScreen';
import { listStoryEntries } from './story-index';

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
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe('StoriesHomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders History pinned to place title and brand lede', async () => {
    const { getByText } = await render(<StoriesHomeScreen />);
    expect(getByText('History pinned to place')).toBeTruthy();
    expect(getByText(/Each piece links to the records it rests on/)).toBeTruthy();
  });

  it('shows a featured story band', async () => {
    const { getByText } = await render(<StoriesHomeScreen />);
    expect(getByText('Start here')).toBeTruthy();
    expect(getByText('Read story')).toBeTruthy();
  });

  it('lists archive stories below the featured band', async () => {
    const { getByText } = await render(<StoriesHomeScreen />);
    expect(getByText('Published stories')).toBeTruthy();
  });

  it('counts the whole catalog, not just the rows below the featured band', async () => {
    const total = listStoryEntries().length;
    const { getByText } = await render(<StoriesHomeScreen />);
    // Featured is one of these stories, so the count must include it (regression: it used to
    // advertise "3 stories" for a 4-story catalog by counting only the archive rows).
    expect(total).toBeGreaterThan(1);
    expect(getByText(`${total} stories`)).toBeTruthy();
  });

  it('navigates to a story when the featured card is pressed', async () => {
    const { getByLabelText } = await render(<StoriesHomeScreen />);
    fireEvent.press(getByLabelText(/Featured story:/));
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/learn\//));
  });

  it('lists only non-longform sections under More to read (no dup of longform stories)', async () => {
    const { getByText, queryByText } = await render(<StoriesHomeScreen />);
    expect(getByText('More to read')).toBeTruthy();
    // Methodology is not longform, so it belongs here.
    expect(getByText('Methodology')).toBeTruthy();
    // History and Myths are longform: they already appear in the archive index above, so they
    // must NOT be repeated as section links here.
    expect(queryByText('History')).toBeNull();
    expect(queryByText('Myths')).toBeNull();
  });
});
