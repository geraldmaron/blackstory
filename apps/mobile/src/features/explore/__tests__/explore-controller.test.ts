/**
 * The Explore reducer: the no-focus-theft proof (MOB-012).
 *
 * These are the authoritative unit assertions for the trickiest bead requirement.
 * They prove at the shared-state level that:
 *   - scrolling the list NEVER moves the camera, and
 *   - panning the map NEVER resets/steals the list,
 * because only explicit selection/preset actions emit a `cameraCommand`.
 */
import {
  exploreReducer,
  initialExploreState,
  visibleFeatures,
  type ExploreState,
} from '../explore-controller';
import { MAP_MAX_ZOOM } from '@/features/map/mapCamera';
import { SEPARATED } from '../__fixtures__/features';

const base = (): ExploreState => initialExploreState();

describe('no focus theft', () => {
  it('listScrolled is a pure no-op: no camera command, no viewport change', () => {
    const start: ExploreState = { ...base(), viewport: { west: -100, south: 30, east: -80, north: 40 } };
    const next = exploreReducer(start, { type: 'listScrolled' });
    expect(next).toBe(start); // identical reference — nothing changed
    expect(next.cameraCommand).toBeUndefined();
  });

  it('viewportChanged updates the visible set but never emits a camera command', () => {
    const next = exploreReducer(base(), {
      type: 'viewportChanged',
      bbox: { west: -100, south: 30, east: -80, north: 40 },
    });
    expect(next.viewport).toEqual({ west: -100, south: 30, east: -80, north: 40 });
    expect(next.cameraCommand).toBeUndefined();
  });
});

describe('explicit intents move the camera', () => {
  it('entitySelected selects AND emits a point camera command at/under the zoom ceiling', () => {
    const next = exploreReducer(base(), {
      type: 'entitySelected',
      entityId: 'b',
      point: [-95.37, 29.76],
    });
    expect(next.selectedId).toBe('b');
    expect(next.cameraCommand).toBeDefined();
    if (next.cameraCommand?.kind === 'center') {
      expect(next.cameraCommand.zoom).toBeLessThanOrEqual(MAP_MAX_ZOOM);
    }
  });

  it('presetRequested emits a camera command; consuming it clears it exactly once', () => {
    const selected = exploreReducer(base(), { type: 'presetRequested', preset: 'national' });
    const token = selected.cameraCommand?.token;
    expect(token).toBeDefined();
    const consumed = exploreReducer(selected, { type: 'cameraCommandConsumed', token: token! });
    expect(consumed.cameraCommand).toBeUndefined();
    // A stale token does not re-clear or throw.
    const again = exploreReducer(consumed, { type: 'cameraCommandConsumed', token: token! });
    expect(again).toBe(consumed);
  });

  it('camera command tokens strictly increase so each move fires once', () => {
    const s1 = exploreReducer(base(), { type: 'presetRequested', preset: 'national' });
    const s2 = exploreReducer(s1, { type: 'entitySelected', entityId: 'b', point: [-95.37, 29.76] });
    expect((s2.cameraCommand?.token ?? 0) > (s1.cameraCommand?.token ?? 0)).toBe(true);
  });
});

describe('filters are deterministic and reflected in the visible set', () => {
  it('same filter state always yields the same visible features', () => {
    const s = exploreReducer(base(), { type: 'filtersChanged', filters: { kind: 'place' } });
    const a = visibleFeatures(SEPARATED, s).map((f) => f.id);
    const b = visibleFeatures(SEPARATED, s).map((f) => f.id);
    expect(a).toEqual(b);
    expect(a).toEqual(['a', 'c']);
  });

  it('viewport intersects with filters for the visible list', () => {
    let s = exploreReducer(base(), { type: 'filtersChanged', filters: {} });
    // Viewport around DC only (a): excludes Houston (b) and LA (c).
    s = exploreReducer(s, {
      type: 'viewportChanged',
      bbox: { west: -78, south: 38, east: -76, north: 40 },
    });
    expect(visibleFeatures(SEPARATED, s).map((f) => f.id)).toEqual(['a']);
  });
});

describe('withdrawn selection after a release change', () => {
  it('drops a selection whose entity no longer exists in the population', () => {
    let s = exploreReducer(base(), { type: 'entitySelected', entityId: 'gone', point: [-90, 35] });
    expect(s.selectedId).toBe('gone');
    s = exploreReducer(s, { type: 'availableReconciled', available: SEPARATED });
    expect(s.selectedId).toBeUndefined();
  });

  it('keeps a selection that still exists', () => {
    let s = exploreReducer(base(), { type: 'entitySelected', entityId: 'a', point: [-77.04, 38.9] });
    s = exploreReducer(s, { type: 'availableReconciled', available: SEPARATED });
    expect(s.selectedId).toBe('a');
  });
});
