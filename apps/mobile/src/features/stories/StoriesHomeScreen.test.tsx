/**
 * The Stories tab home: the authored landing, not a flat list.
 *
 * The previous generation asserted a "More to read" band that pointed at `/learn/history`,
 * `/learn/myths` and `/learn/methodology` — two of those were the same publication surface under
 * different addresses, and the third was reference material filed inside the narrative tab.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { StoriesHomeScreen } from './StoriesHomeScreen';
import { listStoriesOfFormat, listStoryEntries } from './story-index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('expo-image', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: () => React.createElement(View, { testID: 'expo-image' }),
  };
});

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

  it('renders the masthead and a lede that names all three formats', async () => {
    const { getByText, getByTestId, getByLabelText } = await render(<StoriesHomeScreen />);
    expect(getByText('History pinned to place')).toBeTruthy();
    expect(getByText(/Chapters, shorter entries, and corrections/)).toBeTruthy();
    expect(getByTestId('edition-brand-header')).toBeTruthy();
    expect(getByLabelText('BlackStory')).toBeTruthy();
  });

  it('leads with a Start here band', async () => {
    const { getByText } = await render(<StoriesHomeScreen />);
    expect(getByText('Start here')).toBeTruthy();
    expect(getByText('Read story')).toBeTruthy();
  });

  it('counts the whole catalog, not just the rows below the featured band', async () => {
    const total = listStoryEntries().length;
    const { getByText } = await render(<StoriesHomeScreen />);
    expect(total).toBeGreaterThan(1);
    expect(getByText(`${total} stories`)).toBeTruthy();
  });

  it('bands the remaining stories by editorial format', async () => {
    const { getByText, queryByText } = await render(<StoriesHomeScreen />);
    // Corrections exist in the catalog and get their own band: the format survived the retirement
    // of the standalone /myths surface.
    expect(listStoriesOfFormat('myth').length).toBeGreaterThan(0);
    expect(getByText('Corrections')).toBeTruthy();
    expect(getByText('Entries')).toBeTruthy();
    // No band renders for a format with nothing in it.
    const chapters = listStoriesOfFormat('chapter');
    if (chapters.length <= 1) expect(queryByText('Chapters')).toBeNull();
  });

  it('offers Themes and Records under Browse, and no supporting page', async () => {
    const { getByText, queryByText } = await render(<StoriesHomeScreen />);
    expect(getByText('Browse')).toBeTruthy();
    expect(getByText('Themes')).toBeTruthy();
    expect(getByText('Records')).toBeTruthy();
    // Reference material belongs to More, not to the narrative tab.
    expect(queryByText('Methodology')).toBeNull();
    expect(queryByText('More to read')).toBeNull();
  });

  it('navigates to a canonical /stories address, never /learn', async () => {
    const { getByLabelText } = await render(<StoriesHomeScreen />);
    fireEvent.press(getByLabelText(/Featured story:/));
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/stories\//));
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringMatching(/^\/learn/));
  });
});
