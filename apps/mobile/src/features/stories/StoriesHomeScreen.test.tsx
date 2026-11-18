import { fireEvent, render } from '@testing-library/react-native';
import type { StoryListItemV1 } from '@repo/public-contracts/v1/story';
import { StoriesHomeScreen } from './StoriesHomeScreen';
import { StoryBlocks, StoryReferences } from './StoryBody';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn() },
}));
jest.mock('expo-image', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  return { Image: () => React.createElement(View, { testID: 'expo-image' }) };
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

const item = (over: Partial<StoryListItemV1>): StoryListItemV1 => ({
  slug: 'x',
  title: 'X',
  summary: 'A summary.',
  format: 'chapter',
  eraLabel: '1900',
  placeLabel: 'United States',
  publishedAt: '2026-08-01',
  webPath: '/stories/x',
  ...over,
});

const STORIES = [
  item({ slug: 'the-count', title: 'The Count', webPath: '/stories/the-count' }),
  item({ slug: 'buying-a-home', title: 'Buying a Home', webPath: '/stories/buying-a-home' }),
  item({
    slug: 'abraham-lincoln',
    title: 'Abraham Lincoln',
    format: 'entry',
    collection: { id: 'presidents', label: 'Presidents', position: 16 },
    webPath: '/presidents/abraham-lincoln',
  }),
];

let mockState: unknown = { kind: 'loading' };
jest.mock('./use-stories', () => ({
  useStoryList: () => ({ state: mockState, retry: jest.fn() }),
}));

describe('StoriesHomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockState = {
      kind: 'ready',
      result: {
        status: 'ready',
        value: { releaseId: 'rel', stories: STORIES },
        freshness: { source: 'network', fetchedAt: 0, degraded: false },
      },
    };
  });

  it('features the newest chapter and keeps presidents off the tab', async () => {
    const { getByText, queryByText } = await render(<StoriesHomeScreen />);
    expect(getByText('Start here')).toBeTruthy();
    expect(getByText('The Count')).toBeTruthy();
    expect(getByText('Buying a Home')).toBeTruthy();
    expect(getByText('2 stories')).toBeTruthy();
    expect(queryByText('Abraham Lincoln')).toBeNull();
  });

  it('opens a story at its site path and the presidents from Browse', async () => {
    const { getByText } = await render(<StoriesHomeScreen />);
    await fireEvent.press(getByText('Buying a Home'));
    expect(mockPush).toHaveBeenCalledWith('/stories/buying-a-home');
    await fireEvent.press(getByText('Presidents'));
    expect(mockPush).toHaveBeenCalledWith('/presidents');
  });

  it('says so when offline with nothing saved', async () => {
    mockState = { kind: 'offline-no-cache' };
    const { findByText } = await render(<StoriesHomeScreen />);
    expect(await findByText('You’re offline')).toBeTruthy();
  });
});

describe('StoryBlocks', () => {
  it('renders runs with source numbers, list items, and names web-only blocks', async () => {
    const { findByText, getByText, getByLabelText } = await render(
      <>
        <StoryBlocks
          webUrl="https://blackstory.app/presidents/abraham-lincoln"
          blocks={[
            { type: 'heading', level: 2, text: 'The record' },
            {
              type: 'paragraph',
              runs: [
                { t: 'text', text: 'He signed the act.' },
                { t: 'cite', n: 1, refId: 'nara' },
              ],
            },
            { type: 'list', style: 'bullet', items: [[{ t: 'text', text: 'April 16, 1862' }]] },
            { type: 'webOnly', kind: 'figure', caption: 'Wealth per person' },
          ]}
        />
        <StoryReferences
          references={[{ id: 'nara', label: 'National Archives', url: 'https://www.archives.gov/x' }]}
        />
      </>,
    );
    expect(await findByText('The record')).toBeTruthy();
    expect(getByLabelText('source 1')).toBeTruthy();
    expect(getByText('April 16, 1862')).toBeTruthy();
    expect(getByText('A chart is on the web page')).toBeTruthy();
    expect(getByText('1. National Archives')).toBeTruthy();
  });
});
