/**
 * Unit tests for the evidence-window arithmetic (repo-de8i). This is what decides which text a
 * drafter or a model actually reads, and its failure mode is silent: a source that gets zero
 * characters is dropped from the bundle, and the record simply comes out thinner with no error.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_CHARS_PER_SOURCE,
  MAX_CHARS_PER_TIER1_SOURCE,
  MAX_TOTAL_EVIDENCE_CHARS,
  MIN_CHARS_RESERVED_PER_REMAINING_SOURCE,
  selectEvidenceForModel,
} from './entity-enrichment-fetch.ts';

function row(id: string, tier: 'tier1' | 'tier2', length: number) {
  return {
    entity_id: 'ent_test',
    id,
    source_tier: tier,
    title: id,
    content_text: 'x'.repeat(length),
    content_hash: `hash_${id}`,
  };
}

test('a tier1 nomination gets the larger window, a tier2 stub does not', () => {
  const evidence = selectEvidenceForModel([
    row('nom', 'tier1', 60_000),
    row('wiki', 'tier2', 9_000),
  ]);
  const nom = evidence.find((item) => item.id === 'nom');
  const wiki = evidence.find((item) => item.id === 'wiki');
  assert.equal(nom?.text.length, MAX_CHARS_PER_TIER1_SOURCE);
  assert.equal(wiki?.text.length, MAX_CHARS_PER_SOURCE);
});

test('a short source is never padded — it contributes only what it has', () => {
  const evidence = selectEvidenceForModel([row('short', 'tier1', 300)]);
  assert.equal(evidence[0]?.text.length, 300);
});

test('two long tier1 documents do not consume the budget and starve the rest', () => {
  // The regression this guards: 12,000 + 12,000 exhausts a 20,000 budget, and every remaining
  // source is handed zero characters and dropped — costing the record the independent
  // corroboration that researchCoverage counts and the publish confidence floor needs.
  const evidence = selectEvidenceForModel([
    row('nom1', 'tier1', 60_000),
    row('nom2', 'tier1', 60_000),
    row('wiki', 'tier2', 9_000),
    row('hop', 'tier2', 9_000),
  ]);
  assert.equal(evidence.length, 4, 'every source must survive with a usable slice');
  for (const item of evidence) {
    assert.ok(
      item.text.length >= MIN_CHARS_RESERVED_PER_REMAINING_SOURCE,
      `${item.id} got only ${item.text.length} chars`,
    );
  }
});

test('many sources still all appear, none reduced to nothing', () => {
  // With 20 sources the naive reserve (19 x 1,200) exceeds the entire budget, which would hand
  // the FIRST source zero characters and cascade to dropping the whole bundle.
  const rows = Array.from({ length: 20 }, (_, i) => row(`src${i}`, 'tier2', 9_000));
  const evidence = selectEvidenceForModel(rows);
  assert.ok(evidence.length > 0, 'the bundle must not collapse to empty');
  for (const item of evidence) assert.ok(item.text.length > 0, `${item.id} got an empty slice`);
});

test('the total across sources never exceeds the overall budget', () => {
  const rows = [
    row('nom', 'tier1', 60_000),
    ...Array.from({ length: 6 }, (_, i) => row(`t2_${i}`, 'tier2', 9_000)),
  ];
  const total = selectEvidenceForModel(rows).reduce((sum, item) => sum + item.text.length, 0);
  assert.ok(
    total <= MAX_TOTAL_EVIDENCE_CHARS,
    `bundle is ${total} chars, over the ${MAX_TOTAL_EVIDENCE_CHARS} budget`,
  );
});

test('tier1 is offered before tier2 regardless of input order', () => {
  const evidence = selectEvidenceForModel([
    row('wiki', 'tier2', 9_000),
    row('nom', 'tier1', 9_000),
  ]);
  assert.equal(evidence[0]?.id, 'nom');
});

test('empty sources are skipped rather than emitted as blank evidence', () => {
  const evidence = selectEvidenceForModel([row('empty', 'tier1', 0), row('real', 'tier2', 500)]);
  assert.deepEqual(
    evidence.map((item) => item.id),
    ['real'],
  );
});
