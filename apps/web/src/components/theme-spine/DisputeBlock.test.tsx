/**
 * Unit coverage for the theme-spine dispute artifact: aria-label presence, both sides render,
 * default vs. overridden label, and typographic parity (no divergent per-side styling that
 * would visually favor one source over the other). Theming here is pure CSS custom properties
 * (`var(--ds-*)`) with no JS branching, so the same markup is correct in both `light` and
 * `dark` — verified by asserting no hardcoded color literal ever appears in the rendered style.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DisputeBlock } from './DisputeBlock';

void React;

const sideA = { sourceLabel: '1948 county deed', claim: 'The parcel was platted in 1948.' };
const sideB = { sourceLabel: '1951 city survey', claim: 'The parcel was platted in 1951.' };
const standingLine =
  'Both documents are in the archive. We show them side by side and let the contradiction stand.';

describe('DisputeBlock', () => {
  it('renders an aside with an aria-label summarizing the contested record', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock sideA={sideA} sideB={sideB} standingLine={standingLine} />,
    );
    assert.match(html, /<aside[^>]*aria-label="Contested record: The record disagrees with itself"/);
  });

  it('renders both sides with their source labels and the standing line', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock sideA={sideA} sideB={sideB} standingLine={standingLine} />,
    );
    assert.match(html, /The parcel was platted in 1948\./);
    assert.match(html, /1948 county deed/);
    assert.match(html, /The parcel was platted in 1951\./);
    assert.match(html, /1951 city survey/);
    assert.match(html, new RegExp(standingLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  it('uses the default label when none is supplied', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock sideA={sideA} sideB={sideB} standingLine={standingLine} />,
    );
    assert.match(html, /The record disagrees with itself/);
  });

  it('uses a custom label when supplied, overriding the default', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock
        label="Two accepted claims, one street"
        sideA={sideA}
        sideB={sideB}
        standingLine={standingLine}
      />,
    );
    assert.match(html, /Two accepted claims, one street/);
    assert.doesNotMatch(html, /The record disagrees with itself/);
  });

  it('gives both sides identical typography — no divergent per-side styling', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock sideA={sideA} sideB={sideB} standingLine={standingLine} />,
    );
    const paragraphStyles = [...html.matchAll(/<p class="ds-sans" style="([^"]*)"/g)].map(
      (match) => match[1],
    );
    // Two side paragraphs share one style string; a third (standing line) paragraph differs
    // only by omitting italic, so isolate the two side paragraphs and diff them directly.
    const sideStyles = paragraphStyles.filter((style) => style?.includes('font-style:italic'));
    assert.equal(sideStyles.length, 2);
    assert.equal(sideStyles[0], sideStyles[1]);
  });

  it('theme-independent: all colors come from --ds-* custom properties, never a hardcoded hex/rgb', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock sideA={sideA} sideB={sideB} standingLine={standingLine} />,
    );
    assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(html, /rgb\(/);
    assert.match(html, /var\(--ds-accent\)/);
    assert.match(html, /var\(--ds-ink\)/);
    assert.match(html, /var\(--ds-rule\)/);
  });
});
