/**
 * Runs the BB-071 gold-corpus retrieval eval against the deterministic mock embedding provider
 * (no network access, no API key) and records real recall@k / MRR numbers.
 *
 * These numbers are NOT a measure of real semantic retrieval quality — the mock provider
 * produces hash-seeded pseudo-random vectors uncorrelated with meaning (see
 * retrieval-embedding.ts). What this test *does* verify: the eval pipeline runs end to end
 * against the real corpus fixture, produces a well-formed, reproducible result, and clears a
 * low sanity floor. A real recall@k number requires swapping in a live provider (e.g.
 * `@black-book/firebase`'s `createGeminiEmbeddingProvider` with a `GEMINI_API_KEY`) — see
 * docs/adr/ADR-014-vector-search.md.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadGoldCorpus } from './load.ts';
import { createDeterministicMockEvalProvider } from './retrieval-embedding.ts';
import { buildRetrievalDocuments, buildRetrievalQueries, runRetrievalEval } from './retrieval-eval.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const fixturePath = join(
  repoRoot,
  'packages',
  'testing',
  'src',
  'gold-corpus',
  'fixtures',
  'gold-corpus.v1.json',
);
const corpus = loadGoldCorpus(fixturePath);

test('buildRetrievalDocuments/Queries cover every example with non-empty relevant sets', () => {
  const documents = buildRetrievalDocuments(corpus);
  const queries = buildRetrievalQueries(corpus);
  assert.equal(documents.length, corpus.examples.length);
  assert.equal(queries.length, corpus.examples.length);
  for (const query of queries) {
    assert.ok(query.relevantIds.size >= 1, `query ${query.id} has no relevant documents`);
    assert.ok(query.relevantIds.has(query.id), `query ${query.id} is not relevant to itself`);
  }
});

test('runRetrievalEval is deterministic for the same corpus and provider', async () => {
  const provider = createDeterministicMockEvalProvider(64);
  const first = await runRetrievalEval(corpus, provider);
  const second = await runRetrievalEval(corpus, provider);
  assert.deepEqual(first, second);
});

test('runRetrievalEval against the mock provider produces real, recorded recall@5 / recall@10 / MRR', async () => {
  const provider = createDeterministicMockEvalProvider(64);
  const result = await runRetrievalEval(corpus, provider, { kValues: [5, 10] });

  assert.equal(result.corpusVersion, corpus.corpusVersion);
  assert.equal(result.documentCount, 120);
  assert.equal(result.queryCount, 120);
  assert.equal(result.modelUsed, 'mock-deterministic-embedding');

  for (const k of [5, 10]) {
    const recall = result.recallAtK[String(k)]!;
    assert.ok(Number.isFinite(recall) && recall >= 0 && recall <= 1, `recall@${k} out of range`);
  }
  assert.ok(result.recallAtK['10']! >= result.recallAtK['5']!, 'recall@10 should be >= recall@5');
  assert.ok(
    Number.isFinite(result.meanReciprocalRank) &&
      result.meanReciprocalRank >= 0 &&
      result.meanReciprocalRank <= 1,
  );

  // Sanity floor only (this is a mock, uncorrelated-with-meaning provider): every query is
  // relevant to itself, and each category has ~10 members, so even random ranking should place
  // *some* same-category document in the top 10 more often than not. This is a pipeline
  // sanity check, not a semantic-quality gate.
  assert.ok(
    result.recallAtK['10']! > 0.05,
    `recall@10 (${result.recallAtK['10']}) is implausibly low even for a random-ranking sanity floor`,
  );

  // Recorded for the human report — see this bead's final report for the exact numbers.
  console.log(`BB-071 gold-corpus retrieval eval (mock provider): ${JSON.stringify(result)}`);
});
