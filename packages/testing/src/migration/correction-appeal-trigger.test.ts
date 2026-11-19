/**
 * `submissions.synchronize_correction_intake` is the database's last check on anonymous
 * appeals: the public connection may UPDATE intake payloads, and only this trigger refuses an
 * appeal that is not eligible or that rewrites anything besides the appeal fields. Applies the
 * real migration into a disposable schema; skips unless Postgres is available.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { createPostgresHarness, postgresHarnessGate } from '../harness/postgres.ts';

const MIGRATION = new URL(
  '../../../../supabase/migrations/20261014232348_correction_intake_lifecycle.sql',
  import.meta.url,
);

const harness = createPostgresHarness();
const gate = postgresHarnessGate(harness);
const schema = harness.schemaName ?? 'unused';

const REJECTED = {
  statement: 'The date is wrong.',
  appeals: [],
  closureReason: 'rejected',
  moderationState: 'blocked',
  classificationDispute: false,
};

function sql(text: string) {
  const result = harness.runSql(text);
  return { ...result, output: `${result.stdout}\n${result.stderr}` };
}

function insert(id: string, payload: object, status = 'rejected') {
  const result = sql(
    `INSERT INTO ${schema}.intake_items (id, status, payload, receipt_digest)
     VALUES ('${id}', '${status}', '${JSON.stringify(payload)}'::jsonb, 'digest-${id}')`,
  );
  assert.equal(result.ok, true, result.output);
}

function appeal(id: string, payload: object) {
  return sql(
    `UPDATE ${schema}.intake_items SET payload = '${JSON.stringify(payload)}'::jsonb
     WHERE id = '${id}'`,
  );
}

const oneAppeal = [{ id: 'a1', statement: 'Please look again.', submittedAt: '2026-11-18' }];

before(() => {
  if (gate.skip) return;
  const migration = readFileSync(MIGRATION, 'utf8').replaceAll('submissions.', `${schema}.`);
  const setup = sql(`
    CREATE TABLE ${schema}.intake_items (
      id text PRIMARY KEY,
      status text NOT NULL,
      payload jsonb NOT NULL,
      receipt_digest text
    );
    ${migration}
  `);
  assert.equal(setup.ok, true, setup.output);
});

after(() => harness.dispose());

test('an eligible appeal reopens a rejected correction', gate, () => {
  insert('ok', REJECTED);
  const result = appeal('ok', { ...REJECTED, appeals: oneAppeal });
  assert.equal(result.ok, true, result.output);
  const row = sql(
    `SELECT status, payload->>'moderationState', payload ? 'closureReason'
     FROM ${schema}.intake_items WHERE id = 'ok'`,
  );
  assert.match(row.stdout, /quarantined\s*\|\s*pending_review\s*\|\s*f/);
});

test('refuses an appeal on a correction that was not rejected', gate, () => {
  insert(
    'open',
    { ...REJECTED, closureReason: undefined, moderationState: 'pending_review' },
    'quarantined',
  );
  const result = appeal('open', {
    ...REJECTED,
    closureReason: undefined,
    moderationState: 'pending_review',
    appeals: oneAppeal,
  });
  assert.equal(result.ok, false);
  assert.match(result.output, /Correction appeal is not eligible/);
});

test('refuses an appeal that also rewrites the correction', gate, () => {
  insert('rewrite', REJECTED);
  const result = appeal('rewrite', { ...REJECTED, statement: 'Changed.', appeals: oneAppeal });
  assert.equal(result.ok, false);
  assert.match(result.output, /Correction appeal is not eligible/);
});

test('refuses a second appeal', gate, () => {
  insert('twice', { ...REJECTED, appeals: oneAppeal });
  const result = appeal('twice', {
    ...REJECTED,
    appeals: [...oneAppeal, { id: 'a2', statement: 'Again.', submittedAt: '2026-11-18' }],
  });
  assert.equal(result.ok, false);
  assert.match(result.output, /Correction appeal is not eligible/);
});
