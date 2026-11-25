import { renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useAnnounceOnChange } from '../useAnnounceOnChange';

const announce = jest
  .spyOn(AccessibilityInfo, 'announceForAccessibility')
  .mockImplementation(() => {});

beforeEach(() => {
  announce.mockClear();
});

describe('useAnnounceOnChange', () => {
  it('announces each new non-empty message and stays silent for empty or repeated ones', async () => {
    const { rerender } = await renderHook(
      ({ message }: { message: string | null }) => useAnnounceOnChange(message),
      { initialProps: { message: null as string | null } },
    );
    expect(announce).not.toHaveBeenCalled();

    await rerender({ message: '3 records shown' });
    await rerender({ message: '3 records shown' });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith('3 records shown');

    // Settling again: silent while empty, then the same words are news once more.
    await rerender({ message: '   ' });
    expect(announce).toHaveBeenCalledTimes(1);
    await rerender({ message: '3 records shown' });
    expect(announce).toHaveBeenCalledTimes(2);
  });
});
