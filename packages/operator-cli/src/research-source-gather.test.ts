/**
 * Tests for research-source-gather safe-fetch helpers (injected transport).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatGatheredSourceSnippet,
  wrapPrefetchedSourceSnippet,
} from './research-source-gather.ts';

test('formatGatheredSourceSnippet labels prefetched vs fetched sources', () => {
  const prefetched = wrapPrefetchedSourceSnippet(
    'https://justice.tougaloo.edu/sundowntown/anna-il/',
    'Anna Illinois sundown town page with Sundown Town in the Past? Surely and quoted newspaper references from the 1900s.',
  );
  assert.ok(prefetched);
  const formatted = formatGatheredSourceSnippet(prefetched!);
  assert.match(formatted, /prefetched/iu);
  assert.match(formatted, /Anna Illinois/iu);

  const fetched = { ...prefetched!, fetched: true as const, finalUrl: prefetched!.url };
  assert.match(formatGatheredSourceSnippet(fetched), /^Source: https:\/\//u);
});

test('wrapPrefetchedSourceSnippet rejects text shorter than the usable threshold', () => {
  assert.equal(wrapPrefetchedSourceSnippet('https://example.org/x', 'too short'), undefined);
  const wrapped = wrapPrefetchedSourceSnippet('https://example.org/x', 'A'.repeat(120));
  assert.ok(wrapped);
  assert.equal(wrapped!.fetched, false);
});
