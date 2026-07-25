/**
 * Unit tests for the mobile Cinematic Map Backdrop pure state machine
 * (`docs/ui/patterns-cinematic-map.md` §2, §9). Mirrors web's
 * `cinematic-map-state.test.ts` assertions so the two platforms' contracts
 * cannot silently drift.
 */
import {
  CINEMATIC_MAP_INITIAL_STATE,
  cinematicMapReducer,
  type CinematicMapReducerState,
} from '../cinematic-map-state';

describe('cinematicMapReducer', () => {
  it('starts at rest with no selection', () => {
    expect(CINEMATIC_MAP_INITIAL_STATE.state).toBe('rest');
    expect(CINEMATIC_MAP_INITIAL_STATE.selectedEntityId).toBeUndefined();
  });

  it('walks rest -> invite -> engaged -> rest', () => {
    let state = CINEMATIC_MAP_INITIAL_STATE;

    state = cinematicMapReducer(state, { type: 'invite' });
    expect(state.state).toBe('invite');

    state = cinematicMapReducer(state, { type: 'engage' });
    expect(state.state).toBe('engaged');

    state = cinematicMapReducer(state, { type: 'close' });
    expect(state.state).toBe('rest');
    expect(state.selectedEntityId).toBeUndefined();
  });

  it('engage can be reached directly from rest, skipping invite', () => {
    const engaged = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' });
    expect(engaged.state).toBe('engaged');
  });

  it('invite is a no-op once past rest (idempotent, never regresses engaged -> invite)', () => {
    const engaged = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' });
    const stillEngaged = cinematicMapReducer(engaged, { type: 'invite' });
    expect(stillEngaged).toBe(engaged);
  });

  it('engage is idempotent — re-dispatching while already engaged returns the same reference', () => {
    const engaged = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' });
    const stillEngaged = cinematicMapReducer(engaged, { type: 'engage' });
    expect(stillEngaged).toBe(engaged);
  });

  it('close always returns to rest and deselects, from any state', () => {
    const invited = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'invite' });
    const selectedInInvite = cinematicMapReducer(invited, { type: 'select', entityId: 'e-1' });
    const closedFromInvite = cinematicMapReducer(selectedInInvite, { type: 'close' });
    expect(closedFromInvite).toEqual({ state: 'rest', selectedEntityId: undefined });

    const engagedWithSelection = cinematicMapReducer(
      cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' }),
      { type: 'select', entityId: 'e-2' },
    );
    const closedFromEngaged = cinematicMapReducer(engagedWithSelection, { type: 'close' });
    expect(closedFromEngaged).toEqual({ state: 'rest', selectedEntityId: undefined });
  });

  it('close is a no-op (same reference) if already at rest with nothing selected', () => {
    const closed = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'close' });
    expect(closed).toBe(CINEMATIC_MAP_INITIAL_STATE);
  });

  describe('single-feature selection', () => {
    it('select sets exactly one selectedEntityId', () => {
      const state = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, {
        type: 'select',
        entityId: 'e-1',
      });
      expect(state.selectedEntityId).toBe('e-1');
    });

    it('selecting a different entity fully replaces the previous selection — never a set', () => {
      let state: CinematicMapReducerState = CINEMATIC_MAP_INITIAL_STATE;
      state = cinematicMapReducer(state, { type: 'select', entityId: 'e-1' });
      state = cinematicMapReducer(state, { type: 'select', entityId: 'e-2' });
      expect(state.selectedEntityId).toBe('e-2');
    });

    it('re-selecting the same id is a no-op (same reference, no redundant paint dispatch)', () => {
      const first = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, {
        type: 'select',
        entityId: 'e-1',
      });
      const second = cinematicMapReducer(first, { type: 'select', entityId: 'e-1' });
      expect(second).toBe(first);
    });

    it('deselect clears the selection without changing state (rest/invite/engaged)', () => {
      const engaged = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' });
      const selected = cinematicMapReducer(engaged, { type: 'select', entityId: 'e-1' });
      const deselected = cinematicMapReducer(selected, { type: 'deselect' });
      expect(deselected.selectedEntityId).toBeUndefined();
      expect(deselected.state).toBe('engaged');
    });

    it('deselect is a no-op (same reference) when nothing is selected', () => {
      const deselected = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'deselect' });
      expect(deselected).toBe(CINEMATIC_MAP_INITIAL_STATE);
    });

    it('selecting then deselecting returns to the pre-selection value — no residual selection state', () => {
      const selected = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, {
        type: 'select',
        entityId: 'e-1',
      });
      const deselected = cinematicMapReducer(selected, { type: 'deselect' });
      expect(deselected).toEqual(CINEMATIC_MAP_INITIAL_STATE);
    });

    it('a neighbor entity id is never touched by selecting/deselecting a different one', () => {
      const selectedA = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, {
        type: 'select',
        entityId: 'neighbor-a',
      });
      const selectedB = cinematicMapReducer(selectedA, { type: 'select', entityId: 'neighbor-b' });
      // Single string field: selecting b can never leave a's id lingering anywhere in state.
      expect(selectedB.selectedEntityId).toBe('neighbor-b');
      expect(JSON.stringify(selectedB)).not.toContain('neighbor-a');
    });
  });
});
