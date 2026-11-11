import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { StoryDraft } from '@repo/schemas';
import { readinessItems } from './readiness';
import { toggleRole, moveCredit } from './credits';

const base = {
  id: 'x',
  slug: 's',
  title: 'T',
  summary: 'S',
  format: 'entry',
  publishedAt: '2026-01-01',
  eraLabel: '1900',
  placeLabel: 'US',
  body: [],
  references: [{ id: 'a', label: 'A', url: 'https://a.test' }],
  relatedEntityIds: [],
  tags: [],
  contributors: [{ id: 'g', name: 'G', kind: 'person', roles: ['author'] }],
} as unknown as StoryDraft;

describe('readinessItems', () => {
  it('is empty for a complete story', () => assert.deepEqual(readinessItems(base), []));
  it('lists each missing piece once, folding server blockers into local items', () => {
    const draft = { ...base, title: '', contributors: [] } as StoryDraft;
    const items = readinessItems(draft, [
      'Select a human author responsible for the story.',
      'title: String must contain at least 1 character(s)',
      'Some other check failed.',
    ]);
    assert.deepEqual(
      items.map((i) => i.key),
      ['title', 'author', 'server-Some other check failed.'],
    );
  });
  it('flags a cover without a description', () => {
    const draft = {
      ...base,
      heroImage: { url: 'https://i.test/a.png', alt: '', credit: 'C', rightsStatus: 'licensed' },
    } as StoryDraft;
    assert.equal(readinessItems(draft)[0]?.key, 'cover-alt');
  });
});

describe('credits', () => {
  const list = [
    { id: 'a', name: 'A', kind: 'person', roles: ['author'] },
    { id: 'b', name: 'B', kind: 'editorial', roles: ['author', 'editor'] },
  ] as StoryDraft['contributors'];
  it('keeps at least one role and canonical role order', () => {
    assert.deepEqual(toggleRole(list, 'a', 'author')[0]!.roles, ['author']);
    assert.deepEqual(toggleRole(list, 'a', 'researcher')[0]!.roles, ['author', 'researcher']);
    assert.deepEqual(toggleRole(list, 'b', 'author')[1]!.roles, ['editor']);
  });
  it('moves and stops at the ends', () => {
    assert.deepEqual(
      moveCredit(list, 'b', -1).map((c) => c.id),
      ['b', 'a'],
    );
    assert.deepEqual(
      moveCredit(list, 'a', -1).map((c) => c.id),
      ['a', 'b'],
    );
  });
});
