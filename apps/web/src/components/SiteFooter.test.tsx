/**
 * Site footer markup contracts: two rows, lockup artwork, sentence-case link columns.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRODUCT_NAME } from '@repo/config';
import { SiteFooter } from './SiteFooter';

void React;

describe('SiteFooter', () => {
  it('renders two rows: lockup, one sentence and link columns; then the fine print', () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    assert.match(html, /class="ds-shell-footer"/);
    // The lockup artwork, not the name typed as display text.
    assert.match(html, /class="ds-shell-footer__brand ds-shell-wordmark"/);
    assert.match(html, /ds-shell-wordmark__img--theme-light/);
    assert.match(html, /ds-shell-wordmark__img--theme-dark/);
    assert.match(html, new RegExp(`aria-label="${PRODUCT_NAME}, home"`));
    assert.match(html, /AI helps with the research and drafting here/);
    assert.match(html, /href="\/methodology#how-a-record-gets-in"/);
    assert.match(html, /aria-label="Footer"/);
    assert.match(html, /class="ds-shell-footer__column-title"[^>]*>Find</);
    assert.match(html, /class="ds-shell-footer__column-title"[^>]*>Collections</);
    assert.match(html, /class="ds-shell-footer__column-title"[^>]*>How it decides</);
    assert.match(html, /class="ds-shell-footer__column-title"[^>]*>Add to it</);
    assert.match(html, /href="\/archive"/);
    assert.match(html, /href="\/archive\?view=map"/);
    assert.match(html, /href="\/stories"/);
    assert.doesNotMatch(html, /href="\/(?:explore|records|collections)"/);
    assert.match(html, /href="\/presidents"/);
    assert.match(html, new RegExp(`© \\d{4} ${PRODUCT_NAME}<`));
    assert.match(html, /aria-label="Policies"/);
    // Banned books is a shipped reading room and belongs in the footer; `/banned-books` is a
    // path that has never existed and must never be linked.
    assert.match(html, />Banned books</);
    assert.doesNotMatch(html, /\/banned-books|\/journey/);
    assert.doesNotMatch(html, /href="\/chapters"|href="\/library"|href="\/history"/);
    // Every destination link carries its catalog glyph beside the word, decorative only; the
    // legal row stays plain. No tagline, no mono caps.
    const nav = html.slice(
      html.indexOf('aria-label="Footer"'),
      html.indexOf('aria-label="Policies"'),
    );
    const links = nav.match(/<a /g)?.length ?? 0;
    const glyphs = nav.match(/<svg[^>]*aria-hidden="true"/g)?.length ?? 0;
    assert.ok(links > 0 && glyphs === links, `${glyphs} glyphs for ${links} footer links`);
    assert.doesNotMatch(html.slice(html.indexOf('aria-label="Policies"')), /<svg/);
    assert.doesNotMatch(html, /People\. Places\. Evidence\. Context\./);
    assert.doesNotMatch(html, /ds-mono/);
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
