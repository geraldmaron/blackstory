/**
 * Cross-browser MapLibre lifecycle contracts (layout wait, resize hooks, WebGL probe).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { containerHasLayout, isWebGlAvailable } from './map-libre-lifecycle';

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
