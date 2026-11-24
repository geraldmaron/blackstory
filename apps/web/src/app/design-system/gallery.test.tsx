/** The gallery is generated from the kit: these tests are what keep it from drifting. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIXTURES, Gallery, KIT_COMPONENT_NAMES, KIT_TOKEN_NAMES } from './Gallery';

void React;

test('every component the kit exports has a fixture, and no fixture outlives its component', () => {
  assert.deepEqual(Object.keys(FIXTURES).sort(), [...KIT_COMPONENT_NAMES]);
  assert.ok(KIT_COMPONENT_NAMES.includes('Button') && KIT_COMPONENT_NAMES.includes('ExhibitFrame'));
});

test('the gallery renders every component and every token object', () => {
  const html = renderToStaticMarkup(<Gallery />);
  for (const name of KIT_COMPONENT_NAMES) {
    assert.match(html, new RegExp(`data-kit-component="${name}"`), name);
  }
  for (const name of KIT_TOKEN_NAMES) assert.match(html, new RegExp(`id="token-${name}"`), name);
  assert.ok(KIT_TOKEN_NAMES.includes('themePalettes') && KIT_TOKEN_NAMES.includes('motion'));
  // Both themes are listed from the token module, not from a hand-kept table.
  assert.match(html, /themePalettes[\s\S]*light\.canvas[\s\S]*dark\.canvas/);
  assert.doesNotMatch(html, /No fixture/);
});

test('the gallery shows nothing retired', () => {
  const html = renderToStaticMarkup(<Gallery />);
  const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  for (const retired of [/ds-cta/, /ds-band\b/, /ds-plate/, /ds-float\b/, /RoomKit/, /ds-room/]) {
    assert.doesNotMatch(html, retired);
    assert.doesNotMatch(source, retired);
  }
});
