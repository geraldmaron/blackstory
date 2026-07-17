/**
 * Admin surface separation acceptance tests (BB-021).
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getSurfaceDefinition } from '@black-book/config';
import { health } from './surface.ts';

const SOURCE_ROOT = new URL('.', import.meta.url).pathname;

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

test('admin health reports iap-protected posture', () => {
  const payload = health();
  assert.equal(payload.surface, 'admin');
  assert.equal(payload.networkPosture, 'iap-protected');
});

test('admin does not share web runtime identity or app path', () => {
  const admin = getSurfaceDefinition('admin');
  const web = getSurfaceDefinition('web');
  assert.equal(admin.appPath, 'apps/admin');
  assert.notEqual(admin.appPath, web.appPath);
  assert.notEqual(admin.serviceAccountId, web.serviceAccountId);
});

test('admin source does not import apps/web handlers', () => {
  const forbiddenImportPatterns = [
    /from\s+['"]apps\/web/,
    /from\s+['"]@black-book\/web/,
    /import\s*\(\s*['"]apps\/web/,
    /import\s*\(\s*['"]@black-book\/web/,
  ];
  for (const file of collectSourceFiles(SOURCE_ROOT)) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of forbiddenImportPatterns) {
      assert.ok(!pattern.test(content), `${file} must not import from apps/web`);
    }
  }
});
