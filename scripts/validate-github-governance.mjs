/**
 * Validates GitHub repository governance artifacts and workflow policy.
 * Checks: required files, SHA-pinned actions, read-only permissions, forbidden events,
 * ruleset required-check alignment, and optional remote ruleset verification.
 */
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const RULESET_PATH = path.join(ROOT, 'infra', 'github', 'rulesets', 'main-protection.json');

const REQUIRED_FILES = [
  '.github/CODEOWNERS',
  '.github/dependabot.yml',
  'SECURITY.md',
  'infra/github/rulesets/main-protection.json',
  'infra/github/allowed-actions.json',
  'infra/github/security-settings.json',
  'infra/github/scripts/apply-governance.sh',
  'infra/github/scripts/check-governance.sh',
  'infra/github/README.md',
];

const REQUIRED_CHECK_NAMES = [
  'Validate',
  'Unit Tests (JS Packages)',
  'Unit Tests (JS Apps)',
  'Unit Tests (Python)',
  'Contract Security Accessibility',
  'Coverage',
  'Integration Firebase',
  'Build and Typecheck',
  'E2E Harness',
  'Governance',
];

const SHA_RE = /^[0-9a-f]{40}$/i;
const USES_RE = /^\s*-\s*uses:\s*([^\s#]+)/;
const JOB_NAME_RE = /^\s+name:\s*(.+?)\s*$/;
const TOP_PERMISSIONS_RE = /^permissions:\s*$/m;
const CONTENTS_READ_RE = /^permissions:[\s\S]*?^\s+contents:\s*read\s*$/m;
const FORBIDDEN_EVENT_RE = /^\s*pull_request_target\s*:/m;

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function fileExists(relativePath) {
  try {
    await access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseUses(line) {
  const match = line.match(USES_RE);
  if (!match) {
    return null;
  }
  const raw = match[1].trim();
  const at = raw.lastIndexOf('@');
  if (at === -1) {
    return { action: raw, ref: '', local: raw.startsWith('./') };
  }
  return {
    action: raw.slice(0, at),
    ref: raw.slice(at + 1),
    local: raw.startsWith('./'),
  };
}

async function validateRequiredFiles() {
  for (const relativePath of REQUIRED_FILES) {
    if (!(await fileExists(relativePath))) {
      fail(`Missing required governance file: ${relativePath}`);
    }
  }
}

async function validateCodeowners() {
  const content = await readFile(path.join(ROOT, '.github', 'CODEOWNERS'), 'utf8');
  const requiredPathHints = [
    '/packages/security/',
    '/infra/',
    '/packages/schemas/constitution/',
    '/infra/database/',
    '/workers/publication/',
  ];
  for (const hint of requiredPathHints) {
    if (!content.includes(hint)) {
      fail(`CODEOWNERS missing expected path owner entry for ${hint}`);
    }
  }
  if (!/@[A-Za-z0-9_.-]+/.test(content)) {
    fail('CODEOWNERS does not declare any @owner');
  }
}

async function validateRuleset() {
  const raw = await readFile(RULESET_PATH, 'utf8');
  let ruleset;
  try {
    ruleset = JSON.parse(raw);
  } catch (error) {
    fail(`Invalid JSON in ruleset: ${error.message}`);
    return;
  }

  if (ruleset.name !== 'main-protection') {
    fail(`Ruleset name must be main-protection (got ${ruleset.name})`);
  }
  if (ruleset.enforcement !== 'active') {
    fail(`Ruleset enforcement must be active (got ${ruleset.enforcement})`);
  }

  const types = new Set((ruleset.rules ?? []).map((rule) => rule.type));
  for (const required of [
    'pull_request',
    'required_status_checks',
    'non_fast_forward',
    'deletion',
  ]) {
    if (!types.has(required)) {
      fail(`Ruleset missing rule type: ${required}`);
    }
  }

  const prRule = (ruleset.rules ?? []).find((rule) => rule.type === 'pull_request');
  if (prRule && prRule.parameters?.required_review_thread_resolution !== true) {
    fail('Ruleset must require resolved review conversations');
  }
  if (prRule && (prRule.parameters?.required_approving_review_count ?? 0) < 1) {
    fail('Ruleset must require at least one approving review');
  }

  const checkRule = (ruleset.rules ?? []).find((rule) => rule.type === 'required_status_checks');
  const contexts = (checkRule?.parameters?.required_status_checks ?? []).map(
    (item) => item.context,
  );
  for (const name of REQUIRED_CHECK_NAMES) {
    if (!contexts.includes(name)) {
      fail(`Ruleset missing required status check: ${name}`);
    }
  }
  for (const context of contexts) {
    if (!REQUIRED_CHECK_NAMES.includes(context)) {
      warn(`Ruleset lists unexpected status check: ${context}`);
    }
  }
}

async function validateWorkflows() {
  const entries = await readdir(WORKFLOWS_DIR);
  const workflowFiles = entries.filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
  if (workflowFiles.length === 0) {
    fail('No workflow files found under .github/workflows');
    return;
  }

  const jobNames = new Set();

  for (const fileName of workflowFiles) {
    const relativePath = path.join('.github', 'workflows', fileName);
    const content = await readFile(path.join(ROOT, relativePath), 'utf8');

    if (FORBIDDEN_EVENT_RE.test(content)) {
      fail(`${relativePath}: forbidden event pull_request_target`);
    }

    if (!TOP_PERMISSIONS_RE.test(content)) {
      fail(`${relativePath}: missing top-level permissions block`);
    } else if (!CONTENTS_READ_RE.test(content)) {
      fail(`${relativePath}: top-level permissions must set contents: read (default read-only)`);
    }

    const lines = content.split('\n');
    let inJobs = false;
    for (const line of lines) {
      if (/^jobs:\s*$/.test(line)) {
        inJobs = true;
      }
      if (inJobs) {
        const jobNameMatch = line.match(JOB_NAME_RE);
        // job-level name: is indented with 4 spaces under a job key
        if (jobNameMatch && /^\s{4}name:\s*/.test(line)) {
          jobNames.add(stripQuotes(jobNameMatch[1]));
        }
      }

      const uses = parseUses(line);
      if (!uses || uses.local) {
        continue;
      }
      if (!SHA_RE.test(uses.ref)) {
        fail(
          `${relativePath}: action ${uses.action} must be pinned to a 40-char commit SHA (got "${uses.ref || 'missing'}")`,
        );
      }
    }
  }

  for (const name of REQUIRED_CHECK_NAMES) {
    if (!jobNames.has(name)) {
      fail(`CI job display name missing for required check: ${name}`);
    }
  }
}

function runRemoteCheck() {
  if (process.env.GOVERNANCE_CHECK_REMOTE !== '1') {
    console.log(
      'SKIP: remote ruleset verification (set GOVERNANCE_CHECK_REMOTE=1 to enable after apply).',
    );
    return;
  }

  const script = path.join(ROOT, 'infra', 'github', 'scripts', 'check-governance.sh');
  const args = process.env.GOVERNANCE_REQUIRE_REMOTE === '1' ? [] : ['--allow-missing-remote'];
  const result = spawnSync(script, args, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    fail('Remote governance check failed (see infra/github/scripts/check-governance.sh output)');
  }
}

async function main() {
  await validateRequiredFiles();
  await validateCodeowners();
  await validateRuleset();
  await validateWorkflows();
  runRemoteCheck();

  for (const message of warnings) {
    console.warn(`WARN: ${message}`);
  }

  if (errors.length > 0) {
    for (const message of errors) {
      console.error(`FAIL: ${message}`);
    }
    console.error(`GitHub governance validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log('GitHub governance validation passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
