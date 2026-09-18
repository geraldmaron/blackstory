import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';

test('a broken restored hoist clears only dependency directories and preserves healthy caches', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dependency-cache-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  const script = join(root, 'scripts/install-vercel-dependencies.mjs');
  copyFileSync(
    new URL('../../../../scripts/install-vercel-dependencies.mjs', import.meta.url),
    script,
  );
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'pnpm'),
    '#!/bin/sh\ntest "$1" = install && test "$2" = --frozen-lockfile\n',
    { mode: 0o755 },
  );
  const run = () =>
    execFileSync(process.execPath, [script], {
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
    });
  const hoist = join(root, 'node_modules/.pnpm/node_modules');
  mkdirSync(hoist, { recursive: true });
  mkdirSync(join(root, 'node_modules/.pnpm/present/node_modules/present'), { recursive: true });
  symlinkSync('../present/node_modules/present', join(hoist, 'present'));
  for (const group of ['apps', 'packages']) {
    mkdirSync(join(root, group, 'example/node_modules'), { recursive: true });
    writeFileSync(join(root, group, 'example/package.json'), '{}');
    writeFileSync(join(root, group, 'example/source.ts'), 'export const source = true;');
  }
  run();
  assert.ok(existsSync(join(hoist, 'present')), 'a healthy cache must remain warm');
  symlinkSync('../removed/node_modules/removed', join(hoist, 'removed'));
  assert.throws(() => readFileSync(join(hoist, 'removed/package.json')), { code: 'ENOENT' });
  run();
  assert.equal(existsSync(join(root, 'node_modules')), false);
  for (const group of ['apps', 'packages']) {
    assert.equal(existsSync(join(root, group, 'example/node_modules')), false);
    assert.equal(readFileSync(join(root, group, 'example/package.json'), 'utf8'), '{}');
    assert.equal(
      readFileSync(join(root, group, 'example/source.ts'), 'utf8'),
      'export const source = true;',
    );
  }
  run();
});
