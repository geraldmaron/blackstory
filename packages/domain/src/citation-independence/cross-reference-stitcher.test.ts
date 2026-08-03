/**
 * Tests for Cross-Reference Entity Resolution (the Multi-Source Stitcher).
 *
 * Covers the corroboration contract: a person seen in two datasets but absent from the
 * catalog becomes a merged private candidate carrying BOTH source references; a
 * single-source person is not matched; an already-cataloged person is excluded. The
 * output is a private discovery candidate only — never a public/release record (ADR-009).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CROSS_REFERENCE_MIN_SOURCES,
  buildCrossReferenceCandidates,
  extractPersonMentions,
  findCrossSourceMatches,
  normalizePersonName,
  type SourceDataset,
} from './cross-reference-stitcher.js';

function dataset(sourceId: string, names: readonly string[]): SourceDataset {
  return {
    sourceId,
    adapterId: `${sourceId}-adapter`,
    parserVersion: '1.0.0',
    registryEntryId: `${sourceId}-registry`,
    runId: `${sourceId}-run`,
    capturedAt: '2026-07-24T00:00:00.000Z',
    mentions: names.map((name, i) => ({ mentionId: `${sourceId}-m${i}`, name })),
  };
}

/** Catalog that never matches anyone. */
const emptyCatalog = () => false;

test('normalizePersonName folds diacritics, drops honorifics/suffixes, collapses space', () => {
  assert.equal(normalizePersonName('  Dr.  Rebecca  Lee  Crumpler '), 'rebecca lee crumpler');
  assert.equal(normalizePersonName('Benjamin Banneker Jr.'), 'benjamin banneker');
  assert.equal(normalizePersonName('BÉATRICE  Dupont'), 'beatrice dupont');
  assert.equal(normalizePersonName('   '), '');
});

test('CROSS_REFERENCE_MIN_SOURCES is two', () => {
  assert.equal(CROSS_REFERENCE_MIN_SOURCES, 2);
});

test('extractPersonMentions normalizes and drops empty names, sorted by mentionId', () => {
  const extracted = extractPersonMentions({
    sourceId: 'src-a',
    adapterId: 'a',
    parserVersion: '1.0.0',
    registryEntryId: 'reg-a',
    runId: 'run-a',
    capturedAt: '2026-07-24T00:00:00.000Z',
    mentions: [
      { mentionId: 'm1', name: 'Dr. Rebecca Lee Crumpler' },
      { mentionId: 'm0', name: '   ' },
    ],
  });

  assert.equal(extracted.mentions.length, 1);
  const [only] = extracted.mentions;
  assert.equal(only!.personKey, 'rebecca lee crumpler');
  assert.equal(only!.displayName, 'Dr. Rebecca Lee Crumpler');
  assert.equal(only!.sourceReference.sourceId, 'src-a');
  assert.equal(
    only!.sourceReference.stableIdentifier,
    'cross-reference-person:rebecca lee crumpler',
  );
});

test('two datasets with one overlapping unknown person -> single match with both sources', () => {
  const datasets = [
    dataset('src-a', ['Rebecca Lee Crumpler', 'Someone Else']),
    dataset('src-b', ['Dr. Rebecca Lee Crumpler', 'Another Person']),
  ];

  const matches = findCrossSourceMatches(datasets, emptyCatalog);

  assert.equal(matches.length, 1);
  const [match] = matches;
  assert.equal(match!.personKey, 'rebecca lee crumpler');
  assert.deepEqual(match!.sourceIds, ['src-a', 'src-b']);
  assert.equal(match!.sourceCount, 2);
  assert.equal(match!.mentions.length, 2);
});

test('single-source person is not a cross-source match', () => {
  const datasets = [dataset('src-a', ['Solo Person']), dataset('src-b', ['Different Name'])];

  const matches = findCrossSourceMatches(datasets, emptyCatalog);
  assert.deepEqual(matches, []);
});

test('already-cataloged person is excluded even when in both sources', () => {
  const datasets = [
    dataset('src-a', ['Frederick Douglass', 'Hidden Figure']),
    dataset('src-b', ['Frederick Douglass', 'Hidden Figure']),
  ];

  // Catalog knows the famous person but not the obscure one.
  const catalog = ({ personKey }: { personKey: string }) => personKey === 'frederick douglass';

  const matches = findCrossSourceMatches(datasets, catalog);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.personKey, 'hidden figure');
});

test('findCrossSourceMatches is deterministic regardless of dataset order', () => {
  const a = dataset('src-a', ['Ada Copeland', 'Bass Reeves']);
  const b = dataset('src-b', ['Ada Copeland', 'Bass Reeves']);

  const forward = findCrossSourceMatches([a, b], emptyCatalog);
  const reversed = findCrossSourceMatches([b, a], emptyCatalog);

  assert.deepEqual(forward, reversed);
  assert.deepEqual(
    forward.map((m) => m.personKey),
    ['ada copeland', 'bass reeves'],
  );
});

test('buildCrossReferenceCandidates aggregates both source references onto a merged candidate', () => {
  const datasets = [
    dataset('src-a', ['Rebecca Lee Crumpler']),
    dataset('src-b', ['Dr. Rebecca Lee Crumpler']),
  ];
  const matches = findCrossSourceMatches(datasets, emptyCatalog);
  const candidates = buildCrossReferenceCandidates(matches);

  assert.equal(candidates.length, 1);
  const [candidate] = candidates;

  // Corroborated -> merged; carries BOTH independent source references.
  assert.equal(candidate!.status, 'merged');
  assert.equal(candidate!.identity.sourceReferences.length, 2);
  const sourceIds = candidate!.identity.sourceReferences.map((r) => r.sourceId).sort();
  assert.deepEqual(sourceIds, ['src-a', 'src-b']);

  // Private discovery candidate only — never promotable / published.
  assert.equal(candidate!.signals.outcome, 'candidate_only');
  assert.equal(candidate!.schemaVersion, 'discovery-candidate.v1');
  assert.equal(candidate!.identity.stableIdentifier, 'cross-reference-person:rebecca lee crumpler');
});

test('buildCrossReferenceCandidates is deterministic and pure (stable across calls)', () => {
  const datasets = [
    dataset('src-a', ['Ada Copeland', 'Bass Reeves']),
    dataset('src-b', ['Ada Copeland', 'Bass Reeves']),
  ];
  const matches = findCrossSourceMatches(datasets, emptyCatalog);

  const first = buildCrossReferenceCandidates(matches);
  const second = buildCrossReferenceCandidates(matches);

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((c) => c.identity.stableIdentifier),
    ['cross-reference-person:ada copeland', 'cross-reference-person:bass reeves'],
  );
  for (const candidate of first) {
    assert.equal(candidate.status, 'merged');
    assert.equal(candidate.identity.sourceReferences.length, 2);
  }
});
