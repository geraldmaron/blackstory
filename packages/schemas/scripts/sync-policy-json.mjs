/**
 * Keep the serverless-bundled policy copy in sync with the authored constitution JSON.
 * Authoritative file: packages/schemas/constitution/policy.v1.json
 * Bundled copy: packages/schemas/src/constitution/policy.v1.json
 */
import { copyFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'constitution', 'policy.v1.json');
const to = join(root, 'src', 'constitution', 'policy.v1.json');

copyFileSync(from, to);

const authored = readFileSync(from, 'utf8');
const bundled = readFileSync(to, 'utf8');
if (authored !== bundled) {
  throw new Error('policy.v1.json sync failed: authored and bundled copies differ');
}

console.log('synced constitution/policy.v1.json → src/constitution/policy.v1.json');
