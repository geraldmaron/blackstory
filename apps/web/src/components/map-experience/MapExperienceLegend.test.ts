/**
 * SSR markup smoke test confirming the legend explains every visual distinction in words
 * (WCAG 1.4.1 Use of Color), not color/glyph alone: kind shades + glyphs, the size scale,
 * clusters, the density layer, state labels, and confidence glyphs. Historical tones are
 * shade-only (no glyph claim) so the key matches `displayEncodingFor`.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { MapExperienceLegend, type MapExperienceLegendProps } from './MapExperienceLegend';
import {
  KIND_FAMILY_ENTRIES,
  SEMANTIC_TONE_ENTRIES,
} from '../../lib/map-experience/kind-encoding';

test('explains points, clusters, the density layer, and confidence glyphs in words', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /radius affordance/);
  assert.match(html, /cluster/i);
  assert.match(html, /Group nearby/);
  assert.match(html, /full entity page/);
  assert.match(html, /States are shaded by how many documented records/);
  assert.match(html, /High/);
  assert.match(html, /medium/);
  assert.match(html, /low \(orange\)/);
  assert.match(html, /Streets/);
});

test('off layer mode invites choosing a map data model', () => {
  const html = renderToStaticMarkup(
    createElement<MapExperienceLegendProps>(MapExperienceLegend, { layerMode: 'off' }),
  );
  assert.match(html, /Choose a model/);
});

test('states that color marks kind groups and historical tones, in words', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /Kind groups/);
  assert.match(html, /five kind groups/);
  assert.match(html, /Tone filter/);
  assert.match(html, /Historical tones/);
});

test('lists every kind family with its label and micro-kind roll-up', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  for (const [, entry] of KIND_FAMILY_ENTRIES) {
    assert.match(html, new RegExp(entry.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(html, /Record kind groups/);
});

test('lists every semantic tone as shade-only (never claims a tone-owned glyph)', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  for (const [, entry] of SEMANTIC_TONE_ENTRIES) {
    assert.match(html, new RegExp(entry.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(html, /shade only/);
  assert.doesNotMatch(html, /Plantation\s*\(square\)/);
  assert.doesNotMatch(html, /Massacre \/ atrocity\s*\(diamond\)/);
});

test('explains the size scale as evidence depth, with cluster and confidence in the color key', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /accepted claims/);
  assert.match(html, /Cluster size/);
  assert.match(html, /Evidence confidence/);
});

test('explains state labels and the copper selected-state convention in words', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /state labels/i);
  assert.match(html, /turns copper/);
});

test('is a native, keyboard-accessible disclosure (details/summary), open by default', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /<details[^>]*class="ds-explore-legend"[^>]*open/);
  assert.match(html, /<summary/);
});

test('defaultCollapsed renders the disclosure closed', () => {
  // Explicit generic argument: `MapExperienceLegend`'s single parameter is optional (so it can
  // be called with zero props for the common case), and TS's `createElement<P>` overload cannot
  // always infer `P` from an all-optional-parameter function component this is a test-only
  // inference quirk real JSX usage (`<MapExperienceLegend defaultCollapsed />`) type-checks fine.
  const html = renderToStaticMarkup(
    createElement<MapExperienceLegendProps>(MapExperienceLegend, { defaultCollapsed: true }),
  );
  assert.match(html, /<details class="ds-explore-legend">/);
  assert.doesNotMatch(html, /<details[^>]*open/);
});

test('shows a visible color key for boundaries, kinds, and historical tones', () => {
  const html = renderToStaticMarkup(
    createElement<MapExperienceLegendProps>(MapExperienceLegend, { colorScheme: 'light' }),
  );
  assert.match(html, /Color key/);
  assert.match(html, /State outline/);
  assert.match(html, /County line/);
  assert.match(html, /Selected state/);
  assert.match(html, /Record kind groups/);
  assert.match(html, /Historical tones \(shade only/);
  assert.match(html, /ds-map-color-key/);
  assert.doesNotMatch(html, /Hide key/);
});

test('SSR without colorScheme uses light plate swatches (hydration-safe; no document read)', () => {
  // Light stateBounds = copperTextLight #8E4F2A; dark would be pageSand #D8A178.
  // Reading document during render/SSR caused dark-theme clients to hydrate mismatched inline styles.
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /background-color:#8[Ee]4[Ff]2[Aa]|backgroundColor:#8[Ee]4[Ff]2[Aa]|#8E4F2A/);
  assert.match(html, /#6[Dd]675[Ff]|#6D675F/);
  assert.doesNotMatch(html, /#D8A178/);
  assert.doesNotMatch(html, /#F4EFE5/);
});

test('onHide renders an accessible Hide key control beside the Color key heading', () => {
  const html = renderToStaticMarkup(
    createElement<MapExperienceLegendProps>(MapExperienceLegend, {
      colorScheme: 'light',
      onHide: () => undefined,
    }),
  );
  assert.match(html, /aria-label="Hide key"/);
  assert.match(html, />Hide key</);
  assert.match(html, /ds-explore-stage__panel-hide/);
});

test('color key lists cluster size steps and confidence tiers', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /2 to 9 records/);
  assert.match(html, /200\+ records/);
  assert.match(html, /Evidence confidence/);
  assert.match(html, /Unrated/);
});

test('embedded mode omits Color key heading/hide (chassis owns chrome)', () => {
  const html = renderToStaticMarkup(
    createElement<MapExperienceLegendProps>(MapExperienceLegend, {
      colorScheme: 'light',
      embedded: true,
      onHide: () => undefined,
    }),
  );
  assert.match(html, /ds-map-color-key--embedded/);
  assert.match(html, /aria-label="Color key"/);
  assert.doesNotMatch(html, /id="map-color-key-heading"/);
  assert.doesNotMatch(html, /Hide key/);
});

test('color key includes share tiers when blackShare layer is active', () => {
  const html = renderToStaticMarkup(
    createElement<MapExperienceLegendProps>(MapExperienceLegend, {
      layerMode: 'blackShare',
      colorScheme: 'light',
    }),
  );
  assert.match(html, /Black population share by county/);
  assert.match(html, /Under 2%/);
  assert.match(html, /50%\+/);
});

test('kind and tone swatches are aria-hidden (the accessible content is the adjacent text)', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  const glyphSwatchCount = (
    html.match(/class="ds-legend-glyph[^"]*"[^>]*aria-hidden="true"/g) ?? []
  ).length;
  // Color key + Reading this map each list kinds and tones (2× each vocabulary).
  // Default layerMode is presence, which adds three presence-tier discs in the color key.
  const presenceTier = 3;
  const expected = KIND_FAMILY_ENTRIES.length * 2 + SEMANTIC_TONE_ENTRIES.length * 2 + presenceTier;
  assert.equal(glyphSwatchCount, expected);
});
