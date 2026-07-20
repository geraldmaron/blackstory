/**
 * Thin wrappers for release pipeline scripts.
 * Core logic lives in infra/github/release-pipeline/.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIPELINE = path.join(ROOT, 'infra/github/release-pipeline');

/**
 * @param {string} scriptName
 * @param {string} args
 */
export function runPipelineScript(scriptName, args = []) {
  const scriptPath = path.join(PIPELINE, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  return result.status ?? 1;
}
