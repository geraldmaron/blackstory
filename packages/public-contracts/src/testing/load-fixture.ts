/**
 * Test-only fixture loader. Uses `node:fs`/`node:path` deliberately — this file is never part of
 * the package's shipped `dist` output (excluded in `tsconfig.json`) and is never reachable from
 * any `package.json` "exports" entrypoint, so it sits outside the node-free boundary the rest of
 * `src/` must honor (`docs/decisions-carryover.md`, "ADR-021's two invariants": the
 * public-contracts boundary). `scripts/check-boundary.mjs` excludes `src/testing/**` and every
 * `*.test.ts` file under `src/` from its "own src" scan for exactly this reason — tests run under
 * real Node.js (`node --test`), not Metro/Hermes, so node builtins here are legitimate. That
 * exclusion is not what keeps this safe: adding an "exports" entry pointing here would make the
 * entrypoint-graph pass reach this file and fail the gate, which is the behavior to want.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

export function loadFixture<T = unknown>(fileName: string): T {
  const raw = readFileSync(join(FIXTURES_DIR, fileName), 'utf8');
  return JSON.parse(raw) as T;
}
