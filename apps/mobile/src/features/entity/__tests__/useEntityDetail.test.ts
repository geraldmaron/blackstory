import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useEntityDetail } from '../useEntityDetail';
import type { EntityDataDeps } from '../dataClient';
import { fullEntityFixture } from '../testFixtures';

function depsResolvingTo(readJson: jest.Mock): EntityDataDeps {
  return {
    transport: { readJson },
    releaseCache: {
      getActiveStamp: jest.fn().mockResolvedValue(undefined),
      applyReleaseStamp: jest.fn().mockResolvedValue(0),
      write: jest.fn().mockResolvedValue(undefined),
      verifyAndWriteArtifact: jest.fn(),
      read: jest.fn().mockResolvedValue(undefined),
    },
    store: { delete: jest.fn().mockResolvedValue(undefined) },
    connectivity: { getState: () => 'online', isOnline: () => true, subscribe: () => () => {} },
    now: () => 1_753_000_000_000,
  };
}

describe('useEntityDetail', () => {
  it('resolves to ready (starting kind is "loading" before the fetch settles — see useEntityDetail\'s initial state)', async () => {
    const readJson = jest.fn().mockResolvedValue({ kind: 'ok', data: fullEntityFixture('place') });
    const deps = depsResolvingTo(readJson);
    const { result } = await renderHook(() => useEntityDetail('ent_place_full_001', deps));

    // `renderHook` already flushes pending effects/microtasks before resolving, so by the time
    // `result` is observable the fetch may already have settled — assert the eventual state
    // rather than a point-in-time snapshot that would otherwise be racy.
    await waitFor(() => expect(result.current.state.kind).toBe('ready'));
  });

  it('does not re-fetch when the caller passes a NEW (un-memoized) deps object on every render — a real footgun this hook guards against', async () => {
    const readJson = jest.fn().mockResolvedValue({ kind: 'ok', data: fullEntityFixture('place') });
    // Deliberately construct a fresh `EntityDataDeps` object inline on every render, the exact
    // mistake an undisciplined call site could make.
    const { result, rerender } = await renderHook(() => useEntityDetail('ent_place_full_001', depsResolvingTo(readJson)));
    await waitFor(() => expect(result.current.state.kind).toBe('ready'));
    await rerender();
    await rerender();
    await rerender();
    expect(readJson).toHaveBeenCalledTimes(1);
  });

  it('does nothing (stays loading) when deps are not yet resolved', async () => {
    const { result } = await renderHook(() => useEntityDetail('ent_place_full_001', undefined));
    expect(result.current.state.kind).toBe('loading');
  });

  it('retry re-fetches and can move from error back to ready', async () => {
    const readJson = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ kind: 'ok', data: fullEntityFixture('place') });
    const deps = depsResolvingTo(readJson);
    const { result } = await renderHook(() => useEntityDetail('ent_place_full_001', deps));

    await waitFor(() => expect(result.current.state.kind).toBe('error'));

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.state.kind).toBe('ready');
  });
});
