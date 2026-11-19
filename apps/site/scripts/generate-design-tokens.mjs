/** Writes src/design/generated/tokens.ts. `--check` exits 1 when the committed file is stale. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDesignTokens, renderTokensModule } from './design-tokens-lib.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/design/generated/tokens.ts');
const tokens = readDesignTokens();
if (process.argv.includes('--check')) {
  // Check before writing: the committed file must carry the hash of today's source.
  const fresh = readFileSync(OUT, 'utf8').includes(tokens.meta.sourceSha256);
  console.log(fresh ? 'design tokens up to date' : 'design tokens stale');
  process.exit(fresh ? 0 : 1);
}
writeFileSync(OUT, renderTokensModule(tokens));
execFileSync('npx', ['prettier', '--write', OUT], { stdio: 'ignore' });
console.log(`wrote ${OUT}`);
