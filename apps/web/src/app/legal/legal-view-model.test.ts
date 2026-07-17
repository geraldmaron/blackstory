/**
 * Tests for legal browse/detail view-model shaping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLegalBrowseViewModel, buildLegalDetailViewModel } from './legal-view-model';

test('buildLegalBrowseViewModel returns all seed entries by default', () => {
  const view = buildLegalBrowseViewModel({});
  assert.ok(view.totalMatched >= 12);
  assert.ok(view.items.some((item) => item.slug === 'civil-rights-act-1964'));
});

test('buildLegalBrowseViewModel filters by topic', () => {
  const view = buildLegalBrowseViewModel({ topic: 'voting' });
  assert.ok(view.totalMatched >= 3);
  for (const item of view.items) {
    assert.ok(item.topics.includes('voting'));
  }
});

test('buildLegalDetailViewModel resolves explainer and fact link for CRA 1964', () => {
  const view = buildLegalDetailViewModel('civil-rights-act-1964');
  assert.equal(view.kind, 'ok');
  if (view.kind !== 'ok') return;
  assert.ok(view.explainer);
  assert.ok(view.factHref?.includes('BB-F-000010'));
});

test('buildLegalDetailViewModel returns not_found for unknown slug', () => {
  const view = buildLegalDetailViewModel('does-not-exist');
  assert.equal(view.kind, 'not_found');
});
