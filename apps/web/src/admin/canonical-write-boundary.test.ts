/**
 * Canonical-write credential boundary (replaces the old `apps/admin/src/surface.test.ts`
 * "no imports from apps/web" check, which stopped meaning anything once admin became a route
 * group inside this same app).
 *
 * What actually has to stay true after the merge: nothing outside `src/admin/**` can reach the
 * write-capable canonical Postgres pool (`ADMIN_DATABASE_URL`, via `canonical-postgres-client.ts`)
 * or the single write-authorization choke point (`canonical-write.ts`). A bug anywhere in the
 * public site's code must not be able to write `bb_canonical`/`bb_ops` just because it now shares
 * a process with `/admin`.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url));
const ADMIN_PREFIX = join(SRC_ROOT, 'admin');
const ADMIN_ROUTE_PREFIX = join(SRC_ROOT, 'app', 'admin');

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+['"][^'"]*canonical-postgres-client['"]/,
  /from\s+['"][^'"]*\bcanonical-write['"]/,
  /import\(\s*['"][^'"]*canonical-postgres-client['"]/,
  /import\(\s*['"][^'"]*\bcanonical-write['"]/,
];

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  if (!existsSync(directory)) return files;
  const entries = readdirSync(directory, { withFileTypes: true });
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

function isInsideAdminNamespace(filePath: string): boolean {
  return filePath.startsWith(ADMIN_PREFIX) || filePath.startsWith(ADMIN_ROUTE_PREFIX);
}

test('only src/admin/** and app/admin/** import the canonical write-capable modules', () => {
  const allFiles = collectSourceFiles(SRC_ROOT);
  const outsideAdmin = allFiles.filter((file) => !isInsideAdminNamespace(file));
  assert.ok(outsideAdmin.length > 0, 'sanity check: there must be public-site files to scan');

  for (const file of outsideAdmin) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      assert.ok(
        !pattern.test(content),
        `${file} is outside the admin namespace and must not import the canonical write-capable ` +
          `Postgres client or write-authorization module`,
      );
    }
  }
});

test('the admin namespace itself is where the canonical write modules actually live', () => {
  const adminFiles = collectSourceFiles(ADMIN_PREFIX).concat(
    collectSourceFiles(ADMIN_ROUTE_PREFIX),
  );
  const definesCanonicalClient = adminFiles.some((file) =>
    file.endsWith('canonical-postgres-client.ts'),
  );
  const definesCanonicalWrite = adminFiles.some((file) => file.endsWith('canonical-write.ts'));
  assert.ok(definesCanonicalClient, 'canonical-postgres-client.ts must live under src/admin/**');
  assert.ok(definesCanonicalWrite, 'canonical-write.ts must live under src/admin/**');
});
