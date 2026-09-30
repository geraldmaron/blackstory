/**
 * Cross-browser MapLibre lifecycle contracts (layout wait, resize hooks, WebGL probe).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  containerHasLayout,
  isWebGlAvailable,
  resizeMapInPlace,
  type ResizableMap,
} from './map-libre-lifecycle';

const here = dirname(fileURLToPath(import.meta.url));
const mapStageSource = readFileSync(join(here, '../../components/map-stage/MapStage.tsx'), 'utf8');
const lifecycleSource = readFileSync(join(here, 'map-libre-lifecycle.ts'), 'utf8');

describe('map-libre-lifecycle', () => {
  it('probes WebGL availability without throwing in Node', () => {
    assert.equal(isWebGlAvailable(), false);
  });

  it('binds orientation and visibility resize hooks', () => {
    assert.match(lifecycleSource, /orientationchange/);
    assert.match(lifecycleSource, /visibilitychange/);
    assert.match(lifecycleSource, /ResizeObserver/);
  });

  it('documents WebGL context loss recovery', () => {
    assert.match(lifecycleSource, /webglcontextlost/);
    assert.match(lifecycleSource, /webglcontextrestored/);
  });
});

describe('map mount contracts', () => {
  it('MapStage uses shared resize lifecycle and WebGL guard', () => {
    assert.match(mapStageSource, /bindMapResizeLifecycle/);
    assert.match(mapStageSource, /isWebGlAvailable/);
    assert.match(mapStageSource, /bindWebGlContextRecovery/);
    assert.match(mapStageSource, /readonly resize/);
  });

  it('MapStage is the only module that constructs a MapLibre instance', () => {
    // This replaces the EntityLocationMap case. That component was the second mount these shared
    // helpers existed to keep consistent; SP-08 deleted it, and consistency-between-two-mounts is
    // no longer the property worth asserting — "there is only one mount" is stronger and is the
    // acceptance criterion. Scoped to src so the check cannot be satisfied by deleting a file.
    const mounts = execFileSync('grep', ['-rl', 'new maplibregl.Map', join(here, '../..')], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((line: string) => line.length > 0)
      .map((line: string) => line.replace(/^.*\/src\//, 'src/'))
      // A test that names the constructor is not a mount — this file matches itself otherwise.
      .filter((path: string) => !/\.test\.[cm]?tsx?$/.test(path))
      .sort();
    assert.deepEqual(mounts, ['src/components/map-stage/MapStage.tsx']);
  });

  it('rejects a zero-size container before map resize', () => {
    assert.equal(
      containerHasLayout({ getBoundingClientRect: () => ({ width: 0, height: 0 }) } as HTMLElement),
      false,
    );
  });
});

/**
 * A stand-in that resizes the way MapLibre's `_resizeCanvas` does, and records whether the canvas
 * was left wiped: `resize()` clears the drawing buffer and only `redraw()` paints it again.
 */
function fakeMap(box: { width: number; height: number }, pixelRatio = 2) {
  const canvas = { width: 0, height: 0, style: { width: '', height: '' } };
  const state = { pixelRatio, resizes: 0, wiped: false };
  const map: ResizableMap = {
    getContainer: () => ({ clientWidth: box.width, clientHeight: box.height }) as HTMLElement,
    getCanvas: () => canvas as unknown as HTMLCanvasElement,
    getPixelRatio: () => state.pixelRatio,
    resize: () => {
      state.resizes += 1;
      canvas.width = Math.floor(state.pixelRatio * box.width);
      canvas.height = Math.floor(state.pixelRatio * box.height);
      canvas.style.width = `${box.width}px`;
      canvas.style.height = `${box.height}px`;
      state.wiped = true;
    },
    redraw: () => {
      state.wiped = false;
    },
  };
  return { map, state };
}

describe('resizeMapInPlace', () => {
  it('repaints in the same call, so no frame composites an empty canvas', () => {
    const box = { width: 375, height: 812 };
    const { map, state } = fakeMap(box);
    assert.equal(resizeMapInPlace(map), true);
    assert.equal(state.wiped, false);
  });

  it('skips a resize the canvas already matches, since even a same-size one wipes the buffer', () => {
    const box = { width: 375, height: 812 };
    const { map, state } = fakeMap(box);
    resizeMapInPlace(map);
    assert.equal(resizeMapInPlace(map), false);
    assert.equal(state.resizes, 1);
  });

  it('resizes when the container or the pixel ratio changes', () => {
    const box = { width: 375, height: 812 };
    const { map, state } = fakeMap(box);
    resizeMapInPlace(map);
    box.height = 756;
    assert.equal(resizeMapInPlace(map), true);
    state.pixelRatio = 3;
    assert.equal(resizeMapInPlace(map), true);
    assert.equal(state.resizes, 3);
    assert.equal(state.wiped, false);
  });

  it('is the only way MapStage resizes the map', () => {
    // A bare `map.resize()` from a rAF or event handler leaves a blank frame; see the helper.
    const bare = mapStageSource
      .split('\n')
      .filter((line) => /\.resize\(\)/.test(line) && !/^\s*(\*|\/\/)/.test(line));
    assert.deepEqual(bare, []);
  });
});
