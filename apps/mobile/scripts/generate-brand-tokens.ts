#!/usr/bin/env node
/**
 * Brand token generator (MOB-007). Reads brand/tokens (see
 * scripts/tokens/brand-source.ts for the exact provenance and drift notes),
 * derives the full mobile token set, and writes generated TypeScript
 * constants into src/ui/tokens/generated/.
 *
 * Usage:
 *   pnpm --filter @repo/mobile tokens:generate         # write files
 *   pnpm --filter @repo/mobile tokens:generate --check # diff only, exit 1 on drift
 *
 * The generator is the source of truth; generated files are never
 * hand-edited (each carries a header saying so). This same --check path is
 * what src/ui/tokens/__tests__/no-drift.test.ts calls in-process (importing
 * renderAll directly, not shelling out) so `pnpm test` catches drift too.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBrandTokens } from './tokens/brand-source';
import { renderAll } from './tokens/render';

const OUTPUT_DIR = join(__dirname, '..', 'src', 'ui', 'tokens', 'generated');

function main(): void {
  const checkOnly = process.argv.includes('--check');
  const tokens = buildBrandTokens();
  const files = renderAll(tokens);

  if (checkOnly) {
    const drifted: string[] = [];
    for (const [name, contents] of Object.entries(files)) {
      const path = join(OUTPUT_DIR, name);
      const existing = existsSync(path) ? readFileSync(path, 'utf8') : null;
      if (existing !== contents) {
        drifted.push(name);
      }
    }
    if (drifted.length > 0) {
      console.error(
        `Brand tokens are out of date (drift in: ${drifted.join(', ')}).\n` +
          `Run "pnpm --filter @repo/mobile tokens:generate" and commit the result.`,
      );
      process.exit(1);
    }
    console.log('Brand tokens: no drift.');
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(OUTPUT_DIR, name), contents, 'utf8');
  }
  console.log(`Wrote ${Object.keys(files).length} generated token files to ${OUTPUT_DIR}`);
}

main();
