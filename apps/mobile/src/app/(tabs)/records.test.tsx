/**
 * Records tab — route param wiring (repo-vlf0w).
 *
 * `/history?decade=1950s` redirects to `/records?era=1950s` on the promise that a link shared
 * from either surface lands on the same view. That promise holds only if this screen reads `era`
 * off `parseFilterState`'s result and not just `{ kind }`: a screen that drops `era` shows the
 * unfiltered archive index where web's `/records` shows the 1950s slice. This test never reaches
 * the real search runtime/
 * transport (that round trip is covered in `features/search/__tests__/SearchScreen.address-
 * change.test.tsx`); it only asserts that this screen reads `era` off the route and forwards it.
 */
import { render } from '@testing-library/react-native';

let mockParams: Record<string, string | string[] | undefined> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));

const mockSearchScreenSpy = jest.fn((_props: unknown) => null);
jest.mock('@/features/search', () => ({
  SearchScreen: (props: unknown) => mockSearchScreenSpy(props),
}));

jest.mock('@/features/explore', () => ({
  useExploreMapSource: () => ({
    loadState: { kind: 'idle' },
    usingDemo: false,
  }),
}));

// eslint-disable-next-line import/first
import RecordsTabScreen from './records';

beforeEach(() => {
  mockParams = {};
  mockSearchScreenSpy.mockClear();
});

describe('RecordsTabScreen — reads q, kind and era off the route (repo-vlf0w)', () => {
  it('forwards an era carried by a `/history` → `/records` deep link to SearchScreen', async () => {
    mockParams = { q: 'school', kind: 'place', era: '1950s' };

    await render(<RecordsTabScreen />);

    expect(mockSearchScreenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ initialQuery: 'school', initialKind: 'place', initialEra: '1950s' }),
    );
  });

  it('passes no initialEra when the route carries none, rather than a stray empty string', async () => {
    mockParams = { q: 'school' };

    await render(<RecordsTabScreen />);

    const props = mockSearchScreenSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props.initialEra).toBeUndefined();
  });

  it('drops an oversized/malformed era value via the existing parseFilterState validation, rather than forwarding it raw', async () => {
    mockParams = { era: 'not-a-real-decade-value-thats-too-long' };

    await render(<RecordsTabScreen />);

    const props = mockSearchScreenSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props.initialEra).toBeUndefined();
  });
});
