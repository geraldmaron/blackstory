/**
 * Site footer markup contracts: theme-aware lockup artwork and nav chrome.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BRAND_ASSETS } from '@repo/config';
import { SiteFooter } from './SiteFooter';

void React;

describe('SiteFooter', () => {
  it('ships both theme lockups for light and dark canvas plates', () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    assert.match(html, new RegExp(`src="${BRAND_ASSETS.lockup.light}"`));
    assert.match(html, new RegExp(`src="${BRAND_ASSETS.lockup.dark}"`));
    assert.match(html, /ds-shell-footer__wordmark--theme-light/);
    assert.match(html, /ds-shell-footer__wordmark--theme-dark/);
    assert.match(html, /class="ds-shell-footer"/);
  });
});
