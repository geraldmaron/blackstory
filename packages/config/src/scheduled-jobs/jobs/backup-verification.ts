
/**
 * REAL roster entry: backup verification + restore-drill scheduling. Rather
 * than re-importing scripts/backup-restore's plain-.mjs verification helpers into this
 * TypeScript package (a fragile cross-format coupling), this wrapper invokes the actual,
 * already-tested CLI (scripts/backup-restore/verify-restore.mjs --json) as a subprocess which
 * is also the realistic shape of how a Cloud Run Job actually runs this today: a container
 * invoking a script, not a function call. The exec function is injected so tests can run both
 * hermetically (fake exec) and as a genuine integration test against the real script (see
 * backup-verification.test.ts).
 */
import { completeJobRun, failJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const BACKUP_VERIFICATION_JOB_ID = 'backup-verification-daily';

export type ExecFileResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type ExecFileFn = (
  command: string,
  args: readonly string[],
) => Promise<ExecFileResult>;

export type BackupVerificationJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly execFile: ExecFileFn;
  /** Absolute path to scripts/backup-restore/verify-restore.mjs. */
  readonly scriptPath: string;
  readonly metadataPath: string;
  readonly baselineCountsPath?: string;
  readonly baselineHashesPath?: string;
  readonly activePointerPath?: string;
  readonly releasePath?: string;
};

export type BackupVerificationJobResult = {
  readonly run: JobRunRecord;
  readonly ok: boolean;
  readonly report: unknown;
};

export function buildVerifyRestoreArgs(
  input: Omit<BackupVerificationJobInput, 'jobRunId' | 'startedAt' | 'completedAt' | 'execFile' | 'scriptPath'>,
): string[] {
  const args = ['--json', '--metadata', input.metadataPath];
  if (input.baselineCountsPath !== undefined) args.push('--baseline-counts', input.baselineCountsPath);
  if (input.baselineHashesPath !== undefined) args.push('--baseline-hashes', input.baselineHashesPath);
  if (input.activePointerPath !== undefined) args.push('--active-pointer', input.activePointerPath);
  if (input.releasePath !== undefined) args.push('--release', input.releasePath);
  return args;
}

export async function runBackupVerificationJob(
  input: BackupVerificationJobInput,
): Promise<BackupVerificationJobResult> {
  const started = startJobRun({
    jobId: BACKUP_VERIFICATION_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });
  const args = [input.scriptPath, ...buildVerifyRestoreArgs(input)];
  const { stdout, exitCode } = await input.execFile('node', args);

  let report: unknown = null;
  try {
    report = JSON.parse(stdout);
  } catch {
    // stdout wasn't valid JSON report stays null.
  }

  const ok = exitCode === 0;
  const run = ok
    ? completeJobRun(started, { completedAt: input.completedAt, itemsExpected: 1, itemsProcessed: 1 })
    : failJobRun(started, {
        completedAt: input.completedAt,
        errorSummary: `scripts/backup-restore/verify-restore.mjs exited ${exitCode}`,
      });

  return { run, ok, report };
}
