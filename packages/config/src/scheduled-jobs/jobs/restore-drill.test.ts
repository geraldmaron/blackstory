/**
 * BB-084: proves the restore-drill job body is REAL — hermetic unit coverage plus a genuine
 * integration test that runs the actual, already-existing scripts/backup-restore/
 * staging-restore.stub.sh in its default DRY_RUN=1 (print-only) mode. No live gcloud command is
 * ever executed by this job or this test.
 */
import assert from 'node:assert/strict';
import { execFile as execFileCb } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { runRestoreDrillJob } from './restore-drill.ts';
import type { ExecFileFn } from './backup-verification.ts';

test('a successful drill print completes the job as success and returns the printed plan', async () => {
  const fakeExecFile: ExecFileFn = async (command, args) => {
    assert.equal(command, 'bash');
    assert.ok(args[0]?.endsWith('staging-restore.stub.sh'));
    return { stdout: '# BB-020 staging import stub\ngcloud firestore import ...', stderr: '', exitCode: 0 };
  };
  const result = await runRestoreDrillJob({
    jobRunId: 'run-1',
    startedAt: '2026-07-17T06:00:00.000Z',
    completedAt: '2026-07-17T06:00:02.000Z',
    execFile: fakeExecFile,
    scriptPath: '/repo/scripts/backup-restore/staging-restore.stub.sh',
  });
  assert.equal(result.ok, true);
  assert.equal(result.run.status, 'success');
  assert.match(result.printedPlan, /gcloud firestore import/);
});

test('a non-zero exit fails the job run', async () => {
  const fakeExecFile: ExecFileFn = async () => ({ stdout: '', stderr: 'boom', exitCode: 2 });
  const result = await runRestoreDrillJob({
    jobRunId: 'run-2',
    startedAt: '2026-07-17T06:00:00.000Z',
    completedAt: '2026-07-17T06:00:02.000Z',
    execFile: fakeExecFile,
    scriptPath: '/repo/scripts/backup-restore/staging-restore.stub.sh',
  });
  assert.equal(result.ok, false);
  assert.equal(result.run.status, 'failure');
});

test('integration: runs the real staging-restore.stub.sh, which stays print-only (no live gcloud call)', async () => {
  const scriptPath = fileURLToPath(
    new URL('../../../../../scripts/backup-restore/staging-restore.stub.sh', import.meta.url),
  );
  const run = promisify(execFileCb);
  const nodeExecFile: ExecFileFn = async (command, args) => {
    try {
      const { stdout, stderr } = await run(command, args as string[]);
      return { stdout, stderr, exitCode: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number };
      return { stdout: err.stdout ?? '', stderr: err.stderr ?? String(error), exitCode: err.code ?? 1 };
    }
  };

  const result = await runRestoreDrillJob({
    jobRunId: 'run-integration',
    startedAt: '2026-07-17T06:00:00.000Z',
    completedAt: '2026-07-17T06:00:02.000Z',
    execFile: nodeExecFile,
    scriptPath,
  });

  assert.equal(result.ok, true, result.printedPlan);
  assert.equal(result.run.status, 'success');
  // Proves this run stayed print-only: the plan text is the printed gcloud command, not
  // evidence of a real import (no "async" import actually ran — this process just printed it).
  assert.match(result.printedPlan, /gcloud firestore import/);
  assert.match(result.printedPlan, /verify-restore\.mjs/);
});
