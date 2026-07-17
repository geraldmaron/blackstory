#!/usr/bin/env node
/**
 * CLI: generate a markdown changelog fragment for a pinned commit range.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateChangelog } from './lib/changelog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

async function main() {
  const toSha = process.argv[2] ?? process.env.CHANGELOG_TO_SHA;
  const fromSha = process.argv[3] ?? process.env.CHANGELOG_FROM_SHA;
  const outputPath =
    process.argv[4] ?? process.env.CHANGELOG_OUTPUT ?? 'artifacts/release-changelog.md';

  if (!toSha) {
    console.error('Usage: generate-changelog.mjs <toSha> [fromSha] [outputPath]');
    process.exit(1);
  }

  const markdown = generateChangelog(ROOT, { fromSha, toSha });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, 'utf8');
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
