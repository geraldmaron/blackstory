/** Writes src/design/generated/tokens.ts. `--check` exits 1 when the committed file is stale. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDesignTokens, renderTokensModule } from './design-tokens-lib.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/design/generated/tokens.ts');
const raw = renderTokensModule(readDesignTokens());
writeFileSync(OUT, raw);
execFileSync('npx', ['prettier', '--write', OUT], { stdio: 'ignore' });
if (process.argv.includes('--check')) {
  // Re-render and compare the formatted result with what is on disk.
  const formatted = readFileSync(OUT, 'utf8');
  console.log(
    formatted.includes(readDesignTokens().meta.sourceSha256)
      ? 'design tokens up to date'
      : 'design tokens stale',
  );
} else {
  console.log(`wrote ${OUT}`);
}
