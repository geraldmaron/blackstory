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
    assert.match(html, /class="ds-shell-footer__column-title">Where to begin</);
    assert.match(html, /class="ds-shell-footer__column-title">How it decides</);
    assert.match(html, /class="ds-shell-footer__column-title">Add to it</);
    assert.match(html, /href="\/explore"/);
    assert.match(html, /href="\/records"/);
    assert.doesNotMatch(html, /Banned books|\/banned-books|\/journey/);
  });

  it('offers a staff sign-in handoff when an admin origin is configured', () => {
    const previous = process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
    process.env.NEXT_PUBLIC_ADMIN_ORIGIN = 'http://localhost:3001';
    try {
      const html = renderToStaticMarkup(<SiteFooter />);
      assert.match(html, /href="http:\/\/localhost:3001\/login"/);
      assert.match(html, />Staff sign-in</);
      assert.match(html, /rel="nofollow noreferrer"/);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
      else process.env.NEXT_PUBLIC_ADMIN_ORIGIN = previous;
    }
  });

  it('omits the staff link when no admin origin is configured', () => {
    // Production leaves NEXT_PUBLIC_ADMIN_ORIGIN unset unless the console is deployed, so the
    // public site does not advertise an admin console that may not exist at that origin.
    const previousOrigin = process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
    const previousEnv = process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    try {
      const html = renderToStaticMarkup(<SiteFooter />);
      assert.doesNotMatch(html, /Staff sign-in/);
    } finally {
      if (previousOrigin !== undefined) process.env.NEXT_PUBLIC_ADMIN_ORIGIN = previousOrigin;
      if (previousEnv === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
      else process.env.NEXT_PUBLIC_APP_ENV = previousEnv;
    }
  });
});
