import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertPostgresOpsDataSource,
  editorialCatalogFromError,
} from './ops-data-source-gate.ts';
import { DEFAULT_PARITY_CYCLES, LEDGER_PARITY_CHECKLIST, parityChecklistMarkdown } from './ledger-parity.ts';

test('assertPostgresOpsDataSource requires explicit postgres selector', () => {
  assert.throws(
    () => assertPostgresOpsDataSource({ DATABASE_URL: 'postgresql://example.invalid/postgres' }),
    /OPS_DATA_SOURCE=postgres is required/u,
  );
  assert.doesNotThrow(() =>
    assertPostgresOpsDataSource({
      OPS_DATA_SOURCE: 'postgres',
      DATABASE_URL: 'postgresql://example.invalid/postgres',
    }),
  );
});

test('assertPostgresOpsDataSource rejects legacy firestore selector', () => {
  assert.throws(
    () => assertPostgresOpsDataSource({ OPS_DATA_SOURCE: 'firestore' }),
    /Unsupported ops data source firestore/u,
  );
});

test('editorialCatalogFromError names firestore retirement', () => {
  assert.match(editorialCatalogFromError('firestore').message, /Firestore editorial/u);
  assert.match(editorialCatalogFromError('firestore').message, /OPS_DATA_SOURCE=postgres/u);
  assert.equal(
    editorialCatalogFromError('elastic').message,
    '--catalog-from must be "postgres" when set',
  );
});

test('ledger parity checklist documents pending human cycles and probes', () => {
  assert.equal(DEFAULT_PARITY_CYCLES.length, 2);
  assert.ok(DEFAULT_PARITY_CYCLES.every((cycle) => cycle.status === 'pending'));
  assert.ok(LEDGER_PARITY_CHECKLIST.some((item) => item.id === 'run-rows'));
  assert.ok(LEDGER_PARITY_CHECKLIST.some((item) => item.id === 'heartbeats'));
  const markdown = parityChecklistMarkdown();
  assert.match(markdown, /cycle-1 \| PENDING/u);
  assert.match(markdown, /cycle-2 \| PENDING/u);
  assert.match(markdown, /bb_research\.runs/u);
  assert.match(markdown, /bb_research\.frontier_tasks/u);
});
