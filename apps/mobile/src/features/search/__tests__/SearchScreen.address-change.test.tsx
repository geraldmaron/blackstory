/**
 * The address changing under an already-mounted Records tab.
 *
 * Its own file rather than a block in `SearchScreen.test.tsx`: these tests type into the field
 * and let a query settle, so they run the debounce and the controller through several states.
 * Sharing a module registry with that file's render/resolve pairs made both sides flaky in
 * either order — a fresh module registry per file is the isolation this behavior needs.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '../SearchScreen';
import {
  buildRuntime,
  fakeReleaseCache,
  flushMicrotasks,
  makeControllableTransport,
  page,
} from '../test-support';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
}));

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

describe('SearchScreen — the address changing under a mounted screen', () => {
  it('does not revert a reader who kept typing when the settled query echoes back through the params', async () => {
    // The screen writes the settled query back with router.setParams so the address stays
    // shareable. That echo returns as a prop, and adopting it would overwrite whatever the
    // reader has typed since the query settled.
    const { transport, calls, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime, recentAdds } = buildRuntime(transport, releaseCache);

    const { rerender, getByLabelText, unmount } = await render(<SearchScreen runtime={runtime} />);
    await flushMicrotasks(10);

    // `fireEvent` and `rerender` (@testing-library/react-native 14) each commit through their own
    // `act()` internally and return that commit's promise -- leaving either un-awaited starts the
    // next one before the first has settled. React then reports overlapping `act()` calls and,
    // having lost track of which commit is current, silently drops a later render in this same
    // module (an empty tree, every query failing "Unable to find an element"). Awaiting every one
    // of them is what keeps renders in this file (and after it) honest.
    await fireEvent.changeText(getByLabelText('Search'), 'dun');
    await waitFor(() => expect(calls.some((c) => c.includes('q=dun'))).toBe(true), {
      timeout: 2000,
    });
    resolveNext(page());
    await waitFor(() =>
      expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ q: 'dun' })),
    );

    await fireEvent.changeText(getByLabelText('Search'), 'dunbar');
    await rerender(<SearchScreen initialQuery="dun" runtime={runtime} />);
    await flushMicrotasks(10);

    expect(getByLabelText('Search').props.value).toBe('dunbar');

    // Settle the request the second keystroke started, so it cannot resolve into the next test.
    await waitFor(() => expect(calls.some((c) => c.includes('q=dunbar'))).toBe(true), {
      timeout: 2000,
    });
    resolveNext(page());
    await waitFor(() =>
      expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ q: 'dunbar' })),
    );
    // A settled query also records a recent search, and that write refreshes state through an
    // async callback. Wait for it here or it lands after this test, inside the next render.
    await waitFor(() => expect(recentAdds).toContain('dunbar'));
    await unmount();
  });

  it('a params-less render (a plain Records tab press) does not clear what the reader typed', async () => {
    // Deliberately asserts only the field: no transport round trip is needed to prove that an
    // absent param leaves the draft alone, and pulling one in would couple this to the debounce.
    const { transport } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    const { rerender, getByLabelText } = await render(
      <SearchScreen initialQuery="tubman" runtime={runtime} />,
    );
    await flushMicrotasks(10);
    expect(getByLabelText('Search').props.value).toBe('tubman');

    await rerender(<SearchScreen runtime={runtime} />);
    await flushMicrotasks(10);

    expect(getByLabelText('Search').props.value).toBe('tubman');
  });

  it('a deep link landing on an already-mounted Records tab still carries its query and kind', async () => {
    // The `/search` and `/history` routes redirect to `/records`. When that tab is already
    // mounted — the app was foregrounded on Records, or the reader has visited it once — the
    // props change but mount-time seeding has already happened, so before this the link arrived
    // and the query silently vanished. Reproduced on an iOS Simulator, 2026-09-07.
    const { transport, calls, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    const { rerender, getByLabelText, unmount } = await render(<SearchScreen runtime={runtime} />);
    await flushMicrotasks(10);
    expect(calls).toHaveLength(0);

    await rerender(<SearchScreen initialQuery="dunbar" initialKind="school" runtime={runtime} />);
    await flushMicrotasks(10);

    expect(getByLabelText('Search').props.value).toBe('dunbar');
    await waitFor(() => expect(calls.some((c) => c.includes('q=dunbar'))).toBe(true), {
      timeout: 2000,
    });
    expect(calls.some((c) => c.includes('kind=school'))).toBe(true);
    resolveNext(page());
    await waitFor(() => expect(getByLabelText('Schools, selected')).toBeTruthy());
    await unmount();
  });

  it('a deep link landing on an already-mounted Records tab carries its era filter too', async () => {
    // `/history?decade=1950s` redirects to `/records?era=1950s`. Records must read the era off
    // the route along with `q` and `kind`, so the phone shows the 1950s slice the web `/records`
    // page shows, not the unfiltered archive index.
    const { transport, calls, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);

    const { rerender, unmount } = await render(<SearchScreen runtime={runtime} />);
    await flushMicrotasks(10);
    expect(calls).toHaveLength(0);

    await rerender(<SearchScreen initialQuery="school" initialEra="1950s" runtime={runtime} />);
    await flushMicrotasks(10);

    await waitFor(() => expect(calls.some((c) => c.includes('era=1950s'))).toBe(true), {
      timeout: 2000,
    });
    resolveNext(page());
    await waitFor(() =>
      expect(router.setParams).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'school', era: '1950s' }),
      ),
    );
    await unmount();
  });
});
