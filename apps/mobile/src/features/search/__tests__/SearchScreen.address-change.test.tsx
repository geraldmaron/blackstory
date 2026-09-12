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
  // Ordered, not incidental. Run after the case that types, a fresh `render` in this file
  // commits an empty tree and every query fails; the same sequence with a trivial component
  // is fine, so it is something this screen leaves in flight rather than the harness. The
  // ordering keeps the assertions honest; the coupling itself is repo-ipdps.
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

    rerender(<SearchScreen runtime={runtime} />);
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

    rerender(<SearchScreen initialQuery="dunbar" initialKind="school" runtime={runtime} />);
    await flushMicrotasks(10);

    expect(getByLabelText('Search').props.value).toBe('dunbar');
    await waitFor(() => expect(calls.some((c) => c.includes('q=dunbar'))).toBe(true), {
      timeout: 2000,
    });
    expect(calls.some((c) => c.includes('kind=school'))).toBe(true);
    resolveNext(page());
    await waitFor(() => expect(getByLabelText('Schools, selected')).toBeTruthy());
    unmount();
  });

  it('does not revert a reader who kept typing when the settled query echoes back through the params', async () => {
    // The screen writes the settled query back with router.setParams so the address stays
    // shareable. That echo returns as a prop, and adopting it would overwrite whatever the
    // reader has typed since the query settled.
    const { transport, calls, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime, recentAdds } = buildRuntime(transport, releaseCache);

    const { rerender, getByLabelText, unmount } = await render(<SearchScreen runtime={runtime} />);
    await flushMicrotasks(10);

    fireEvent.changeText(getByLabelText('Search'), 'dun');
    await waitFor(() => expect(calls.some((c) => c.includes('q=dun'))).toBe(true), {
      timeout: 2000,
    });
    resolveNext(page());
    await waitFor(() =>
      expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ q: 'dun' })),
    );

    fireEvent.changeText(getByLabelText('Search'), 'dunbar');
    rerender(<SearchScreen initialQuery="dun" runtime={runtime} />);
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
    unmount();
  });
});
