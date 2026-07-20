/**
 * Tests for law browse/detail view-model shaping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLawBrowseViewModel, buildLawDetailViewModel } from './law-view-model';

test('buildLawBrowseViewModel returns all seed entries by default', () => {
  const view = buildLawBrowseViewModel({});
  assert.ok(view.totalMatched >= 5);
  assert.equal(view.kind, 'all');
});

test('buildLawBrowseViewModel filters by topic', () => {
  const view = buildLawBrowseViewModel({ topic: 'voting' });
  assert.ok(view.totalMatched >= 1);
  for (const item of view.items) {
    assert.ok(item.topics.includes('voting'));
  }
});

test('buildLawDetailViewModel resolves explainer for CRA 1964', () => {
  const view = buildLawDetailViewModel('civil-rights-act-1964');
  assert.equal(view.kind, 'ok');
  if (view.kind !== 'ok') return;
  assert.equal(view.snapshot.slug, 'civil-rights-act-1964');
  assert.ok(view.explainer);
});

test('buildLawDetailViewModel returns not_found for unknown slug', () => {
  const view = buildLawDetailViewModel('does-not-exist');
  assert.equal(view.kind, 'not_found');
});
