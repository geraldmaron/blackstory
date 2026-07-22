/**
 * Guards against automatic production deploys (ADR-006 / ADR-027).
 * Validates repo docs and deploy workflows — not live Vercel or Firebase consoles.
 * Public web ships on Vercel; App Hosting promote for public web is retired.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const WORKFLOWS_DIR = path.join(ROOT, '.github/workflows');

const RUNBOOK_PATH = 'docs/runbooks/production-release.md';
/** Production doctrine: no unattended production traffic moves. */
const NO_AUTO_PROD_PHRASE_RE =
  /automatic (App Hosting rollouts|production (deploys|promotes)|Vercel production promotes) are disabled/i;

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
    if (!NO_AUTO_PROD_PHRASE_RE.test(runbook) && !/Vercel/i.test(runbook)) {
      errors.push(
        `${RUNBOOK_PATH}: must document that automatic production deploys/promotes are disabled (Vercel public web)`,
      );
    }
    if (!/Vercel/i.test(runbook)) {
      errors.push(`${RUNBOOK_PATH}: must document Vercel as the public web host`);
    }
  } catch {
    errors.push(`missing release runbook: ${RUNBOOK_PATH}`);
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
    if (/promote-app-hosting\.sh|apphosting:rollouts:create/i.test(content)) {
      errors.push(
        `${fileName}: public-web App Hosting promote is retired — remove promote-app-hosting.sh / rollouts:create`,
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
