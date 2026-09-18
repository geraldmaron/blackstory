import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractCatalogRelationships,
  relatedEntriesFromRelationships,
  type CatalogEntityForRelationships,
} from './catalog-related.js';
const generatedAt = '2026-01-01T00:00:00Z';
const supportingClaim = {
  id: 'claim-a-founded-b',
  predicate: 'founded',
  object: 'b',
  confidenceLevel: 'high' as const,
  citationSource: 'archive',
  citationLabel: 'Founding record',
  citationHref: 'https://archive.example.org/founding',
};
const entities: readonly CatalogEntityForRelationships[] = [
  {
    id: 'a',
    claims: [supportingClaim],
    related: [{ id: 'b', type: 'founded', direction: 'outgoing' }],
  },
  { id: 'b', related: [{ id: 'a', type: 'founded', direction: 'incoming' }] },
];
test('reciprocal catalog entries project the exact cited relationship claim once', () => {
  const result = extractCatalogRelationships(entities, { generatedAt });
  assert.deepEqual(result.skipped, []);
  assert.equal(result.relationships.length, 1);
  assert.deepEqual(result.relationships[0]?.evidenceIds, [supportingClaim.id]);
  assert.deepEqual(relatedEntriesFromRelationships(['a', 'b'], result.relationships).get('b'), [
    { id: 'a', type: 'founded', direction: 'incoming' },
  ]);
});
test('entity-wide claims, wrong endpoints and absent stable evidence cannot establish relationships', () => {
  for (const claim of [
    { ...supportingClaim, predicate: 'born' },
    { ...supportingClaim, object: 'namesake' },
    { ...supportingClaim, id: undefined },
    { ...supportingClaim, citationHref: undefined },
    { ...supportingClaim, citationHref: 'javascript:alert(1)' },
  ]) {
    const result = extractCatalogRelationships(
      [{ ...entities[0]!, claims: [claim] }, entities[1]!],
      { generatedAt },
    );
    assert.equal(result.relationships.length, 0);
    assert.match(result.skipped[0]!, /no exact cited relationship claim/);
  }
});
test('opposite directed assertions and predicates remain distinct', () => {
  const result = extractCatalogRelationships(
    [
      {
        ...entities[0]!,
        claims: [
          supportingClaim,
          { ...supportingClaim, id: 'claim-a-related-b', predicate: 'related_to' },
        ],
        related: [...entities[0]!.related!, { id: 'b', type: 'related_to', direction: 'outgoing' }],
      },
      {
        id: 'b',
        claims: [{ ...supportingClaim, id: 'claim-b-founded-a', object: 'a' }],
        related: [{ id: 'a', type: 'founded', direction: 'outgoing' }],
      },
    ],
    { generatedAt },
  );
  assert.equal(result.relationships.length, 3);
  assert.equal(new Set(result.relationships.map((r) => r.id)).size, 3);
});
test('mentions never borrow unrelated claims or resolve names and aliases', () => {
  for (const token of ['b', 'Beta', 'B']) {
    const result = extractCatalogRelationships(
      [
        { id: 'a', claims: [supportingClaim], mentionedEntityIds: [token] },
        { id: 'b', displayName: 'Beta', aliases: ['B'] },
      ],
      { generatedAt },
    );
    assert.equal(result.relationships.length, 0);
  }
});
test('an exact mention needs a released related_to claim, with its own citation', () => {
  const result = extractCatalogRelationships(
    [
      {
        id: 'a',
        claims: [{ ...supportingClaim, predicate: 'related_to' }],
        mentionedEntityIds: ['b'],
      },
      { id: 'b' },
    ],
    { generatedAt },
  );
  assert.equal(result.relationships.length, 1);
  assert.deepEqual(result.relationships[0]?.evidenceIds, [supportingClaim.id]);
});
