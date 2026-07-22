import { loadNativeUpdates } from './native-bridge';

/**
 * Mirrors `src/observability/native-bridge.test.ts`'s bar (there isn't one —
 * that module's loaders are exercised indirectly via `bootstrap.test.ts`) —
 * here the direct contract under test is simpler: NEVER throw, regardless
 * of whether `expo-updates`'s native backing is present in this test
 * environment (it is not — `jest-expo` does not link native modules).
 */
describe('loadNativeUpdates', () => {
  it('never throws, in an environment with no linked native module (default sandbox/CI/jest state)', () => {
    expect(() => loadNativeUpdates()).not.toThrow();
  });

  it('returns either null or a fully-shaped surface — never a partial object', () => {
    const native = loadNativeUpdates();
    if (native === null) {
      expect(native).toBeNull();
      return;
    }
    expect(typeof native.isEnabled).toBe('boolean');
    expect(typeof native.checkForUpdateAsync).toBe('function');
    expect(typeof native.fetchUpdateAsync).toBe('function');
    expect(typeof native.reloadAsync).toBe('function');
  });
});
