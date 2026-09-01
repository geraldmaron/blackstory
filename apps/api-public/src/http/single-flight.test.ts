/**
 * Unit tests for catalog-load single-flight (concurrent cold starts collapse to one load).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSingleFlight } from './single-flight.js';

test('createSingleFlight shares one in-flight promise per key', async () => {
  const singleFlight = createSingleFlight();
  let loads = 0;
  const load = async () => {
    loads += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 'ok';
  };

  const [a, b] = await Promise.all([singleFlight('catalog', load), singleFlight('catalog', load)]);

  assert.equal(a, 'ok');
  assert.equal(b, 'ok');
  assert.equal(loads, 1);
});

test('createSingleFlight releases the key after settle so later loads run again', async () => {
  const singleFlight = createSingleFlight();
  let loads = 0;
  const load = async () => {
    loads += 1;
    return loads;
  };

  assert.equal(await singleFlight('k', load), 1);
  assert.equal(await singleFlight('k', load), 2);
});
