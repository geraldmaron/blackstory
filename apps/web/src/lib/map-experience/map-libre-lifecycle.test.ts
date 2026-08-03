/**
 * Cross-browser MapLibre lifecycle contracts (layout wait, resize hooks, WebGL probe).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { containerHasLayout, isWebGlAvailable } from './map-libre-lifecycle';

const here = dirname(fileURLToPath(import.meta.url));
const mapStageSource = readFileSync(join(here, '../../app/(map)/MapStage.tsx'), 'utf8');
const entityMapSource = readFileSync(
  join(here, '../../components/entity/EntityLocationMap.tsx'),
  'utf8',
);
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

  it('EntityLocationMap waits for layout and shares lifecycle helpers', () => {
    assert.match(entityMapSource, /waitForContainerLayout/);
    assert.match(entityMapSource, /bindMapResizeLifecycle/);
    assert.match(entityMapSource, /isWebGlAvailable/);
    assert.match(entityMapSource, /role="status"/);
  });

  it('rejects a zero-size container before map resize', () => {
    assert.equal(
      containerHasLayout({ getBoundingClientRect: () => ({ width: 0, height: 0 }) } as HTMLElement),
      false,
    );
  });
});
