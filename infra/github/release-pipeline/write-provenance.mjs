#!/usr/bin/env node
/**
 * CLI: write deployment provenance JSON for staging or production deploy jobs.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAndValidateProvenance } from './lib/provenance.mjs';

function readEnv(name, fallback = '') {
  return process.env[name] ?? fallback;
}

async function main() {
  const environment = readEnv('PROVENANCE_ENVIRONMENT', 'staging');
  const outputPath = readEnv('PROVENANCE_OUTPUT', 'artifacts/deployment-provenance.json');

  const doc = await buildAndValidateProvenance({
    environment,
    commitSha: readEnv('PROVENANCE_COMMIT_SHA'),
    ref: readEnv('PROVENANCE_GIT_REF', 'refs/heads/main'),
    repository: readEnv('PROVENANCE_REPOSITORY'),
    repositoryId: readEnv('PROVENANCE_REPOSITORY_ID', '0'),
    ownerId: readEnv('PROVENANCE_OWNER_ID', '0'),
    workflow: readEnv('PROVENANCE_WORKFLOW'),
    workflowRef: readEnv('PROVENANCE_WORKFLOW_REF'),
    runId: readEnv('PROVENANCE_RUN_ID', '0'),
    runAttempt: readEnv('PROVENANCE_RUN_ATTEMPT', '1'),
    serverUrl: readEnv('PROVENANCE_SERVER_URL', 'https://github.com'),
    workloadIdentityProvider: readEnv(
      'PROVENANCE_WIF_PROVIDER',
      'projects/332234323945/locations/global/workloadIdentityPools/black-book-github/providers/github-actions',
    ),
    serviceAccountEmail: readEnv(
      'PROVENANCE_SERVICE_ACCOUNT',
      'github-deploy@black-book-efaaf.iam.gserviceaccount.com',
    ),
    deployedAt: readEnv('PROVENANCE_DEPLOYED_AT', new Date().toISOString()),
    notes: readEnv('PROVENANCE_NOTES'),
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
