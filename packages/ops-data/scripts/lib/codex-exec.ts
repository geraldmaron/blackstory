/**
 * One `codex exec` call as a promise, so reviewers can run several at once through `mapPool`
 * instead of one `spawnSync` after another. Read-only sandbox, ephemeral, structured output to
 * `outputPath`. The prompt goes in on stdin and stdin then closes: an open stdin makes codex
 * wait forever for more input.
 */
import { spawn } from 'node:child_process';

export type CodexExecInput = {
  readonly model: string;
  readonly workDir: string;
  readonly schemaPath: string;
  readonly outputPath: string;
  readonly prompt: string;
  readonly timeoutMs: number;
  /** Extra `-c key=value` settings, e.g. `web_search=live`. */
  readonly config?: readonly string[];
};

export function codexExecArgs(input: CodexExecInput): string[] {
  return [
    'exec',
    '-m',
    input.model,
    ...(input.config ?? []).flatMap((setting) => ['-c', setting]),
    '-s',
    'read-only',
    '--skip-git-repo-check',
    '--ephemeral',
    '-C',
    input.workDir,
    '--output-schema',
    input.schemaPath,
    '-o',
    input.outputPath,
    '-',
  ];
}

export function runCodexExec(
  input: CodexExecInput,
): Promise<{ readonly status: number | null; readonly stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('codex', codexExecArgs(input), {
      cwd: input.workDir,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      // Keep the tail only; a failing run can print a lot.
      stderr = (stderr + chunk.toString('utf8')).slice(-4000);
    });
    const timer = setTimeout(() => child.kill('SIGTERM'), input.timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: null, stderr: `${stderr}\n${String(error)}` });
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stderr });
    });
    child.stdin.end(input.prompt);
  });
}
