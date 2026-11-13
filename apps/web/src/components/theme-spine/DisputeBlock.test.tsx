/**
 * Unit coverage for the theme-spine dispute artifact: aria-label presence, both sides render,
 * default vs. overridden label, and parity (both sides share one markup shape and one class, so
 * nothing can favor one source over the other). Styling lives in theme-spine.css on --ds-* tokens,
 * so the same markup is correct in both themes.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DisputeBlock } from './DisputeBlock';

void React;

const sideA = { sourceLabel: '1948 county deed', claim: 'The parcel was platted in 1948.' };
const sideB = { sourceLabel: '1951 city survey', claim: 'The parcel was platted in 1951.' };
const standingLine = 'Both sources are in the archive. They stand side by side, unresolved.';

describe('DisputeBlock', () => {
  it('renders an aside with an aria-label summarizing the contested record', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock sideA={sideA} sideB={sideB} standingLine={standingLine} />,
    );
    assert.match(
      html,
      /<aside[^>]*aria-label="Contested record: The record disagrees with itself"/,
    );
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

  it('gives both sides identical markup and class: nothing can style one over the other', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock sideA={sideA} sideB={sideB} standingLine={standingLine} />,
    );
    const sides = [...html.matchAll(/<div class="ds-dispute__side">(.*?)<\/div>/g)].map((m) =>
      m[1]!.replace(/>[^<]*</g, '><'),
    );
    assert.equal(sides.length, 2);
    assert.equal(sides[0], sides[1]);
  });

  it('theme-independent: no inline style or color literal, only stylesheet classes', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock sideA={sideA} sideB={sideB} standingLine={standingLine} />,
    );
    assert.doesNotMatch(html, /style="/);
    assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(html, /rgb\(/);
  });

  it('passes a placement class through without touching either side', () => {
    const html = renderToStaticMarkup(
      <DisputeBlock
        className="ds-story-wide"
        sideA={sideA}
        sideB={sideB}
        standingLine={standingLine}
      />,
    );
    assert.match(html, /<aside class="ds-dispute ds-story-wide"/);
  });
});
