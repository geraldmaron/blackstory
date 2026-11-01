/**
 * Guards the compact collision between the lifted on-map controls and the collection strip
 * caption: with a sheet open over a collection, the group steps aside (portrait only).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(
  new URL('../components/map-experience/map-controls.css', import.meta.url),
  'utf8',
);
const selector = ".ds-atlas[data-sheet-open='true'][data-collection='shown'] .ds-map-controls";

function mediaBefore(index: number): string {
  return css.slice(css.lastIndexOf('@media', index), index);
}

test('Controls are hidden while a sheet is open over a collection strip on compact screens', () => {
  const first = css.indexOf(selector);
  assert.ok(first >= 0, 'compact collision rule exists');
  assert.match(mediaBefore(first), /@media \(max-width: 819px\), \(max-height: 559px\)/);
  const body = css.slice(first, css.indexOf('}', first));
  assert.match(body, /visibility: hidden/);
  assert.match(body, /pointer-events: none/);
});

test('Landscape phones, which have no lift, keep the controls; desktop has no rule', () => {
  const first = css.indexOf(selector);
  const restore = css.lastIndexOf(selector);
  assert.notEqual(restore, first, 'landscape restore exists');
  assert.match(mediaBefore(restore), /orientation: landscape/);
  assert.match(css.slice(restore, css.indexOf('}', restore)), /visibility: visible/);
});
