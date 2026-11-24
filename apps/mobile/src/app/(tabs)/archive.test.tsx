/**
 * The Archive tab's router surface, and the two old tab routes that now forward into it.
 */
import { render } from '@testing-library/react-native';

let mockParams: Record<string, string | string[] | undefined> = {};
const mockRedirect = jest.fn((_props: unknown) => null);
const mockSetParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
  router: { setParams: (params: unknown) => mockSetParams(params), push: jest.fn() },
  Redirect: (props: unknown) => mockRedirect(props),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockSearchScreenSpy = jest.fn((_props: unknown) => null);
jest.mock('@/features/search', () => ({
  SearchScreen: (props: unknown) => mockSearchScreenSpy(props),
}));

const mockExploreViewSpy = jest.fn((_props: unknown) => null);
jest.mock('@/features/explore', () => ({
  ExploreView: (props: unknown) => mockExploreViewSpy(props),
  useExploreMapSource: () => ({
    loadState: { kind: 'idle' },
    usingDemo: false,
  }),
}));

// eslint-disable-next-line import/first
import ArchiveTabScreen, { parseArchiveView } from './archive';
// eslint-disable-next-line import/first
import ExploreRedirectScreen from './explore';
// eslint-disable-next-line import/first
import RecordsRedirectScreen from './records';

beforeEach(() => {
  mockParams = {};
  jest.clearAllMocks();
});

describe('Archive tab', () => {
  it('opens on the map, and on the list only when the address says list', async () => {
    expect(parseArchiveView(undefined)).toBe('map');
    expect(parseArchiveView('timeline')).toBe('map');
    expect(parseArchiveView(['list'])).toBe('list');

    await render(<ArchiveTabScreen />);
    expect(mockExploreViewSpy).toHaveBeenCalled();
    expect(mockSearchScreenSpy).not.toHaveBeenCalled();
  });

  it('names the switch on each segment and marks the current view as selected', async () => {
    mockParams = { view: 'list' };
    const { getByLabelText } = await render(<ArchiveTabScreen />);
    expect(getByLabelText('List, Archive view').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(getByLabelText('Map, Archive view').props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('gives the list the query, kind and era the address carries', async () => {
    mockParams = { view: 'list', q: 'school', kind: 'place', era: '1950s' };
    await render(<ArchiveTabScreen />);
    expect(mockSearchScreenSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: 'school',
        initialKind: 'place',
        initialEra: '1950s',
      }),
    );
  });

  it('drops a malformed era instead of forwarding it raw', async () => {
    mockParams = { view: 'list', era: 'not-a-real-decade-value-thats-too-long' };
    await render(<ArchiveTabScreen />);
    const props = mockSearchScreenSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props.initialEra).toBeUndefined();
    expect(props.initialQuery).toBeUndefined();
  });
});

describe('old tab routes still resolve', () => {
  it('/explore lands on the Archive map with its selected record and filters', async () => {
    mockParams = { selected: 'ent_dunbar_school_001', kind: 'place' };
    await render(<ExploreRedirectScreen />);
    expect(mockRedirect).toHaveBeenCalledWith({
      href: { pathname: '/archive', params: { kind: 'place', selected: 'ent_dunbar_school_001' } },
    });
  });

  it('/records lands on the Archive list with its query, kind and era', async () => {
    mockParams = { q: 'school', kind: 'place', era: '1950s' };
    await render(<RecordsRedirectScreen />);
    expect(mockRedirect).toHaveBeenCalledWith({
      href: {
        pathname: '/archive',
        params: { view: 'list', q: 'school', kind: 'place', era: '1950s' },
      },
    });
  });
});
