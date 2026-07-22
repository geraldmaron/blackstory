/**
 * MOB-007 "Token generation snapshot; no-drift CI" test.
 *
 * Re-runs the generator's pure render step in-process (no subprocess, no
 * disk writes) and diffs its output against the committed
 * src/ui/tokens/generated/*.ts files, byte for byte. If a future brand/
 * update changes a value and someone forgets to re-run
 * `pnpm --filter @repo/mobile tokens:generate`, this test fails and names
 * exactly which generated file is stale.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBrandTokens } from '../../../../scripts/tokens/brand-source';
import { renderAll } from '../../../../scripts/tokens/render';

const GENERATED_DIR = join(__dirname, '..', 'generated');

describe('brand token generation (no-drift)', () => {
  const tokens = buildBrandTokens();
  const expected = renderAll(tokens);

  it.each(Object.entries(expected))('%s matches the committed generated file', (name, contents) => {
    const committed = readFileSync(join(GENERATED_DIR, name), 'utf8');
    expect(committed).toBe(contents);
  });

  it('does not throw building tokens from the current brand/ source (contrast gates included)', () => {
    expect(() => buildBrandTokens()).not.toThrow();
  });
});
