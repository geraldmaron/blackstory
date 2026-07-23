/**
 * Theme-impact component copy and safe-fail wiring for v6 detail/question routes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ThemeImpactEmptyNotice } from './ThemeImpactEmptyNotice';
import { ThemeImpactGapBanner } from './ThemeImpactGapBanner';
import {
  THEME_IMPACT_EMPTY_COPY,
  THEME_IMPACT_GAP_COPY,
  THEME_IMPACT_MISSING_VALUE_LABEL,
  type ThemeImpactEmptyKind,
  type ThemeImpactGapState,
} from './theme-impact-copy';

const here = dirname(fileURLToPath(import.meta.url));

const COMPONENT_SOURCES = [
  'ThemeImpactPacketCard.tsx',
  'ThemeImpactMapStrip.tsx',
  'ThemeImpactStoryEmbed.tsx',
  'ThemeImpactStorytellingPanel.tsx',
  'ThemeImpactPolicyEraTimeline.tsx',
  'ThemeImpactGapBanner.tsx',
  'ThemeImpactEmptyNotice.tsx',
  'theme-impact-copy.ts',
].map((file) => readFileSync(join(here, file), 'utf8'));

test('theme-impact UI chrome copy avoids em dashes', () => {
  const strings = [
    ...Object.values(THEME_IMPACT_GAP_COPY).flatMap((copy) => [copy.title, copy.body]),
    ...Object.values(THEME_IMPACT_EMPTY_COPY).flatMap((copy) => [copy.title, copy.body]),
    THEME_IMPACT_MISSING_VALUE_LABEL,
  ];
  for (const value of strings) {
    assert.doesNotMatch(value, /—/);
  }
});

test('theme-impact components wire ThemeImpactEmptyNotice for sparse packet data', () => {
  const joined = COMPONENT_SOURCES.join('\n');
  assert.match(joined, /ThemeImpactEmptyNotice kind="indicators"/);
  assert.match(joined, /ThemeImpactEmptyNotice kind="provenance"/);
  assert.match(joined, /ThemeImpactEmptyNotice kind="observations"/);
});

test('ThemeImpactPacketCard uses per-packet provenance heading ids', () => {
  const packetCardSource = readFileSync(join(here, 'ThemeImpactPacketCard.tsx'), 'utf8');
  assert.match(packetCardSource, /provenanceHeadingId/);
  assert.match(packetCardSource, /headingId=\{provenanceHeadingId\}/);
});

const GAP_STATES: readonly ThemeImpactGapState[] = ['insufficient_evidence', 'modeled'];
for (const gapState of GAP_STATES) {
  test(`ThemeImpactGapBanner(${gapState}) renders approved copy`, () => {
    const html = renderToStaticMarkup(createElement(ThemeImpactGapBanner, { gapState }));
    const copy = THEME_IMPACT_GAP_COPY[gapState];
    assert.match(html, new RegExp(copy.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(html, /—/);
  });
}

const EMPTY_KINDS: readonly ThemeImpactEmptyKind[] = ['indicators', 'provenance', 'observations'];
for (const kind of EMPTY_KINDS) {
  test(`ThemeImpactEmptyNotice(${kind}) renders role=status empty state`, () => {
    const html = renderToStaticMarkup(createElement(ThemeImpactEmptyNotice, { kind }));
    const copy = THEME_IMPACT_EMPTY_COPY[kind];
    assert.match(html, /role="status"/);
    assert.match(html, new RegExp(copy.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(html, /—/);
  });
}
