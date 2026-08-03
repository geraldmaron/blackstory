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
  assert.match(formatGatheredSourceSnippet(fetched), /^Source \(Tier: T2\): https:\/\//u);
});

test('formatGatheredSourceSnippet tags the source tier from the shared registry', () => {
  const snippet = wrapPrefetchedSourceSnippet('https://census.gov/some-report', 'A'.repeat(150));
  assert.ok(snippet);
  assert.match(formatGatheredSourceSnippet(snippet!), /Tier: T1/u);

  const untrusted = wrapPrefetchedSourceSnippet(
    'https://random-blogspot-example.com/post',
    'B'.repeat(150),
  );
  assert.ok(untrusted);
  assert.match(formatGatheredSourceSnippet(untrusted!), /Tier: T4/u);
});

test('wrapPrefetchedSourceSnippet rejects text shorter than the usable threshold', () => {
  assert.equal(wrapPrefetchedSourceSnippet('https://example.org/x', 'too short'), undefined);
  const wrapped = wrapPrefetchedSourceSnippet('https://example.org/x', 'A'.repeat(120));
  assert.ok(wrapped);
  assert.equal(wrapped!.fetched, false);
});
