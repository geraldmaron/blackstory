/**
 * z-index token ladder (repo-92n2.7): guards the one `--ds-z-*` ladder in
 * `packages/ui/src/styles/tokens.css` against reintroduced raw literals and against silent
 * reordering. This is a pure, value-preserving refactor of what used to be ~60 raw numeric
 * `z-index` literals converged on by convention — the ladder must stay declared exactly once,
 * in non-decreasing order, and every stylesheet must reference it by name rather than by number
 * except the allowlisted local-ordering literals, each of which carries an inline
 * `/* local: ... *\/` comment explaining why it is not a global tier.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tokensPath = join(repoRoot, 'packages/ui/src/styles/tokens.css');
const tokensCss = readFileSync(tokensPath, 'utf8');

function listCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true }) as string[]) {
    const full = join(dir, entry);
    if (entry.endsWith('.css') && statSync(full).isFile()) {
      out.push(full);
    }
  }
  return out;
}

const cssFiles = [
  ...listCssFiles(join(repoRoot, 'apps/web/src')),
  ...listCssFiles(join(repoRoot, 'packages/ui/src/styles')),
];

describe('z-index ladder', () => {
  it('is declared exactly once, as --ds-z-* custom properties', () => {
    const tokenDeclarations = [...tokensCss.matchAll(/--ds-z-[\w-]+:\s*(-?\d+);/g)];
    assert.ok(tokenDeclarations.length > 0, 'expected at least one --ds-z-* token');

    // Every --ds-z-* token name must be unique (no duplicate tier declared twice).
    const names = [...tokensCss.matchAll(/(--ds-z-[\w-]+):\s*-?\d+;/g)].map((m) => {
      const name = m[1];
      assert.ok(name, 'expected a captured --ds-z-* token name');
      return name;
    });
    const seen = new Set<string>();
    for (const name of names) {
      assert.ok(!seen.has(name), `--ds-z-* token "${name}" is declared more than once`);
      seen.add(name);
    }

    // The ladder itself must live in exactly one place in the repo — no other stylesheet may
    // declare a --ds-z-* custom property.
    for (const file of cssFiles) {
      if (file === tokensPath) continue;
      const source = readFileSync(file, 'utf8');
      assert.doesNotMatch(
        source,
        /--ds-z-[\w-]+:\s*-?\d+;/,
        `${relative(repoRoot, file)} declares a --ds-z-* token outside tokens.css`,
      );
    }
  });

  it('declares tiers in strictly ascending (non-decreasing) order', () => {
    const values = [...tokensCss.matchAll(/--ds-z-[\w-]+:\s*(-?\d+);/g)].map((m) => Number(m[1]));
    for (let i = 1; i < values.length; i += 1) {
      const prev = values[i - 1];
      const current = values[i];
      assert.ok(prev !== undefined && current !== undefined, 'expected numeric ladder values');
      assert.ok(
        current >= prev,
        `--ds-z-* ladder is not ascending: ${prev} is followed by ${current}`,
      );
    }
  });
});

describe('no raw z-index literals outside the local-ordering allowlist', () => {
  it('requires every raw z-index declaration to carry a "local:" comment', () => {
    const offenders: string[] = [];

    for (const file of cssFiles) {
      if (file === tokensPath) continue;
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        const match = line.match(/z-index:\s*(-?\d+)\s*;(.*)$/);
        if (!match) return;
        const trailing = match[2] ?? '';
        if (/\/\*\s*local:/.test(trailing)) return;
        offenders.push(`${relative(repoRoot, file)}:${index + 1}: ${line.trim()}`);
      });
    }

    assert.deepEqual(
      offenders,
      [],
      `raw z-index literal(s) without a "/* local: ... */" comment:\n${offenders.join('\n')}`,
    );
  });
});
