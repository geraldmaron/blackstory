/**
 * Pure session nav selection tests — port of web entity-session-nav semantics.
 */
import {
  back,
  canBack,
  canPickNext,
  createSessionStack,
  orderedEntityIdsFromMapSource,
  pickNext,
  pickPrevious,
  push,
} from '../entity-session-nav';
import {
  readEntitySessionRandomEnabled,
  resetEntitySessionStoreForTests,
  writeEntitySessionRandomEnabled,
} from '../entity-session-store';

beforeEach(() => {
  resetEntitySessionStoreForTests();
});

describe('entity-session-nav', () => {
  const orderedIds = ['a', 'b', 'c'];

  it('pickNext advances sequentially and wraps', () => {
    expect(pickNext({ random: false, currentId: 'a', orderedIds })).toBe('b');
    expect(pickNext({ random: false, currentId: 'c', orderedIds })).toBe('a');
  });

  it('pickPrevious walks backward and wraps', () => {
    expect(pickPrevious({ currentId: 'b', orderedIds })).toBe('a');
    expect(pickPrevious({ currentId: 'a', orderedIds })).toBe('c');
  });

  it('pickNext random uses the randomIndex seam', () => {
    expect(
      pickNext({
        random: true,
        currentId: 'a',
        orderedIds,
        randomIndex: () => 1,
      }),
    ).toBe('c');
  });

  it('canPickNext is false for a singleton catalog', () => {
    expect(canPickNext({ currentId: 'only', orderedIds: ['only'] })).toBe(false);
  });

  it('session stack push/back round-trips', () => {
    let stack = createSessionStack();
    expect(canBack(stack)).toBe(false);
    stack = push(stack, 'a');
    stack = push(stack, 'b');
    const result = back(stack);
    expect(result?.entityId).toBe('b');
    expect(result?.stack).toEqual(['a']);
  });

  it('orderedEntityIdsFromMapSource de-dupes entity ids', () => {
    expect(
      orderedEntityIdsFromMapSource({
        features: [
          { properties: { entityId: 'ent_1' } },
          { properties: { entityId: 'ent_1' } },
          { properties: { entityId: 'ent_2' } },
          { properties: {} },
        ],
      }),
    ).toEqual(['ent_1', 'ent_2']);
  });
});

describe('entity-session-store', () => {
  it('persists random toggle in process memory', () => {
    expect(readEntitySessionRandomEnabled()).toBe(false);
    writeEntitySessionRandomEnabled(true);
    expect(readEntitySessionRandomEnabled()).toBe(true);
  });
});
