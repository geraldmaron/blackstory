/**
 * navigateBackOrFallback — history when available, tab/section fallback otherwise.
 */
import { navigateBackOrFallback, type NavigateBackPort } from './navigate-back';

function fakePort(overrides: Partial<NavigateBackPort> = {}): NavigateBackPort & {
  calls: { back: number; replace: string[] };
} {
  const calls = { back: 0, replace: [] as string[] };
  return {
    canGoBack: () => false,
    back: () => {
      calls.back += 1;
    },
    replace: (href) => {
      calls.replace.push(href);
    },
    calls,
    ...overrides,
  };
}

describe('navigateBackOrFallback', () => {
  it('calls back when history exists', () => {
    const port = fakePort({ canGoBack: () => true });
    navigateBackOrFallback('/explore', port);
    expect(port.calls.back).toBe(1);
    expect(port.calls.replace).toEqual([]);
  });

  it('replaces with fallback when history is empty', () => {
    const port = fakePort({ canGoBack: () => false });
    navigateBackOrFallback('/more', port);
    expect(port.calls.back).toBe(0);
    expect(port.calls.replace).toEqual(['/more']);
  });
});
