/**
 * Tests for FactRecord subjects mirrored into the graph
 * as edges, so an entity connected to a fact ONLY through subjects is not invisible to the
 * published browse graph.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mirrorFactSubjectsIntoRelationships } from './fact-subjects.js';
import { GRAPH_GOLD_FIXTURES } from './fixtures.js';

test('a fact with two subjects and no formal EntityRelationship mirrors to one cites edge', () => {
  const mirrored = mirrorFactSubjectsIntoRelationships(GRAPH_GOLD_FIXTURES.factSubjects);
  assert.equal(mirrored.length, 1);
  const [edge] = mirrored;
  assert.equal(edge!.type, 'cites');
  assert.equal(edge!.sourceFactId, 'gg-fact-1');
  assert.deepEqual([edge!.fromEntityId, edge!.toEntityId].sort(), [
    'gg-event-incident',
    'gg-person-subject',
  ]);
  // Every mirrored edge carries evidence assertRelationshipHasEvidence must still hold.
  assert.ok(edge!.evidenceIds.length > 0);
});

test('a fact with N subjects mirrors to exactly N*(N-1)/2 pairwise edges', () => {
  const mirrored = mirrorFactSubjectsIntoRelationships([
    {
      factId: 'fact-multi',
      subjects: [
        { subjectEntityId: 'ent-a' },
        { subjectEntityId: 'ent-b' },
        { subjectEntityId: 'ent-c' },
      ],
      evidenceIds: ['ev-1'],
    },
  ]);
  assert.equal(mirrored.length, 3); // 3 choose 2
  const pairs = mirrored.map((m) => `${m.fromEntityId}:${m.toEntityId}`).sort();
  assert.deepEqual(pairs, ['ent-a:ent-b', 'ent-a:ent-c', 'ent-b:ent-c']);
});

test('a fact with zero or one subject mirrors to nothing', () => {
  assert.deepEqual(
    mirrorFactSubjectsIntoRelationships([
      { factId: 'fact-empty', subjects: [], evidenceIds: ['ev-1'] },
    ]),
    [],
  );
  assert.deepEqual(
    mirrorFactSubjectsIntoRelationships([
      { factId: 'fact-solo', subjects: [{ subjectEntityId: 'ent-a' }], evidenceIds: ['ev-1'] },
    ]),
    [],
  );
});

test('mirroring is deterministic regardless of subjects[] input order (id-sorted pairs)', () => {
  const factAscending = {
    factId: 'fact-order',
    subjects: [{ subjectEntityId: 'ent-a' }, { subjectEntityId: 'ent-z' }],
    evidenceIds: ['ev-1'],
  };
  const factDescending = {
    factId: 'fact-order',
    subjects: [{ subjectEntityId: 'ent-z' }, { subjectEntityId: 'ent-a' }],
    evidenceIds: ['ev-1'],
  };
  const first = mirrorFactSubjectsIntoRelationships([factAscending]);
  const second = mirrorFactSubjectsIntoRelationships([factDescending]);
  assert.deepEqual(first, second);
  assert.equal(first[0]!.fromEntityId, 'ent-a');
  assert.equal(first[0]!.toEntityId, 'ent-z');
});

test('a fact with no evidenceIds falls back to citing itself as evidence (fail-safe, never empty)', () => {
  const mirrored = mirrorFactSubjectsIntoRelationships([
    { factId: 'fact-no-evidence', subjects: [{ subjectEntityId: 'a' }, { subjectEntityId: 'b' }], evidenceIds: [] },
  ]);
  assert.deepEqual(mirrored[0]!.evidenceIds, ['fact-no-evidence']);
});

test('re-running the mirror step against the same input is idempotent (same deterministic ids)', () => {
  const first = mirrorFactSubjectsIntoRelationships(GRAPH_GOLD_FIXTURES.factSubjects);
  const second = mirrorFactSubjectsIntoRelationships(GRAPH_GOLD_FIXTURES.factSubjects);
  assert.deepEqual(first, second);
  assert.equal(first[0]!.id, 'fact-mirror:gg-fact-1:gg-event-incident:gg-person-subject');
});
