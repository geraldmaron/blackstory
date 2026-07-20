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

describe('MakerCredit', () => {
  it('footer variant uses theme marks and links to the personal site', () => {
    const html = renderToStaticMarkup(<MakerCredit variant="footer" />);
    assert.match(html, new RegExp(`href="${MAKER.url}"`));
    assert.match(html, /Built by/);
    assert.match(html, new RegExp(MAKER.name));
    assert.match(html, new RegExp(`src="${MAKER.mark.light}"`));
    assert.match(html, new RegExp(`src="${MAKER.mark.dark}"`));
    assert.match(html, /ds-maker-credit__mark--theme-light/);
    assert.match(html, /ds-maker-credit__mark--theme-dark/);
    assert.match(html, /ds-maker-credit--footer/);
    assert.match(html, /ds-shell-footer__operator/);
  });

  it('inline variant ships both theme marks for light and dark mode', () => {
    const html = renderToStaticMarkup(<MakerCredit variant="inline" />);
    assert.match(html, new RegExp(`href="${MAKER.url}"`));
    assert.match(html, new RegExp(`src="${MAKER.mark.light}"`));
    assert.match(html, new RegExp(`src="${MAKER.mark.dark}"`));
    assert.match(html, /ds-maker-credit__mark--theme-light/);
    assert.match(html, /ds-maker-credit__mark--theme-dark/);
    assert.match(html, /ds-maker-credit--inline/);
  });
});
