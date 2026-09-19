import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMentionResolverIndex, resolveMentionToken } from './mention-resolver.js';

test('published mentions require exact existing ids, never name, alias or acronym inference', () => {
  const index = buildMentionResolverIndex([
    {
      id: 'ent_sclc',
      displayName: 'Southern Christian Leadership Conference (SCLC)',
      aliases: ['SCLC'],
    },
    { id: 'ent_moses', displayName: 'Robert Moses', aliases: ['Bob Moses'] },
  ]);
  assert.equal(resolveMentionToken('ent_sclc', index), 'ent_sclc');
  for (const token of [
    'sclc',
    'SCLC',
    'Southern Christian Leadership Conference (SCLC)',
    'Robert Moses',
    'Bob Moses',
    'ent_missing',
    ' ent_sclc',
    '',
  ])
    assert.equal(resolveMentionToken(token, index), undefined);
});
