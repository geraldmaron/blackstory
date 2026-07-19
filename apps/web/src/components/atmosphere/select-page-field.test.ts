/**
 * Unit tests for shell page-field atmosphere motif selection.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectPageField } from './select-page-field';

const PAGE_FIELD_BASE = '/brand/atmosphere/page-field';

test('map paths return null', () => {
  assert.equal(selectPageField('/'), null);
  assert.equal(selectPageField('/explore'), null);
  assert.equal(selectPageField('/explore/'), null);
  assert.equal(selectPageField('/explore/district'), null);
});

test('/data selects ledger with page-field asset paths', () => {
  const selection = selectPageField('/data');
  assert.ok(selection);
  assert.equal(selection.motifId, 'ledger');
  assert.equal(selection.lightPath, `${PAGE_FIELD_BASE}/ledger-light.svg`);
  assert.equal(selection.darkPath, `${PAGE_FIELD_BASE}/ledger-dark.svg`);
  assert.equal(selection.label, 'Horizontal ledger lines');
});

test('/history selects rules with page-field asset paths', () => {
  const selection = selectPageField('/history');
  assert.ok(selection);
  assert.equal(selection.motifId, 'rules');
  assert.equal(selection.lightPath, `${PAGE_FIELD_BASE}/rules-light.svg`);
  assert.equal(selection.darkPath, `${PAGE_FIELD_BASE}/rules-dark.svg`);
  assert.equal(selection.label, 'Hairline rule grid');
});

test('search prefix follows history mapping', () => {
  const search = selectPageField('/search');
  assert.ok(search);
  assert.equal(search.motifId, 'rules');
});

test('stories, about, and topics use bands; legal and submit use pins', () => {
  const stories = selectPageField('/stories/mosaic-credits');
  assert.ok(stories);
  assert.equal(stories.motifId, 'bands');
  assert.equal(stories.lightPath, `${PAGE_FIELD_BASE}/bands-light.svg`);

  const about = selectPageField('/about/');
  assert.ok(about);
  assert.equal(about.motifId, 'bands');

  const topics = selectPageField('/topics');
  assert.ok(topics);
  assert.equal(topics.motifId, 'bands');

  const legal = selectPageField('/legal/terms');
  assert.ok(legal);
  assert.equal(legal.motifId, 'pins');
  assert.equal(legal.darkPath, `${PAGE_FIELD_BASE}/pins-dark.svg`);

  const submit = selectPageField('/submit');
  assert.ok(submit);
  assert.equal(submit.motifId, 'pins');
});

test('entity uses rules; locate uses pins; unknown defaults to rules', () => {
  const entity = selectPageField('/entity/ent_example');
  assert.ok(entity);
  assert.equal(entity.motifId, 'rules');

  const locate = selectPageField('/locate');
  assert.ok(locate);
  assert.equal(locate.motifId, 'pins');

  const unknown = selectPageField('/design-system');
  assert.ok(unknown);
  assert.equal(unknown.motifId, 'rules');
});
