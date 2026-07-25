/**
 * Pure state machine for the Cinematic Map Backdrop pattern on mobile
 * (`docs/ui/patterns-cinematic-map.md` §2, §6). No React, no MapLibre — mirrors
 * web's `apps/web/src/components/patterns/cinematic-map/cinematic-map-state.ts`
 * so the rest/invite/engaged contract and the single-feature selection rule
 * cannot drift between platforms, and stays unit-testable in plain Node
 * alongside this repo's other pure map modules (`mapCamera.ts`, `clusterCamera.ts`).
 *
 * Three states only (spec §1): `rest` (locked, default) -> `invite` (optional
 * scroll/beat-driven, still locked) -> `engaged` (hands-on). `close()` always
 * returns to `rest` and clears selection, regardless of which state it is
 * called from (spec §2 rule 4).
 *
 * Selection is single-feature (spec §2 rule 5): `selectedEntityId` holds at
 * most one id, and `select`/`deselect` never touch anything else in state.
 * The paint-side half of that rule (a dedicated, always-mounted selection
 * layer + `filter`, never a whole-source re-encode/refilter) lives in
 * `entity-paint.ts` / `MapScreen.tsx` — this module only tracks which id is
 * selected, not how it paints.
 */

export type CinematicMapState = 'rest' | 'invite' | 'engaged';

export type CinematicMapReducerState = {
  readonly state: CinematicMapState;
  readonly selectedEntityId: string | undefined;
};

export const CINEMATIC_MAP_INITIAL_STATE: CinematicMapReducerState = {
  state: 'rest',
  selectedEntityId: undefined,
};

export type CinematicMapAction =
  /** Rest -> Invite (scroll/beat-driven intro begins). No-op once past Rest. */
  | { readonly type: 'invite' }
  /** Rest|Invite -> Engaged (the reader tapped "Explore the map"). No-op if already Engaged. */
  | { readonly type: 'engage' }
  /** Any state -> Rest. Always deselects (spec §2 rule 4: relock deselects + restores home). */
  | { readonly type: 'close' }
  /** Selects exactly one entity. Selecting the same id again is a no-op (stable reference). */
  | { readonly type: 'select'; readonly entityId: string }
  /** Clears selection. No-op if nothing is selected. */
  | { readonly type: 'deselect' };

export function cinematicMapReducer(
  current: CinematicMapReducerState,
  action: CinematicMapAction,
): CinematicMapReducerState {
  switch (action.type) {
    case 'invite': {
      if (current.state !== 'rest') return current;
      return { ...current, state: 'invite' };
    }
    case 'engage': {
      if (current.state === 'engaged') return current;
      return { ...current, state: 'engaged' };
    }
    case 'close': {
      if (current.state === 'rest' && current.selectedEntityId === undefined) return current;
      return { state: 'rest', selectedEntityId: undefined };
    }
    case 'select': {
      if (current.selectedEntityId === action.entityId) return current;
      // Single-feature: assigning a new id always fully replaces the old one —
      // there is never a set of selected ids, only ever zero or one.
      return { ...current, selectedEntityId: action.entityId };
    }
    case 'deselect': {
      if (current.selectedEntityId === undefined) return current;
      return { ...current, selectedEntityId: undefined };
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
