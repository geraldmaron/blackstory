import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  discoverRoutes,
  routeFromPagePath,
  validateInventory,
} from './check-surface-inventory.mjs';

const tempDirs = [];
function tempRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'surface-inventory-'));
  tempDirs.push(root);
  const appDir = path.join(root, 'apps/web/src/app');
  mkdirSync(appDir, { recursive: true });
  return { root, appDir };
}

function writeFile(root, relativePath, content = '// fixture') {
  const file = path.join(root, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function entry(root, route, source) {
  const component = 'apps/web/src/components/Fixture.tsx';
  const evidence = 'docs/redesign/evidence.md';
  writeFile(root, component);
  writeFile(root, evidence);
  return {
    route,
    source,
    family: 'reading-data',
    access: 'public',
    status: 'baseline',
    states: {
      default: {
        status: 'baseline',
        reason: 'The page module defines the current route output.',
        evidence: [source],
      },
      loading: {
        status: 'not-applicable',
        reason: 'The fixture route is static and has no route-specific loading state.',
        evidence: [source],
      },
      error: {
        status: 'pending',
        reason: 'The fixture spec requests an error treatment.',
        evidence: [evidence],
      },
      empty: {
        status: 'not-applicable',
        reason: 'The fixture route is not a collection.',
        evidence: [source],
      },
      selected: {
        status: 'not-applicable',
        reason: 'The fixture route has no selection interaction.',
        evidence: [source],
      },
      auth: {
        status: 'not-applicable',
        reason: 'The fixture route is public.',
        evidence: [source],
      },
    },
    componentRefs: [component],
    evidence: [source, evidence],
  };
}

function validManifest(routes) {
  return { schemaVersion: 1, routes, sharedSurfaces: [] };
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('Next App Router path discovery', () => {
  it('removes route groups, excludes private folders, preserves dynamic segment patterns, and accepts JS/TS page extensions', () => {
    assert.equal(routeFromPagePath('(site)/stories/[...slug]/page.tsx'), '/stories/[...slug]');
    assert.equal(routeFromPagePath('records/[[...filter]]/page.jsx'), '/records/[[...filter]]');
    assert.equal(routeFromPagePath('_components/page.tsx'), null);
    assert.equal(routeFromPagePath('folder/page.mjs'), null);

    const { root, appDir } = tempRepo();
    writeFile(root, 'apps/web/src/app/(site)/page.tsx');
    writeFile(root, 'apps/web/src/app/(site)/stories/[...slug]/page.ts');
    writeFile(root, 'apps/web/src/app/_private/page.jsx');
    writeFile(root, 'apps/web/src/app/legacy/page.mjs');
    assert.deepEqual(discoverRoutes(appDir), [
      { route: '/', source: 'apps/web/src/app/(site)/page.tsx' },
      { route: '/stories/[...slug]', source: 'apps/web/src/app/(site)/stories/[...slug]/page.ts' },
    ]);
  });

  it('reports two page files that collapse to the same public URL through route groups', () => {
    const { root, appDir } = tempRepo();
    writeFile(root, 'apps/web/src/app/(marketing)/page.tsx');
    writeFile(root, 'apps/web/src/app/(archive)/page.jsx');
    const errors = validateInventory({ root, appDir, manifest: validManifest([]) });
    assert.ok(errors.some((error) => error.includes('duplicate source route /')));
  });

  it('rejects an unsupported page module convention rather than silently mapping it', () => {
    const { root, appDir } = tempRepo();
    writeFile(root, 'apps/web/src/app/unsupported/page.mjs');
    const manifest = validManifest([
      entry(root, '/unsupported', 'apps/web/src/app/unsupported/page.mjs'),
    ]);
    const errors = validateInventory({ root, appDir, manifest });
    assert.ok(errors.some((error) => error.includes('not a discovered Next page module')));
    assert.ok(errors.some((error) => error.includes('removed or stale manifest route')));
  });

  it('fails explicitly on parallel slots and intercepted route conventions', () => {
    for (const [folder, phrase] of [
      ['@modal/photo', 'parallel route slot'],
      ['(.)photo', 'intercepted route'],
    ]) {
      const { root, appDir } = tempRepo();
      writeFile(root, `apps/web/src/app/${folder}/page.tsx`);
      const errors = validateInventory({ root, appDir, manifest: validManifest([]) });
      assert.ok(
        errors.some((error) => error.includes(phrase)),
        `${folder} should be diagnosed`,
      );
    }
  });

  it('detects equivalent dynamic URL patterns with different parameter names', () => {
    const { root, appDir } = tempRepo();
    writeFile(root, 'apps/web/src/app/entity/[id]/page.tsx');
    writeFile(root, 'apps/web/src/app/entity/[slug]/page.tsx');
    const errors = validateInventory({ root, appDir, manifest: validManifest([]) });
    assert.ok(errors.some((error) => error.includes('dynamic route shape collision /entity/[]')));
  });
});

describe('inventory integrity', () => {
  it('accepts an exact route and source mapping with valid component, evidence, and state refs', () => {
    const { root, appDir } = tempRepo();
    writeFile(root, 'apps/web/src/app/records/page.tsx');
    const route = entry(root, '/records', 'apps/web/src/app/records/page.tsx');
    assert.deepEqual(validateInventory({ root, appDir, manifest: validManifest([route]) }), []);
  });

  it('rejects a pending or not-applicable loading state when a loading.tsx sits beside the page', () => {
    const { root, appDir } = tempRepo();
    writeFile(root, 'apps/web/src/app/books/page.tsx');
    writeFile(root, 'apps/web/src/app/books/loading.tsx');
    const route = entry(root, '/books', 'apps/web/src/app/books/page.tsx');
    const stale = validateInventory({ root, appDir, manifest: validManifest([route]) });
    assert.ok(
      stale.some(
        (error) => error.includes('states.loading') && error.includes('loading.tsx exists'),
      ),
    );

    route.states.loading.status = 'baseline';
    route.states.loading.evidence = ['apps/web/src/app/books/loading.tsx'];
    assert.deepEqual(validateInventory({ root, appDir, manifest: validManifest([route]) }), []);
  });

  it('catches new and removed routes, bad refs, duplicate mappings, and invalid or missing state statuses', () => {
    const { root, appDir } = tempRepo();
    writeFile(root, 'apps/web/src/app/current/page.tsx');
    writeFile(root, 'apps/web/src/app/new/page.js');
    const current = entry(root, '/stale', 'apps/web/src/app/current/page.tsx');
    current.status = 'complete';
    current.states.loading.status = 'verified';
    delete current.states.loading.reason;
    delete current.states.empty.status;
    delete current.states.empty.evidence;
    current.componentRefs = ['apps/web/src/components/Missing.tsx'];
    current.evidence = ['docs/redesign/missing.md'];
    const duplicate = {
      ...entry(root, '/stale', 'apps/web/src/app/current/page.tsx'),
      route: '/duplicate',
    };
    const errors = validateInventory({
      root,
      appDir,
      manifest: validManifest([current, duplicate]),
    });

    assert.ok(errors.some((error) => error.includes('unmapped source route /new')));
    assert.ok(errors.some((error) => error.includes('removed or stale manifest route: /stale')));
    assert.ok(errors.some((error) => error.includes('does not match source route /current')));
    assert.ok(errors.some((error) => error.includes('referenced file does not exist')));
    assert.ok(errors.some((error) => error.includes('mapped more than once')));
    assert.ok(
      errors.some((error) =>
        error.includes('expected baseline, partial, pending, complete, or not-applicable'),
      ),
    );
    assert.ok(errors.some((error) => error.includes('states.empty.status')));
    assert.ok(errors.some((error) => error.includes('states.loading.reason')));
    assert.ok(errors.some((error) => error.includes('states.empty.evidence')));
    assert.ok(
      errors.some((error) => error.includes('complete status requires verification.revision')),
    );
  });
});
