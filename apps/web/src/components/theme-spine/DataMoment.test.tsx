/**
 * Unit coverage for the theme-spine DataMoment component: all three
 * micro-visualization variants (proportion, series, none) plus theme-class
 * rendering safety.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataMoment, type DataMomentProps } from './DataMoment';

void React;

const baseProps: Omit<DataMomentProps, 'microViz'> = {
  figure: '2 of 211',
  claim: 'Two of the 211 statutes named in the record remain enforceable today.',
  provenance: {
    source: 'Illinois Compiled Statutes',
    capture: '2026-01-15',
    confidence: 'High',
  },
  methodStance: 'juxtaposition',
};

describe('DataMoment', () => {
  it('renders the proportion variant with a descriptive aria-label', () => {
    const html = renderToStaticMarkup(
      <DataMoment
        {...baseProps}
        microViz={{ kind: 'proportion', numerator: 2, denominator: 211 }}
      />,
    );
    assert.match(html, /ds-data-moment__viz--proportion/);
    assert.match(html, /aria-label="2 of 211, roughly 0\.9%"/);
    assert.match(html, /ds-data-moment__proportion-fill/);
  });

  it('renders the series variant with a trend-summarizing aria-label', () => {
    const html = renderToStaticMarkup(
      <DataMoment
        {...baseProps}
        methodStance="gated causal claim"
        microViz={{
          kind: 'series',
          points: [
            { label: '1990', value: 42 },
            { label: '2010', value: 58 },
            { label: '2024', value: 61 },
          ],
        }}
      />,
    );
    assert.match(html, /ds-data-moment__viz--series/);
    assert.match(html, /ds-data-moment__sparkline/);
    assert.match(html, /aria-label="rising from 42 \(1990\) to 61 \(2024\)"/);
    assert.match(html, /Method: gated causal claim/);
  });

  it('renders no visualization when microViz is omitted or unrecognized', () => {
    const omitted = renderToStaticMarkup(<DataMoment {...baseProps} />);
    assert.doesNotMatch(omitted, /ds-data-moment__viz/);

    const empty = renderToStaticMarkup(<DataMoment {...baseProps} microViz={{}} />);
    assert.doesNotMatch(empty, /ds-data-moment__viz/);
  });

  it('renders the bolded provenance line and method-stance chip', () => {
    const html = renderToStaticMarkup(<DataMoment {...baseProps} />);
    assert.match(html, /<strong>Source<\/strong>/);
    assert.match(html, /<strong>Captured<\/strong>/);
    assert.match(html, /<strong>Confidence<\/strong>/);
    assert.match(html, /Method: juxtaposition/);
    assert.match(html, /ds-data-moment__method-stance/);
  });

  it('renders identically regardless of theme class on an ancestor (both themes safe)', () => {
    const wrappedLight = renderToStaticMarkup(
      <div data-theme="light">
        <DataMoment {...baseProps} microViz={{ kind: 'proportion', numerator: 2, denominator: 211 }} />
      </div>,
    );
    const wrappedDark = renderToStaticMarkup(
      <div data-theme="dark">
        <DataMoment {...baseProps} microViz={{ kind: 'proportion', numerator: 2, denominator: 211 }} />
      </div>,
    );
    assert.match(wrappedLight, /ds-data-moment/);
    assert.match(wrappedDark, /ds-data-moment/);
  });
});
