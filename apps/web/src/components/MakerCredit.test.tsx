/**
 * Unit coverage for maker attribution markup (GD mark + geralddagher.com link).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAKER } from '@repo/config';
import { MakerCredit } from './MakerCredit';

void React;

// Containment, not `new RegExp(value)`: a URL or a name built into a pattern is data being read
// as syntax, so a dot in the host silently becomes "any character" and CodeQL reads the whole
// thing as unanchored URL matching (js/regex/missing-regexp-anchor).
describe('MakerCredit', () => {
  it('footer variant uses theme marks and links to the personal site', () => {
    const html = renderToStaticMarkup(<MakerCredit variant="footer" />);
    assert.ok(html.includes(`href="${MAKER.url}"`));
    assert.match(html, /Built by/);
    assert.ok(html.includes(MAKER.name));
    assert.ok(html.includes(`src="${MAKER.mark.light}"`));
    assert.ok(html.includes(`src="${MAKER.mark.dark}"`));
    assert.match(html, /ds-maker-credit__mark--theme-light/);
    assert.match(html, /ds-maker-credit__mark--theme-dark/);
    assert.match(html, /ds-maker-credit--footer/);
    assert.match(html, /ds-shell-footer__operator/);
  });

  it('inline variant ships both theme marks for light and dark mode', () => {
    const html = renderToStaticMarkup(<MakerCredit variant="inline" />);
    assert.ok(html.includes(`href="${MAKER.url}"`));
    assert.ok(html.includes(`src="${MAKER.mark.light}"`));
    assert.ok(html.includes(`src="${MAKER.mark.dark}"`));
    assert.match(html, /ds-maker-credit__mark--theme-light/);
    assert.match(html, /ds-maker-credit__mark--theme-dark/);
    assert.match(html, /ds-maker-credit--inline/);
  });
});
