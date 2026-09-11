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
    assert.match(html, /aria-label="BlackStory"/);
    assert.match(html, /href="\/"/);
    assert.match(html, new RegExp(`>${PRODUCT_NAME}<`));
    assert.match(html, /People\. Places\. Evidence\. Context\./);
    assert.match(html, /History, pinned to place\./);
    assert.match(html, /aria-label="Footer"/);
    assert.match(html, /class="ds-shell-footer__column-title">Find</);
    assert.match(html, /class="ds-shell-footer__column-title">Read deeper</);
    assert.match(html, /class="ds-shell-footer__column-title">How it decides</);
    assert.match(html, /class="ds-shell-footer__column-title">Add to it</);
    assert.match(html, /href="\/explore"/);
    assert.match(html, /href="\/stories"/);
    assert.match(html, /href="\/records"/);
    assert.match(html, /href="\/rooms"/);
    // Banned books is a shipped reading room and belongs in the footer; `/banned-books` is a
    // path that has never existed and must never be linked.
    assert.match(html, />Banned books</);
    assert.doesNotMatch(html, /\/banned-books|\/journey/);
    assert.doesNotMatch(html, /href="\/chapters"|href="\/library"|href="\/history"/);
  });

  it('offers a staff sign-in handoff to the in-app admin console', () => {
    // /admin is a route inside this same app now, so the link is always present — no sibling
    // origin to configure, and nothing to advertise or withhold based on deployment.
    const html = renderToStaticMarkup(<SiteFooter />);
    assert.match(html, /href="\/admin\/login"/);
    assert.match(html, />Staff sign-in</);
    assert.match(html, /rel="nofollow"/);
  });
});
