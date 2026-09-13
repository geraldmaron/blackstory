/**
 * Proves `promoteCaseToCanonical`'s actual transactional write path — not just the pure
 * `evaluateCasePromotionGate`/`validateCanonicalPromotionRecord` functions it calls, which
 * `packages/domain/src/promotion/case-promotion.test.ts` already covers on their own (repo-k2kb).
 * Mirrors `canonical-write.test.ts`'s fixture style: a fake `pg.PoolClient` records every query
 * instead of hitting a real database.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type pg from 'pg';
import type { CanonicalPromotionRecord } from '@repo/domain';
import type { AdminCaseDetail } from './research-case-types';
import {
  CasePromotionRejected,
  promoteCaseToCanonical,
  type PromoteCaseDependencies,
  type PromoteCaseInput,
} from './promote-case';

function caseDetail(overrides: Partial<AdminCaseDetail> = {}): AdminCaseDetail {
  const record = {
    id: 'case-1',
    state: 'substantial_enrichment' as const,
    candidateId: 'candidate-1',
    title: 'Boarded-up mill on Route 9',
    checklist: { items: [] },
    history: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  return {
    id: 'case-1',
    title: 'Boarded-up mill on Route 9',
    state: 'substantial_enrichment',
    candidateId: 'candidate-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    checklist: { items: [] },
    history: [],
    record,
    ...overrides,
  } as AdminCaseDetail;
}

function promotionRecord(
  overrides: Partial<CanonicalPromotionRecord> = {},
): CanonicalPromotionRecord {
  return {
    entityId: 'entity-1',
    displayName: 'Route 9 Mill',
    summary:
      'An abandoned textile mill on Route 9, closed after the 1987 flood and never reopened; ' +
      'the site has stood vacant since, per county records and contemporary news coverage.',
    jurisdiction: 'Example County',
    topicIds: ['abandoned-industry'],
    topicTags: ['mill', 'flood'],
    eraBuckets: ['1980s'],
    location: {
      lat: 42.1,
      lng: -71.5,
      label: 'Route 9, Example County',
      precision: 'address',
      matchMethod: 'geocoded',
    },
    sources: [
      {
        url: 'https://county.example.gov/records/mill-closure',
        title: 'County closure record',
        excerpt:
          'The mill was closed permanently by county order following extensive flood damage in 1987.',
        fitness: 'authoritative',
      },
      {
        url: 'https://news.example.com/1987/mill-closes',
        title: 'Local paper coverage',
        excerpt: 'Residents recall the mill closing its doors for good after the spring flood.',
        fitness: 'strong',
      },
    ],
    ...overrides,
  };
}

function promoteInput(overrides: Partial<PromoteCaseInput> = {}): PromoteCaseInput {
  return {
    caseId: 'case-1',
    record: promotionRecord(),
    proposerId: 'user-proposer',
    approverUid: 'user-approver',
    approverEmail: 'approver@example.com',
    reason: 'Two independent sources confirm the closure; ready for canonical.',
    ...overrides,
  };
}

/** A fake client that records every query and answers the duplicate-check SELECT by name. */
function fixture(
  options: {
    readonly detail?: AdminCaseDetail | null;
    readonly duplicateRows?: readonly unknown[];
  } = {},
) {
  const queries: { readonly sql: string; readonly params: readonly unknown[] }[] = [];
  const client = {
    query: async (sql: string, params?: readonly unknown[]) => {
      queries.push({ sql, params: params ?? [] });
      if (sql.includes('FROM bb_canonical.entities') && sql.includes('WHERE id <>')) {
        const rows = options.duplicateRows ?? [];
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as pg.PoolClient;

  const detail = options.detail === undefined ? caseDetail() : options.detail;
  const dependencies: PromoteCaseDependencies = {
    getCaseDetail: async () => detail,
    runTransaction: async (operation) => operation(client),
  };
  return { queries, dependencies };
}

test('a proposer and approver who are the same identity are rejected with no writes', async () => {
  const { queries, dependencies } = fixture();

  await assert.rejects(
    () =>
      promoteCaseToCanonical(
        promoteInput({ proposerId: 'user-1', approverUid: 'user-1' }),
        dependencies,
      ),
    (error: unknown) => {
      assert.ok(error instanceof CasePromotionRejected);
      assert.ok(error.reasons.includes('proposer_approver_conflict'));
      return true;
    },
  );
  assert.equal(queries.length, 0);
});

test('a case not yet in substantial_enrichment is rejected with no writes', async () => {
  const { queries, dependencies } = fixture({
    detail: caseDetail({ state: 'minimum_record' }),
  });

  await assert.rejects(
    () => promoteCaseToCanonical(promoteInput(), dependencies),
    (error: unknown) => {
      assert.ok(error instanceof CasePromotionRejected);
      assert.ok(error.reasons.includes('case_not_ready'));
      return true;
    },
  );
  assert.equal(queries.length, 0);
});

test('a record failing content validation is rejected before any query runs', async () => {
  const { queries, dependencies } = fixture();

  await assert.rejects(
    () =>
      promoteCaseToCanonical(
        promoteInput({ record: promotionRecord({ summary: 'too short' }) }),
        dependencies,
      ),
    (error: unknown) => {
      assert.ok(error instanceof CasePromotionRejected);
      assert.ok(error.reasons.includes('name_or_summary_invalid'));
      return true;
    },
  );
  assert.equal(queries.length, 0);
});

test('a live catalog duplicate aborts the transaction without inserting the entity', async () => {
  const { queries, dependencies } = fixture({
    duplicateRows: [{ id: 'entity-existing', display_name: 'Route 9 Mill' }],
  });

  await assert.rejects(() => promoteCaseToCanonical(promoteInput(), dependencies), /duplicate/i);

  // The duplicate check ran, but nothing after it did: no INSERT INTO bb_canonical.entities.
  assert.ok(queries.some((q) => q.sql.includes('WHERE id <>')));
  assert.ok(!queries.some((q) => q.sql.includes('INSERT INTO bb_canonical.entities')));
});

test('a valid promotion commits the entity, claim, evidence, and case history in one pass', async () => {
  const { queries, dependencies } = fixture();

  const result = await promoteCaseToCanonical(promoteInput(), dependencies);

  assert.equal(result.entityId, 'entity-1');
  assert.ok(result.claimId.startsWith('claim_entity-1'));
  assert.equal(result.evidenceIds.length, 2);

  const sqlOf = (fragment: string) => queries.some((q) => q.sql.includes(fragment));
  assert.ok(sqlOf('INSERT INTO bb_canonical.entities'));
  assert.ok(sqlOf('INSERT INTO bb_canonical.entity_locations'));
  assert.ok(sqlOf('INSERT INTO bb_canonical.claims'));
  assert.ok(sqlOf('INSERT INTO bb_canonical.claim_versions'));
  assert.ok(sqlOf('INSERT INTO bb_canonical.claim_evidence_links'));
  assert.ok(sqlOf('INSERT INTO bb_research.case_history_events'));
  assert.ok(sqlOf('INSERT INTO bb_audit.events'));

  const entityInsert = queries.find((q) => q.sql.includes('INSERT INTO bb_canonical.entities'));
  assert.deepEqual(
    entityInsert?.params[3],
    JSON.stringify([{ scheme: 'research_case', value: 'case-1' }]),
  );

  const historyInsert = queries.find((q) =>
    q.sql.includes('INSERT INTO bb_research.case_history_events'),
  );
  // reason_code is a SQL literal ('canonical_promotion_approved'), not a bound param.
  assert.ok(historyInsert?.sql.includes("'canonical_promotion_approved'"));
  assert.equal(historyInsert?.params[3], 'user-approver');
});
