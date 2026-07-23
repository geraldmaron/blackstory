/**
 * Screen-level tests: deep-link round trip, browse mode (no enumeration), and the honest
 * degraded/offline states actually reaching the rendered UI, not just the controller's internal
 * state (MOB-013 item 7 and the offline requirement in item 5).
 *
 * Uses `waitFor` (rather than manual microtask flushing + a bare assertion) for anything that
 * depends on the controller's async `onChange` callback re-rendering the screen -- that update
 * happens outside a React-tracked event, so the assertion must poll/re-check, not assume a single
 * flush already landed.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TransportError } from '@/data';
import { SearchScreen } from '../SearchScreen';
import { buildRuntime, fakeReleaseCache, flushMicrotasks, makeControllableTransport, page } from '../test-support';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
}));

// SearchScreen now measures its bottom inset from the live tab bar via `useScreenScrollInsets()`
// → `useSafeAreaInsets()`, which throws without a provider. Supply a minimal safe-area context
// (zero insets) so the screen renders under test exactly as it would inside `<SafeAreaProvider>`.
jest.mock('react-native-safe-area-context', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children?: unknown; style?: unknown }) =>
      React.createElement(View, { style }, children as never),
    SafeAreaProvider: ({ children }: { children?: unknown }) => children,
    SafeAreaInsetsContext: React.createContext(null),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// eslint-disable-next-line import/first
import { router } from 'expo-router';

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
  (router.setParams as jest.Mock).mockClear();
});

describe('SearchScreen — deep-link round trip (MOB-013 item 7)', () => {
  it('an initialQuery prop (as the route would derive from a deep-linked `q` param) drives an immediate search', async () => {
    const { transport, calls, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    await render(<SearchScreen initialQuery="harriet tubman" runtime={runtime} />);

    await waitFor(() => expect(calls.some((c) => c.includes('q=harriet+tubman'))).toBe(true));
    resolveNext(page());
    await flushMicrotasks(10);
  });

  it('reflects the settled query back into the route params via router.setParams (so the deep link stays shareable)', async () => {
    const { transport, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    await render(<SearchScreen initialQuery="harriet tubman" initialKind="person" runtime={runtime} />);
    await flushMicrotasks(10);
    resolveNext(page());

    await waitFor(() =>
      expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ q: 'harriet tubman', kind: 'person' })),
    );
  });

  it('an empty initialQuery renders browse mode, not a request', async () => {
    const { transport, calls } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    const { getByText } = await render(<SearchScreen runtime={runtime} />);
    await flushMicrotasks(10);

    expect(calls).toHaveLength(0);
    expect(getByText('By category')).toBeTruthy();
  });
});

describe('SearchScreen — browse mode never enumerates (T3)', () => {
  it('renders category chips and an empty recent-searches prompt without ever calling the transport', async () => {
    const { transport, calls } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    const { getByText } = await render(<SearchScreen runtime={runtime} />);
    await flushMicrotasks(10);

    expect(getByText('Start searching')).toBeTruthy();
    expect(getByText('Organizations')).toBeTruthy();
    expect(calls).toEqual([]);
  });
});

describe('SearchScreen — result rendering', () => {
  it('renders a successful result', async () => {
    const { transport, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    const { getByText } = await render(<SearchScreen initialQuery="tubman" runtime={runtime} />);
    await flushMicrotasks(10);
    resolveNext(page());

    await waitFor(() => expect(getByText('Harriet Tubman')).toBeTruthy());
  });

  it('wires Show on map to Explore with selected id and kind', async () => {
    const { transport, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    const { getByLabelText } = await render(<SearchScreen initialQuery="tubman" runtime={runtime} />);
    await flushMicrotasks(10);
    resolveNext(page());

    await waitFor(() => expect(getByLabelText('Show Harriet Tubman on map')).toBeTruthy());
    fireEvent.press(getByLabelText('Show Harriet Tubman on map'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/explore',
      params: { selected: 'ent_1', kind: 'person' },
    });
  });
});

describe('SearchScreen — offline states reach the actual rendered UI (never a silent hang)', () => {
  it('shows an explicit "You\'re offline" state when there is no compatible cache', async () => {
    const { transport, rejectNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache(undefined);
    const { runtime } = buildRuntime(transport, releaseCache);

    const { getByText } = await render(<SearchScreen initialQuery="nobody searched this yet" runtime={runtime} />);
    await flushMicrotasks(10);
    rejectNext(new TransportError('offline', { kind: 'network', attempts: 4 }));

    await waitFor(() => expect(getByText("You're offline")).toBeTruthy());
  });

  it('labels a served cached page as saved/offline, never as live', async () => {
    const { transport, resolveNext, rejectNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    // First mount fetches successfully and populates the cache under stamp r1.
    const first = await render(<SearchScreen initialQuery="tubman" runtime={runtime} />);
    await flushMicrotasks(10);
    resolveNext(page());
    await flushMicrotasks(10);
    first.unmount();

    // A second screen instance (e.g. re-opening the tab) issues a fresh request that now fails.
    const { getByText } = await render(<SearchScreen initialQuery="tubman" runtime={runtime} />);
    await flushMicrotasks(10);
    rejectNext(new TransportError('offline', { kind: 'network', attempts: 4 }));

    await waitFor(() => expect(getByText(/Showing saved results/)).toBeTruthy());
  });
});
