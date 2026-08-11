/**
 * Unit tests for the entity-enrichment ledger selector (repo-n7p6.2 / WS2): SQL predicate
 * construction and the pure skip/include candidacy logic, both without a live DB.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_STALE_DAYS,
  buildEnrichmentSelectorQuery,
  evaluateEnrichmentCandidacy,
  selectEntitiesForEnrichment,
  type EnrichmentLedgerSnapshot,
} from './entity-enrichment-selector.ts';

test('buildEnrichmentSelectorQuery defaults staleDays to 30 and adds no field/lane params', () => {
  const { sql, params } = buildEnrichmentSelectorQuery({});
  assert.deepEqual(params, [DEFAULT_STALE_DAYS]);
  assert.match(sql, /make_interval\(days => \$1::int\)/);
  assert.doesNotMatch(sql, /lc\.lane = ANY/);
});

test('buildEnrichmentSelectorQuery parameterizes missing-field names, never inlines them', () => {
  const { sql, params } = buildEnrichmentSelectorQuery({
    missingFields: ['historicalContext', 'topicIds'],
  });
  assert.deepEqual(params, ['historicalContext', 'topicIds', DEFAULT_STALE_DAYS]);
  assert.doesNotMatch(sql, /historicalContext/);
  assert.doesNotMatch(sql, /topicIds/);
  assert.match(sql, /jsonb_typeof\(re\.projection -> \$1::text\)/);
  assert.match(sql, /jsonb_typeof\(re\.projection -> \$2::text\)/);
});

test('buildEnrichmentSelectorQuery appends a lane filter only when lanes is non-empty', () => {
  const withLanes = buildEnrichmentSelectorQuery({ lanes: ['nrhp-black-heritage', 'dc-sites'] });
  assert.deepEqual(withLanes.params, [DEFAULT_STALE_DAYS, ['nrhp-black-heritage', 'dc-sites']]);
  assert.match(withLanes.sql, /lc\.lane = ANY\(\$2::text\[\]\)/);

  const withoutLanes = buildEnrichmentSelectorQuery({ lanes: [] });
  assert.doesNotMatch(withoutLanes.sql, /lc\.lane = ANY/);
});

test('buildEnrichmentSelectorQuery respects a custom staleDays value', () => {
  const { sql, params } = buildEnrichmentSelectorQuery({ staleDays: 9999 });
  assert.deepEqual(params, [9999]);
  assert.match(sql, /\$1::int/);
  void sql;
});

test('buildEnrichmentSelectorQuery stops re-offering entities the sweep found nothing for', () => {
  // The sweep records status='skipped' + updated_at and never touches last_enriched_at, so
  // without this conjunct 'ee.last_enriched_at IS NULL' keeps them eligible forever and the run
  // loops over the same lowest-id entities (measured: 6 chunks, ~100 minutes, zero new evidence).
  const { sql } = buildEnrichmentSelectorQuery({ missingFields: ['historicalContext'] });
  assert.match(sql, /AND NOT \(\s*ee\.status = 'skipped'/u);
  // It has to be an AND on the outside. As another OR branch it would be defeated by the
  // missing-field clause, which a swept-and-empty entity satisfies by definition.
  const [, afterOrBlock = ''] = sql.split(/\)\s*(?=AND NOT)/u);
  assert.match(afterOrBlock, /^AND NOT/u);
  // Reuses the staleDays parameter rather than adding one: a skipped entity becomes eligible
  // again on the same schedule as a stale one.
  assert.match(sql, /ee\.updated_at > now\(\) - make_interval\(days => \$2::int\)/u);
});

test('selectEntitiesForEnrichment runs the built query and returns entity ids', async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const fakeDb = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows: [{ entity_id: 'ent-1' }, { entity_id: 'ent-2' }] };
    },
  };
  const ids = await selectEntitiesForEnrichment(fakeDb as never, { staleDays: 14 });
  assert.deepEqual(ids, ['ent-1', 'ent-2']);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.params, [14]);
});

const freshLedger = (
  overrides: Partial<EnrichmentLedgerSnapshot> = {},
): EnrichmentLedgerSnapshot => ({
  lastEnrichedAt: new Date().toISOString(),
  evidenceDigest: 'sha256:abc123',
  ...overrides,
});

test('evaluateEnrichmentCandidacy includes an entity that was never enriched', () => {
  const result = evaluateEnrichmentCandidacy({ ledger: null });
  assert.deepEqual(result, { include: true, reason: 'never_enriched' });
});

test('evaluateEnrichmentCandidacy includes an entity missing a requested field, even if fresh', () => {
  const result = evaluateEnrichmentCandidacy({
    ledger: freshLedger(),
    missingRequestedField: true,
  });
  assert.deepEqual(result, { include: true, reason: 'missing_field' });
});

test('evaluateEnrichmentCandidacy includes an entity whose last_enriched_at is past staleDays', () => {
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const result = evaluateEnrichmentCandidacy({
    ledger: freshLedger({ lastEnrichedAt: thirtyOneDaysAgo }),
    staleDays: 30,
  });
  assert.deepEqual(result, { include: true, reason: 'stale' });
});

test('evaluateEnrichmentCandidacy excludes a fresh entity whose evidence digest is unchanged', () => {
  const result = evaluateEnrichmentCandidacy({
    ledger: freshLedger({ evidenceDigest: 'sha256:abc123' }),
    freshEvidenceDigest: 'sha256:abc123',
    staleDays: 30,
  });
  assert.deepEqual(result, { include: false, reason: 'unchanged_evidence_fresh' });
});

test('evaluateEnrichmentCandidacy excludes a fresh entity when no evidence digest was supplied', () => {
  const result = evaluateEnrichmentCandidacy({
    ledger: freshLedger(),
    staleDays: 30,
  });
  assert.deepEqual(result, { include: false, reason: 'fresh' });
});

test('evaluateEnrichmentCandidacy treats a changed evidence digest on a fresh entity as still fresh (skip)', () => {
  // Freshness alone gates the skip; a changed digest on an entity that isn't stale yet
  // does not force re-inclusion — that is what staleDays/missingFields are for.
  const result = evaluateEnrichmentCandidacy({
    ledger: freshLedger({ evidenceDigest: 'sha256:old' }),
    freshEvidenceDigest: 'sha256:new',
    staleDays: 30,
  });
  assert.deepEqual(result, { include: false, reason: 'fresh' });
});

test('a boundary-age entity (exactly staleDays old) is treated as stale (inclusive)', () => {
  const lastEnrichedAt = new Date('2026-07-01T00:00:00.000Z');
  const now = new Date(lastEnrichedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const result = evaluateEnrichmentCandidacy({
    ledger: freshLedger({ lastEnrichedAt: lastEnrichedAt.toISOString() }),
    staleDays: 30,
    now,
  });
  assert.equal(result.include, true);
  assert.equal(result.reason, 'stale');
});
