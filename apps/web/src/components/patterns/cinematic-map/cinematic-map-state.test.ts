/**
 * Unit tests for the Cinematic Map Backdrop pure state machine (`docs/ui/patterns-cinematic-map.md`
 * §2, §9 "Pure state machine ... unit tested"). No DOM/visual assertions — mirrors
 * `components/patterns/browse-mode.test.tsx`'s plain `node:test` style for this family's helpers.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CINEMATIC_MAP_INITIAL_STATE,
  cinematicMapReducer,
  type CinematicMapReducerState,
} from './cinematic-map-state';

describe('cinematicMapReducer', () => {
  it('starts at rest with no selection', () => {
    assert.equal(CINEMATIC_MAP_INITIAL_STATE.state, 'rest');
    assert.equal(CINEMATIC_MAP_INITIAL_STATE.selectedEntityId, undefined);
  });

  it('walks rest -> invite -> engaged -> rest', () => {
    let state = CINEMATIC_MAP_INITIAL_STATE;

    state = cinematicMapReducer(state, { type: 'invite' });
    assert.equal(state.state, 'invite');

    state = cinematicMapReducer(state, { type: 'engage' });
    assert.equal(state.state, 'engaged');

    state = cinematicMapReducer(state, { type: 'close' });
    assert.equal(state.state, 'rest');
    assert.equal(state.selectedEntityId, undefined);
  });

  it('engage can be reached directly from rest, skipping invite', () => {
    const engaged = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' });
    assert.equal(engaged.state, 'engaged');
  });

  it('invite is a no-op once past rest (idempotent, never regresses engaged -> invite)', () => {
    const engaged = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' });
    const stillEngaged = cinematicMapReducer(engaged, { type: 'invite' });
    assert.equal(stillEngaged, engaged, 'invite must return the same reference (no-op)');
  });

  it('engage is idempotent — re-dispatching while already engaged returns the same reference', () => {
    const engaged = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' });
    const stillEngaged = cinematicMapReducer(engaged, { type: 'engage' });
    assert.equal(stillEngaged, engaged);
  });

  it('close always returns to rest and deselects, from any state', () => {
    const invited = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'invite' });
    const selectedInInvite = cinematicMapReducer(invited, { type: 'select', entityId: 'e-1' });
    const closedFromInvite = cinematicMapReducer(selectedInInvite, { type: 'close' });
    assert.deepEqual(closedFromInvite, { state: 'rest', selectedEntityId: undefined });

    const engagedWithSelection = cinematicMapReducer(
      cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' }),
      { type: 'select', entityId: 'e-2' },
    );
    const closedFromEngaged = cinematicMapReducer(engagedWithSelection, { type: 'close' });
    assert.deepEqual(closedFromEngaged, { state: 'rest', selectedEntityId: undefined });
  });

  it('close is a no-op (same reference) if already at rest with nothing selected', () => {
    const closed = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'close' });
    assert.equal(closed, CINEMATIC_MAP_INITIAL_STATE);
  });

  describe('single-feature selection', () => {
    it('select sets exactly one selectedEntityId', () => {
      const state = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, {
        type: 'select',
        entityId: 'e-1',
      });
      assert.equal(state.selectedEntityId, 'e-1');
    });

    it('selecting a different entity fully replaces the previous selection — never a set', () => {
      let state: CinematicMapReducerState = CINEMATIC_MAP_INITIAL_STATE;
      state = cinematicMapReducer(state, { type: 'select', entityId: 'e-1' });
      state = cinematicMapReducer(state, { type: 'select', entityId: 'e-2' });
      assert.equal(state.selectedEntityId, 'e-2');
    });

    it('re-selecting the same id is a no-op (same reference, no redundant paint dispatch)', () => {
      const first = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, {
        type: 'select',
        entityId: 'e-1',
      });
      const second = cinematicMapReducer(first, { type: 'select', entityId: 'e-1' });
      assert.equal(second, first);
    });

    it('deselect clears the selection without changing state (rest/invite/engaged)', () => {
      const engaged = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'engage' });
      const selected = cinematicMapReducer(engaged, { type: 'select', entityId: 'e-1' });
      const deselected = cinematicMapReducer(selected, { type: 'deselect' });
      assert.equal(deselected.selectedEntityId, undefined);
      assert.equal(deselected.state, 'engaged');
    });

    it('deselect is a no-op (same reference) when nothing is selected', () => {
      const deselected = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, { type: 'deselect' });
      assert.equal(deselected, CINEMATIC_MAP_INITIAL_STATE);
    });

    it('selecting then deselecting returns to the pre-selection value — no residual selection state', () => {
      const selected = cinematicMapReducer(CINEMATIC_MAP_INITIAL_STATE, {
        type: 'select',
        entityId: 'e-1',
      });
      const deselected = cinematicMapReducer(selected, { type: 'deselect' });
      assert.deepEqual(deselected, CINEMATIC_MAP_INITIAL_STATE);
    });
  });
});
