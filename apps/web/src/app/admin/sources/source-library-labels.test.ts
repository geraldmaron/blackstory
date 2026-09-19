import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatFitness, formatPublisherKind, formatTier } from './source-library-labels';

test('formatPublisherKind labels known kinds and falls back for unclassified', () => {
  assert.equal(formatPublisherKind('government_archive'), 'Government archive');
  assert.equal(formatPublisherKind('wiki_crowd'), 'Wiki / crowd-sourced');
  assert.equal(formatPublisherKind(undefined), 'Unclassified');
});

test('formatTier labels known tiers and falls back for untiered', () => {
  assert.equal(formatTier('tier1'), 'Tier 1');
  assert.equal(formatTier('tier3'), 'Tier 3');
  assert.equal(formatTier(undefined), 'Untiered');
});

test('formatFitness labels known fitness values', () => {
  assert.equal(formatFitness('authoritative'), 'Authoritative');
  assert.equal(formatFitness('lead_only'), 'Lead only');
  assert.equal(formatFitness('unknown_value'), 'unknown value');
});
