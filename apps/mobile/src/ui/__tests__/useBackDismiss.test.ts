import { renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { useBackDismiss } from '../useBackDismiss';

describe('useBackDismiss', () => {
  it('consumes back and dismisses only while active', async () => {
    const remove = jest.fn();
    const add = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
    const onDismiss = jest.fn();

    const { rerender } = await renderHook(
      ({ active }: { active: boolean }) => useBackDismiss(active, onDismiss),
      { initialProps: { active: false } },
    );
    expect(add).not.toHaveBeenCalled();

    await rerender({ active: true });
    expect(add).toHaveBeenCalledTimes(1);
    const handler = add.mock.calls[0]![1] as () => boolean;
    expect(handler()).toBe(true);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    await rerender({ active: false });
    expect(remove).toHaveBeenCalledTimes(1);
    add.mockRestore();
  });
});
