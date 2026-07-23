/**
 * Site footer markup contracts: Surface card shell, typographic wordmark, nav columns.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRODUCT_NAME } from '@repo/config';
import { SiteFooter } from './SiteFooter';

void React;

describe('SiteFooter', () => {
  it('renders a theme-aware Surface card with typographic wordmark and job columns', () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    assert.match(html, /class="ds-shell-footer"/);
    assert.match(html, /class="ds-shell-footer__card"/);
    assert.match(html, /class="ds-shell-footer__wordmark"/);
    assert.match(html, new RegExp(`>${PRODUCT_NAME}<`));
    assert.match(html, /People\. Places\. Evidence\. Context\./);
    assert.match(html, /History, pinned to place\./);
    assert.match(html, /aria-label="Footer"/);
    assert.match(html, /class="ds-shell-footer__column-title">Explore</);
    assert.match(html, /class="ds-shell-footer__column-title">Trust</);
    assert.match(html, /class="ds-shell-footer__column-title">Contribute</);
  });
});
