import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSessionEnrichmentBatch,
  canRecordSignificanceRefusal,
} from './session-enrichment-batch.ts';

test('all-refusal batches are valid without a fabricated successful draft', () => {
  assert.doesNotThrow(() => assertSessionEnrichmentBatch([], [{ entityId: 'a' }]));
});
test('answer-only and mixed batches remain valid', () => {
  assert.doesNotThrow(() => assertSessionEnrichmentBatch([{ entityId: 'a' }], []));
  assert.doesNotThrow(() => assertSessionEnrichmentBatch([{ entityId: 'a' }], [{ entityId: 'b' }]));
});
test('empty batches fail before opening a database connection', () => {
  assert.throws(() => assertSessionEnrichmentBatch([], []), /no answers or refusals/);
});
test('duplicates and contradictory draft/refusal outcomes fail closed', () => {
  assert.throws(
    () => assertSessionEnrichmentBatch([{ entityId: 'a' }], [{ entityId: 'a' }]),
    /conflicting/,
  );
  assert.throws(
    () => assertSessionEnrichmentBatch([], [{ entityId: 'a' }, { entityId: 'a' }]),
    /conflicting/,
  );
  assert.throws(() => assertSessionEnrichmentBatch([{ entityId: '' }], []), /empty entityId/);
});
test('missing or misattached evidence cannot become a terminal refusal', () => {
  for (const digest of [undefined, null, '', ' ']) {
    assert.equal(
      canRecordSignificanceRefusal('No significance in reviewed text', digest, 'digest'),
      false,
    );
  }
  assert.equal(canRecordSignificanceRefusal(' MIS-ATTACHED: namesake', 'digest', 'digest'), false);
  assert.equal(
    canRecordSignificanceRefusal('No significance in reviewed text', 'digest', 'digest'),
    true,
  );
});

test('stale or legacy unbound refusals remain unresolved', () => {
  assert.equal(canRecordSignificanceRefusal('No significance', 'new', 'old'), false);
  assert.equal(canRecordSignificanceRefusal('No significance', 'current', null), false);
});

import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function collectFixture(conflict: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'enrichment-collect-test-'));
  try {
    const prompts = join(dir, 'prompts.jsonl');
    const out = join(dir, 'answers.jsonl');
    writeFileSync(
      prompts,
      JSON.stringify({ entityId: 'real', displayName: 'Subject', evidenceDigest: 'prepared' }) +
        '\n',
    );
    writeFileSync(
      join(dir, 'refuse-1.json'),
      JSON.stringify({ entityId: 'forged', evidenceDigest: 'forged', reason: 'No significance' }),
    );
    if (conflict) writeFileSync(join(dir, 'draft-1.json'), '{}');
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        new URL('../session-enrich-collect.ts', import.meta.url).pathname,
        `--prompts=${prompts}`,
        `--drafts=${dir}`,
        `--out=${out}`,
      ],
      { encoding: 'utf8' },
    );
    return {
      status: result.status,
      stderr: result.stderr,
      outputExists: existsSync(out),
      refusals: existsSync(join(dir, 'answers.refusals.json'))
        ? JSON.parse(readFileSync(join(dir, 'answers.refusals.json'), 'utf8'))
        : null,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('collector binds refusal identity and digest to prepared metadata, not model output', () => {
  const result = collectFixture(false);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.refusals[0].entityId, 'real');
  assert.equal(result.refusals[0].evidenceDigest, 'prepared');
});
test('collector rejects simultaneous draft/refusal before emitting artifacts', () => {
  const result = collectFixture(true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Conflicting outcome files/);
  assert.equal(result.outputExists, false);
});
