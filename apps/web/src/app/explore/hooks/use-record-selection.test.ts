/**
 * Map pin selection opens the record sheet on the plate. Holding-place walks stay a
 * sheet CTA, not a navigation hijack of the click.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('./use-record-selection.ts', import.meta.url)),
  'utf8',
);

test('pin select does not navigate to a holding place or entity page', () => {
  assert.doesNotMatch(source, /walkHoldingPlace/);
  assert.doesNotMatch(source, /location\.assign/);
  assert.doesNotMatch(source, /isHoldingPlaceHref/);
});

test('locator underlay pin clicks open the sheet through the catalog, not a place href', () => {
  assert.match(source, /subscribeExplorePinSelect/);
  assert.match(source, /resolveExplorePinEntityId/);
  assert.match(source, /selectById\(entityId\)/);
  assert.match(source, /lastUnderlayPinRef/);
  assert.match(source, /selectedId\.startsWith\('pin-'\)/);
});

test('sheet record resolves from the full catalog when the lens filtered the sort list', () => {
  assert.match(
    source,
    /sorted\.find\(\(feature\) => feature\.properties\.entityId === selectedId\) \?\?[\s\S]*featuresById\.get\(selectedId\)/,
  );
});
