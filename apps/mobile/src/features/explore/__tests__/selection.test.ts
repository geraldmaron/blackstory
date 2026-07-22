/**
 * Safe selection restoration (MOB-012) — mirrors MOB-008's parseRestoredRoute.
 */
import { parseRestoredSelection, reconcileSelection } from '../selection';
import { SEPARATED } from '../__fixtures__/features';

describe('parseRestoredSelection', () => {
  it('restores a valid id that still exists', () => {
    expect(parseRestoredSelection('a', SEPARATED)).toEqual({ selectedId: 'a' });
  });

  it('falls back gracefully when the entity was withdrawn/released-out', () => {
    expect(parseRestoredSelection('deleted_entity_001', SEPARATED)).toEqual({ reason: 'withdrawn' });
  });

  it('rejects a malformed / hostile id without crashing', () => {
    expect(parseRestoredSelection('../../etc/passwd', SEPARATED).selectedId).toBeUndefined();
    expect(parseRestoredSelection({ evil: true }, SEPARATED).selectedId).toBeUndefined();
    expect(parseRestoredSelection('A'.repeat(5000), SEPARATED).selectedId).toBeUndefined();
  });

  it('treats missing selection as "none"', () => {
    expect(parseRestoredSelection(undefined, SEPARATED)).toEqual({ reason: 'none' });
    expect(parseRestoredSelection(null, SEPARATED)).toEqual({ reason: 'none' });
  });
});

describe('reconcileSelection', () => {
  it('keeps an existing selection and drops a vanished one', () => {
    expect(reconcileSelection('a', SEPARATED)).toBe('a');
    expect(reconcileSelection('gone', SEPARATED)).toBeUndefined();
    expect(reconcileSelection(undefined, SEPARATED)).toBeUndefined();
  });
});
