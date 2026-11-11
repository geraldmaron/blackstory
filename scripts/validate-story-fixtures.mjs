#!/usr/bin/env node
/**
 * Offline gate for authored story fixtures (`packages/ops-data/fixtures/stories/*.ts`).
 *
 * Runs `stories.ts validate` — schema, inline-citation integrity, call-out citations, collection
 * positions and the voice/source-tier warnings — over every fixture module, so a story PR is
 * checked before review instead of at `apply` time. Warnings print but do not fail; a hard
 * validation error does.
 *
 * Always offline: DATABASE_URL, CHECK_URLS and CHECK_DOIS are stripped from the child's
 * environment, so CI never reaches a database or the network from this step, and a pass here
 * means "the fixture is well-formed", not "its citations resolve against the release".
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = join(root, 'packages/ops-data/fixtures/stories');

const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
  .filter(
    (entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'),
  )
  .map((entry) => join(fixturesDir, entry.name))
  .sort();

if (fixtures.length === 0) {
  console.log('validate-story-fixtures: no fixture modules found; nothing to check.');
  process.exit(0);
}

const env = { ...process.env };
delete env.DATABASE_URL;
delete env.CHECK_URLS;
delete env.CHECK_DOIS;

let failed = 0;
for (const fixture of fixtures) {
  const label = relative(root, fixture);
  const result = spawnSync(
    process.execPath,
    [
      '--conditions',
      'development',
      '--import',
      'tsx',
      join(root, 'packages/ops-data/scripts/stories.ts'),
      'validate',
      fixture,
    ],
    { cwd: root, env, encoding: 'utf8' },
  );
  const warnings = (result.stderr ?? '')
    .split('\n')
    .filter((line) => line.startsWith('warning:')).length;
  if (result.status === 0) {
    console.log(
      `ok   ${label}${warnings > 0 ? ` (${warnings} warning${warnings === 1 ? '' : 's'})` : ''}`,
    );
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
    console.error((result.stderr || result.stdout || '').trim());
  }
}

if (failed > 0) {
  console.error(`validate-story-fixtures: ${failed} of ${fixtures.length} fixture modules failed.`);
  process.exit(1);
}
console.log(`validate-story-fixtures: ${fixtures.length} fixture modules valid.`);
