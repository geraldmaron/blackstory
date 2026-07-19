/**
 * Proves the backup-verification job body is REAL. Two layers:
 * 1. A hermetic unit test with an injected fake execFile, proving argument-building and
 * stdout/exit-code handling.
 * 2. A genuine integration test that spawns the actual, already-tested script
 * (scripts/backup-restore/verify-restore.mjs) as a real subprocess no mocking proving
 * this job body is wired to real, working code rather than a stub that merely looks real.
 */
import assert from 'node:assert/strict';
import { execFile as execFileCb } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import {
  buildVerifyRestoreArgs,
  runBackupVerificationJob,
  type ExecFileFn,
} from './backup-verification.ts';

test('buildVerifyRestoreArgs includes only the flags that were supplied', () => {
  assert.deepEqual(buildVerifyRestoreArgs({ metadataPath: '/tmp/metadata.json' }), [
    '--json',
    '--metadata',
    '/tmp/metadata.json',
  ]);
  assert.deepEqual(
    buildVerifyRestoreArgs({
      metadataPath: '/tmp/metadata.json',
      baselineCountsPath: '/tmp/counts.json',
      activePointerPath: '/tmp/pointer.json',
      releasePath: '/tmp/release.json',
    }),
    [
      '--json',
      '--metadata',
      '/tmp/metadata.json',
      '--baseline-counts',
      '/tmp/counts.json',
      '--active-pointer',
      '/tmp/pointer.json',
      '--release',
      '/tmp/release.json',
    ],
  );
});

test('a passing verification (hermetic, fake execFile) completes the job as success', async () => {
  const fakeExecFile: ExecFileFn = async (command, args) => {
    assert.equal(command, 'node');
    assert.ok(args.includes('--json'));
    return {
      stdout: JSON.stringify({ export: { ok: true, errors: [] }, activeRelease: null }),
      stderr: '',
      exitCode: 0,
    };
  };
  const result = await runBackupVerificationJob({
    jobRunId: 'run-1',
    startedAt: '2026-07-17T05:00:00.000Z',
    completedAt: '2026-07-17T05:00:10.000Z',
    execFile: fakeExecFile,
    scriptPath: '/repo/scripts/backup-restore/verify-restore.mjs',
    metadataPath: '/tmp/metadata.json',
  });
  assert.equal(result.ok, true);
  assert.equal(result.run.status, 'success');
  assert.deepEqual(result.report, { export: { ok: true, errors: [] }, activeRelease: null });
});

test('a failing verification (hermetic, fake execFile) fails the job run with an error summary', async () => {
  const fakeExecFile: ExecFileFn = async () => ({
    stdout: JSON.stringify({ export: { ok: false, errors: ['schemaVersion must be 1'] } }),
    stderr: '',
    exitCode: 1,
  });
  const result = await runBackupVerificationJob({
    jobRunId: 'run-2',
    startedAt: '2026-07-17T05:00:00.000Z',
    completedAt: '2026-07-17T05:00:10.000Z',
    execFile: fakeExecFile,
    scriptPath: '/repo/scripts/backup-restore/verify-restore.mjs',
    metadataPath: '/tmp/metadata.json',
  });
  assert.equal(result.ok, false);
  assert.equal(result.run.status, 'failure');
  assert.match(result.run.errorSummary ?? '', /exited 1/);
});

test('integration: runs the real scripts/backup-restore/verify-restore.mjs as a subprocess', async () => {
  const scriptPath = fileURLToPath(
    new URL('../../../../../scripts/backup-restore/verify-restore.mjs', import.meta.url),
  );
  const tempDir = mkdtempSync(path.join(tmpdir(), 'bb084-backup-verification-'));
  try {
    const metadataPath = path.join(tempDir, 'metadata.json');
    writeFileSync(
      metadataPath,
      JSON.stringify({
        schemaVersion: 1,
        exportUri: 'gs://black-book-efaaf-firestore-backups/exports/test/',
        completedAt: '2026-07-17T05:00:00.000Z',
        tier: 'canonical',
        documentCounts: {},
        collectionHashes: {},
      }),
      'utf8',
    );

    const run = promisify(execFileCb);
    const nodeExecFile: ExecFileFn = async (command, args) => {
      try {
        const { stdout, stderr } = await run(command, args as string[]);
        return { stdout, stderr, exitCode: 0 };
      } catch (error) {
        const err = error as { stdout?: string; stderr?: string; code?: number };
        return {
          stdout: err.stdout ?? '',
          stderr: err.stderr ?? String(error),
          exitCode: err.code ?? 1,
        };
      }
    };

    const result = await runBackupVerificationJob({
      jobRunId: 'run-integration',
      startedAt: '2026-07-17T05:00:00.000Z',
      completedAt: '2026-07-17T05:00:05.000Z',
      execFile: nodeExecFile,
      scriptPath,
      metadataPath,
    });

    assert.equal(result.ok, true, JSON.stringify(result.report));
    assert.equal(result.run.status, 'success');
    assert.ok(result.report && typeof result.report === 'object');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
