/**
 * DOM entity marker keying (repo-pgzr): closing a record card must not mass-unmount and
 * recreate the marker collection — only genuinely new/stale entity ids may mount/unmount,
 * and the zoom gate must unmount discs the moment a camera ease crosses it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { diffEntityMarkerIds, shouldMountEntityMarkers } from './entity-marker-diff';

const here = dirname(fileURLToPath(import.meta.url));
const mapStageSource = readFileSync(join(here, '../../app/(map)/MapStage.tsx'), 'utf8');

describe('diffEntityMarkerIds', () => {
  it('keeps every id present on both sides — identical sets produce no churn', () => {
    const ids = ['a', 'b', 'c'];
    const diff = diffEntityMarkerIds(ids, ids);
    assert.deepEqual([...diff.keep].sort(), ['a', 'b', 'c']);
    assert.deepEqual(diff.add, []);
    assert.deepEqual(diff.remove, []);
  });

  it('adds only new ids and removes only stale ids', () => {
    const diff = diffEntityMarkerIds(['a', 'b'], ['b', 'c']);
    assert.deepEqual(diff.keep, ['b']);
    assert.deepEqual(diff.add, ['c']);
    assert.deepEqual(diff.remove, ['a']);
  });

  it('a selection change is not a set change — no add/remove for the same feature list', () => {
    // Closing a record card only changes which id is selected; the id set is unchanged, so
    // the diff must be pure keeps (the single-feature invariant on the DOM path).
    const mounted = ['clearview', 'pinchback', 'switchback'];
    const diff = diffEntityMarkerIds(mounted, mounted);
    assert.equal(diff.keep.length, 3);
    assert.equal(diff.add.length + diff.remove.length, 0);
  });
});

describe('shouldMountEntityMarkers', () => {
  it('gates DOM discs to zooms strictly above clusterMaxZoom', () => {
    assert.equal(shouldMountEntityMarkers(12, 12), false);
    assert.equal(shouldMountEntityMarkers(11.9, 12), false);
    assert.equal(shouldMountEntityMarkers(12.1, 12), true);
  });
});

describe('MapStage marker sync wiring', () => {
  it('reuses mounted markers keyed by entityId instead of clearing the collection first', () => {
    // The old implementation opened with clearMarkers(markers) unconditionally — the
    // mass-rebuild that flashed every pin. The keyed path must consult the mounted map.
    assert.match(mapStageSource, /const mounted = mountedById\.get\(entityId\)/);
    assert.doesNotMatch(
      mapStageSource,
      /function syncCircularMarkers\([^)]*\): void \{\s*clearMarkers\(markers\);/,
    );
  });

  it('unmounts discs at the zoom-gate crossing during camera flights (zoom event, not zoomend only)', () => {
    assert.match(
      mapStageSource,
      /activeMap\.on\('zoom', \(\) => \{[\s\S]*?shouldMountEntityMarkers\([\s\S]*?clearMarkers\(markersRef\.current\)/,
    );
  });
});
