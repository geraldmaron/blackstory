/**
 * Guards against automatic App Hosting rollouts (ADR-006 / BB-062 AC #1).
 * Validates repo docs/config and deploy workflows — not the live Firebase console.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const WORKFLOWS_DIR = path.join(ROOT, '.github/workflows');
const APPHOSTING_FILES = [
  'apps/web/apphosting.yaml',
  'apps/web/apphosting.production.yaml',
  'apps/web/apphosting.staging.yaml',
];

const RUNBOOK_PATH = 'docs/runbooks/production-release.md';
const DISABLED_PHRASE_RE = /automatic App Hosting rollouts are disabled/i;
const DEPLOY_WORKFLOW_NAMES = [
  'deploy-staging.yml',
  'deploy-production.yml',
  'progressive-release.yml',
];

/**
 * @returns {Promise<{ ok: boolean; errors: string[]; warnings: string[] }>}
 */
export async function assertNoAutomaticRollouts() {
  const errors = [];
  const warnings = [];

  try {
    const runbook = await readFile(path.join(ROOT, RUNBOOK_PATH), 'utf8');
    if (!DISABLED_PHRASE_RE.test(runbook)) {
      errors.push(`${RUNBOOK_PATH}: must document that automatic App Hosting rollouts are disabled`);
    }
  } catch {
    errors.push(`missing release runbook: ${RUNBOOK_PATH}`);
  }

  for (const relativePath of APPHOSTING_FILES) {
    const absolutePath = path.join(ROOT, relativePath);
    try {
      const content = await readFile(absolutePath, 'utf8');
      if (!DISABLED_PHRASE_RE.test(content)) {
        warnings.push(
          `${relativePath}: add explicit note that automatic App Hosting rollouts are disabled (production template already documents this)`,
        );
      }
    } catch {
      warnings.push(`App Hosting config not found (may be pre-Blaze): ${relativePath}`);
    }
  }

  const workflowEntries = await readdir(WORKFLOWS_DIR);
  for (const fileName of DEPLOY_WORKFLOW_NAMES) {
    if (!workflowEntries.includes(fileName)) {
      errors.push(`missing deploy workflow: .github/workflows/${fileName}`);
      continue;
    }
    const content = await readFile(path.join(WORKFLOWS_DIR, fileName), 'utf8');
    if (/^\s*push:\s*$/m.test(content) && /branches:\s*\[main\]/m.test(content)) {
      errors.push(`${fileName}: must not auto-deploy on push to main`);
    }
    if (!/workflow_dispatch:/m.test(content)) {
      warnings.push(`${fileName}: expected workflow_dispatch for explicit operator control`);
    }
    if (!/commit_sha|commit-sha|commitSha|github\.sha/i.test(content)) {
      errors.push(`${fileName}: must pin an explicit commit SHA for deploy`);
    }
    if (!/promote|rollout/i.test(content)) {
      warnings.push(`${fileName}: expected explicit promote/rollout step naming`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
