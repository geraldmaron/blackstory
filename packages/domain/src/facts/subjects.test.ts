import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFixtureFact } from './fixtures.js';
import {
  assertFactSubjectsResolve,
  evaluateFactSubjectReferences,
  mirrorFactsIntoRelationships,
  toFactSubjectSource,
} from './subjects.js';

const resolver = (entityId: string) => (entityId === 'ent_rosa_parks' ? 'person' : undefined);

test('evaluateFactSubjectReferences passes when every subject resolves with the right kind', () => {
  const fact = buildFixtureFact();
  assert.deepEqual(evaluateFactSubjectReferences(fact, resolver), []);
  assert.doesNotThrow(() => assertFactSubjectsResolve(fact, resolver));
});

test('evaluateFactSubjectReferences reports a dangling subject reference', () => {
  const fact = buildFixtureFact({ subjects: [{ entityId: 'ent_ghost', kind: 'person' }] });
  const dangling = evaluateFactSubjectReferences(fact, resolver);
  assert.equal(dangling.length, 1);
  assert.equal(dangling[0]!.reason, 'entity_not_found');
  assert.throws(() => assertFactSubjectsResolve(fact, resolver));
});

test('evaluateFactSubjectReferences reports a kind mismatch', () => {
  const fact = buildFixtureFact({ subjects: [{ entityId: 'ent_rosa_parks', kind: 'place' }] });
  const dangling = evaluateFactSubjectReferences(fact, resolver);
  assert.equal(dangling.length, 1);
  assert.equal(dangling[0]!.reason, 'kind_mismatch');
  assert.equal(dangling[0]!.resolvedKind, 'person');
});

test('toFactSubjectSource adapts a FactRecord into the graph module structural port', () => {
  const fact = buildFixtureFact();
  const source = toFactSubjectSource(fact);
  assert.equal(source.factId, fact.id);
  assert.deepEqual(source.subjects, [{ subjectEntityId: 'ent_rosa_parks' }]);
  assert.deepEqual(source.evidenceIds, [fact.citations[0]!.csl.id]);
  assert.deepEqual(source.temporal, { validFrom: '1955-12-01' });
});

test('mirrorFactsIntoRelationships produces cites edges between every pair of co-subjects', () => {
  const fact = buildFixtureFact({
    subjects: [
      { entityId: 'ent_a', kind: 'person' },
      { entityId: 'ent_b', kind: 'place' },
    ],
  });
  const mirrored = mirrorFactsIntoRelationships([fact]);
  assert.equal(mirrored.length, 1);
  assert.equal(mirrored[0]!.type, 'cites');
  assert.equal(mirrored[0]!.sourceFactId, fact.id);
});

test('a fact with a single subject mirrors to zero edges', () => {
  const fact = buildFixtureFact();
  assert.deepEqual(mirrorFactsIntoRelationships([fact]), []);
});
