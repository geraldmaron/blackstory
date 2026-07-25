/**
 * `useCinematicMap` wiring tests — the RN-idiomatic hook layer over
 * `cinematic-map-state.ts` (`docs/ui/patterns-cinematic-map.md` §6). Confirms
 * the camera side of the contract: `close()`/`select()`/`flyTo()` always
 * resolve through `mapCamera.ts`'s `cameraForPreset` (never ad hoc easing or
 * targets), and every camera command carries a strictly-increasing `token` so
 * `MapScreen` applies each one exactly once.
 *
 * `@testing-library/react-native` in this repo does not export `renderHook`,
 * so the hook is exercised through a tiny harness component (same technique
 * this suite would use for any other hook-only module) rather than mounting a
 * full screen.
 */
import { act, create } from 'react-test-renderer';
import { useCinematicMap, type UseCinematicMapResult } from '../useCinematicMap';
import { cameraForPreset, US_BOUNDS } from '../mapCamera';

function Harness({ onResult }: { onResult: (result: UseCinematicMapResult) => void }) {
  const result = useCinematicMap({ homePreset: 'national' });
  onResult(result);
  return null;
}

function mountHook(): { current: UseCinematicMapResult } {
  const ref: { current: UseCinematicMapResult | null } = { current: null };
  act(() => {
    create(<Harness onResult={(result) => (ref.current = result)} />);
  });
  return ref as { current: UseCinematicMapResult };
}

describe('useCinematicMap', () => {
  it('starts at rest, unselected, with no pending camera command', () => {
    const hook = mountHook();
    expect(hook.current.state).toBe('rest');
    expect(hook.current.selectedEntityId).toBeUndefined();
    expect(hook.current.cameraCommand).toBeUndefined();
  });

  it('engage() moves rest -> engaged without touching the camera', () => {
    const hook = mountHook();
    act(() => hook.current.engage());
    expect(hook.current.state).toBe('engaged');
    expect(hook.current.cameraCommand).toBeUndefined();
  });

  it('select() sets the single selected id and, given a point, frames it via the point preset', () => {
    const hook = mountHook();
    act(() => hook.current.select('ent_1', { point: [-77.04, 38.9] }));

    expect(hook.current.selectedEntityId).toBe('ent_1');
    expect(hook.current.cameraCommand).toEqual({
      ...cameraForPreset('point', { point: [-77.04, 38.9] }),
      token: 1,
    });
  });

  it('select() without a point selects but issues no camera command', () => {
    const hook = mountHook();
    act(() => hook.current.select('ent_1'));
    expect(hook.current.selectedEntityId).toBe('ent_1');
    expect(hook.current.cameraCommand).toBeUndefined();
  });

  it('deselect() clears selection without moving the camera', () => {
    const hook = mountHook();
    act(() => hook.current.select('ent_1', { point: [-77.04, 38.9] }));
    act(() => hook.current.deselect());
    expect(hook.current.selectedEntityId).toBeUndefined();
    // The camera command from selection is still the last-issued one; deselect
    // does not append a new one (matches web parity: deselect never flies).
    expect(hook.current.cameraCommand?.token).toBe(1);
  });

  it('close() deselects, returns to rest, and flies to the home preset', () => {
    const hook = mountHook();
    act(() => hook.current.engage());
    act(() => hook.current.select('ent_1', { point: [-77.04, 38.9] }));
    act(() => hook.current.close());

    expect(hook.current.state).toBe('rest');
    expect(hook.current.selectedEntityId).toBeUndefined();
    expect(hook.current.cameraCommand).toEqual({
      ...cameraForPreset('national'),
      token: 2,
    });
    expect(hook.current.cameraCommand?.kind).toBe('bounds');
    expect((hook.current.cameraCommand as { bounds?: readonly number[] }).bounds).toEqual([
      ...US_BOUNDS,
    ]);
  });

  it('camera command tokens strictly increase across successive moves', () => {
    const hook = mountHook();
    act(() => hook.current.select('ent_1', { point: [-77.04, 38.9] }));
    const first = hook.current.cameraCommand?.token;
    act(() => hook.current.flyTo('state', { coordinates: [[-77.04, 38.9]] }));
    const second = hook.current.cameraCommand?.token;
    expect(first).toBe(1);
    expect(second).toBe(2);
  });
});
