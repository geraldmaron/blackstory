/**
 * `useAnnounceOnMount` (MOB-017): the cross-platform VoiceOver announcement primitive that
 * `Notice`/`ErrorState` rely on to cover iOS, where `accessibilityLiveRegion` has no effect.
 * These tests exercise the hook directly (rather than only indirectly through a consuming
 * component) so its "announce exactly once per mount, and only once" contract is pinned down on
 * its own.
 */
import { renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useAnnounceOnMount } from '../useAnnounceOnMount';

// A single persistent spy, cleared (not restored) before every test — this preset backs
// `AccessibilityInfo`'s methods with module-level jest mocks, so re-spying per test would leave
// an earlier test's call history visible to a later one.
const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});

beforeEach(() => {
  announce.mockClear();
});

describe('useAnnounceOnMount', () => {
  it('announces the message exactly once on mount', async () => {
    await renderHook(() => useAnnounceOnMount('Correction received'));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Correction received');
  });

  it('does not announce when enabled is false', async () => {
    await renderHook(() => useAnnounceOnMount('Should stay silent', false));
    expect(announce).not.toHaveBeenCalled();
  });

  it('does not announce an empty/whitespace-only message', async () => {
    await renderHook(() => useAnnounceOnMount('   '));
    expect(announce).not.toHaveBeenCalled();
  });

  it('never re-announces when the message changes after the initial mount (a relative "ago" label ticking, for example)', async () => {
    const { rerender } = await renderHook(({ message }: { message: string }) => useAnnounceOnMount(message), {
      initialProps: { message: 'Correction received 1 minute ago' },
    });
    expect(announce).toHaveBeenCalledTimes(1);

    await rerender({ message: 'Correction received 2 minutes ago' });
    await rerender({ message: 'Correction received 3 minutes ago' });

    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('announces again after a full unmount + remount (e.g. the sheet reopening)', async () => {
    const first = await renderHook(() => useAnnounceOnMount('Failed to load'));
    expect(announce).toHaveBeenCalledTimes(1);
    await first.unmount();

    await renderHook(() => useAnnounceOnMount('Failed to load'));
    expect(announce).toHaveBeenCalledTimes(2);
  });
});
