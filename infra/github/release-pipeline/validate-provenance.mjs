#!/usr/bin/env node
/**
 * CLI: validate deployment-provenance.json against the checked-in JSON Schema.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProvenance } from './lib/provenance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

async function main() {
  const inputPath = process.argv[2] ?? path.join(ROOT, 'artifacts/deployment-provenance.json');
  const raw = await readFile(inputPath, 'utf8');
  const doc = JSON.parse(raw);
  const result = await validateProvenance(doc);
  if (!result.ok) {
    console.error(`FAIL: ${inputPath}`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
  console.log(`OK: ${inputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
