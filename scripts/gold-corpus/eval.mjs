/**
 * Launches the TypeScript gold-corpus evaluator with tsx while preserving a plain Node
 * entry point for local and CI dry runs.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const entry = join(root, 'packages', 'testing', 'src', 'gold-corpus', 'cli-entry.ts');
const result = spawnSync(
  process.execPath,
  ['--conditions', 'development', '--import', 'tsx', entry, 'evaluate', ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
