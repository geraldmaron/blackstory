/**
 * Leftover-stack guards for the public web request path.
 *
 * These lock what a first page view on blackstory.app is allowed to depend on:
 * Vercel + one Supabase project (`blackstory-app` / twykhihqkcldpreuovay) +
 * optional GCS dual-serve for leftover image URLs. They fail if a second
 * Supabase project, a Firebase client, or a PostgREST/Realtime SDK lands on
 * this surface. They do not claim the org bill is zero.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildContentSecurityPolicy } from '../web-security/csp';
import { FORBIDDEN_PUBLIC_RENDER_IMPORTS } from './constants';
import { collectPublicRenderPathFindings } from './public-render-path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '../../..');
const SRC_ROOT = join(WEB_ROOT, 'src');
const PACKAGE_JSON = join(WEB_ROOT, 'package.json');

const PRODUCT_SUPABASE_REF = 'twykhihqkcldpreuovay';
const OTHER_SUPABASE_REFS = ['cqdukiktqmcoantrbxzy', 'ltpqfgfcvrmfctcaisuw'] as const;
const OTHER_SUPABASE_NAMES = ['geralddagher-site', 'theadministration-app'] as const;

const FIREBASE_CLIENT_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](?:firebase(?:-admin)?(?:\/[^'"]*)?|@repo\/firebase|@google-cloud\/firestore)['"]/;
const SUPABASE_JS_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]@supabase\/[^'"]+['"]/;

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(tsx?|mjs|cjs|js)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

test('public web package has no Firebase or Supabase JS SDK', () => {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
  };
  const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  for (const name of names) {
    assert.doesNotMatch(name, /^firebase(-admin)?$/);
    assert.doesNotMatch(name, /^@firebase\//);
    assert.doesNotMatch(name, /^@repo\/firebase$/);
    assert.doesNotMatch(name, /^@supabase\//);
  }
  assert.ok(names.includes('next'), 'public web stays a Next/Vercel surface');
  assert.ok(names.includes('pg'), 'public catalog reads use node-pg, not PostgREST');
  assert.ok(names.includes('@vercel/analytics'), 'Vercel analytics is the only first-party analytics SDK');
});

test('apps/web/src does not import Firebase clients or @supabase/*', () => {
  const files = collectSourceFiles(SRC_ROOT);
  assert.ok(files.length > 50, 'expected to scan the public web tree');
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      FIREBASE_CLIENT_IMPORT,
      `${file} must not import a Firebase client`,
    );
    assert.doesNotMatch(source, SUPABASE_JS_IMPORT, `${file} must not import @supabase/*`);
  }
});

test('public render-path bans cover leftover Firebase and Supabase JS clients', () => {
  const findings = collectPublicRenderPathFindings(
    'fake.tsx',
    [
      `import { initializeApp } from 'firebase/app'`,
      `export { x } from '@repo/firebase'`,
      `import { createClient } from '@supabase/supabase-js'`,
    ].join('\n'),
  );
  const snippets = findings.map((finding) => finding.snippet).join('\n');
  assert.match(snippets, /firebase\/app/);
  assert.match(snippets, /@repo\/firebase/);
  assert.match(snippets, /@supabase\//);
  for (const pattern of FORBIDDEN_PUBLIC_RENDER_IMPORTS) {
    assert.ok(pattern instanceof RegExp);
  }
});

test('apps/web does not name the other two org Supabase projects', () => {
  const roots = [SRC_ROOT, join(WEB_ROOT, '.env.example'), join(WEB_ROOT, 'vercel.json')];
  for (const root of roots) {
    const files = existsSync(root) && !root.endsWith('.json') && !root.includes('.env')
      ? collectSourceFiles(root)
      : existsSync(root)
        ? [root]
        : [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const ref of OTHER_SUPABASE_REFS) {
        assert.equal(source.includes(ref), false, `${file} must not mention ${ref}`);
      }
      for (const name of OTHER_SUPABASE_NAMES) {
        assert.equal(source.includes(name), false, `${file} must not mention ${name}`);
      }
    }
  }
});

test('CSP allows only blackstory-app among supabase.co hosts', () => {
  const csp = buildContentSecurityPolicy({ isDev: false });
  const sources = csp.split(/[\s;]+/u).filter(Boolean);
  const supabaseHosts = sources.filter((source) => source.includes('supabase.co'));
  assert.deepEqual(supabaseHosts, [`https://${PRODUCT_SUPABASE_REF}.supabase.co`]);
  for (const ref of OTHER_SUPABASE_REFS) {
    assert.equal(csp.includes(ref), false);
  }
});

test('home stays a small dynamic shell; catalog is a separate cached route', () => {
  const page = readFileSync(join(SRC_ROOT, 'app/page.tsx'), 'utf8');
  const loader = readFileSync(join(SRC_ROOT, 'app/explore/AtlasLoader.tsx'), 'utf8');
  const catalogRoute = readFileSync(join(SRC_ROOT, 'app/atlas/catalog/route.ts'), 'utf8');
  const catalog = readFileSync(join(SRC_ROOT, 'app/explore/atlas-catalog.ts'), 'utf8');

  assert.match(page, /export const dynamic = 'force-dynamic'/);
  assert.match(page, /<AtlasLoader shell=\{shell\} \/>/);
  assert.doesNotMatch(page, /initial=\{/);
  assert.match(loader, /ATLAS_CATALOG_PATH/);
  assert.match(catalogRoute, /ATLAS_CATALOG_CACHE_CONTROL/);
  assert.match(catalog, /s-maxage=3600/);
});

test('point reads are limited; full catalog SQL stays the documented unbounded fallback', () => {
  const source = readFileSync(join(SRC_ROOT, 'lib/public-data/postgres-readers.ts'), 'utf8');
  assert.match(
    source,
    /FROM bb_public\.active_release[\s\S]*?LIMIT 1/,
    'active-release pointer must stay a single-row read',
  );
  assert.match(
    source,
    /FROM bb_public\.release_entities[\s\S]*?LIMIT 1/,
    'single-entity point-get must stay limited',
  );
  assert.match(source, /export const POSTGRES_ENTITY_BATCH_SIZE = 100/);

  const listFn = /export async function listPublicEntityProjections[\s\S]*?\n\}/.exec(source)?.[0];
  assert.ok(listFn, 'listPublicEntityProjections must exist');
  assert.match(listFn, /FROM bb_public\.release_entities/);
  assert.doesNotMatch(
    listFn,
    /LIMIT \d+/,
    'do not silently LIMIT the catalog fallback; that would truncate the map. Cache or artifact it.',
  );
});
