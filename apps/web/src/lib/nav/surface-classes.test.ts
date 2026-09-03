/**
 * Surface class registry contracts (docs/ui/patterns-surface-classes.md §8).
 *
 * The coverage assertion is the one that matters: it walks the App Router tree on disk and
 * fails when a route that actually renders has no class and is not declared an endpoint. That
 * is the check that stops a new surface from silently inheriting shell rules nobody chose.
 */
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CLASSIFIED_PATHS, ENDPOINT_ROUTES, surfaceClassFor } from './surface-classes';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '../../app');

/** Every route in the App Router tree that renders a page, as a URL path. */
function renderedRoutes(dir: string, urlPath: string): string[] {
  const found: string[] = [];
  if (existsSync(join(dir, 'page.tsx'))) found.push(urlPath === '' ? '/' : urlPath);

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith('_') || name === 'api' || name.startsWith('.')) continue;
    // Route groups `(x)` and parallel routes do not contribute a URL segment.
    const segment = name.startsWith('(') && name.endsWith(')') ? '' : `/${name}`;
    found.push(...renderedRoutes(join(dir, name), `${urlPath}${segment}`));
  }
  return found;
}

/** `/entity/[id]` is a real route; give it a concrete value so the resolver sees a real path. */
function concretePath(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, 'sample');
}

describe('surface class resolution', () => {
  it('puts the front door on its own class and /explore on the Explore instrument', () => {
    assert.equal(surfaceClassFor('/'), 'door');
    assert.equal(surfaceClassFor('/', 'atlas=1'), 'door');
    assert.equal(surfaceClassFor('/?atlas=1'), 'door');
    assert.equal(surfaceClassFor('/?state=DC'), 'door');
    assert.equal(surfaceClassFor('/explore'), 'instrument');
    assert.equal(surfaceClassFor('/explore?state=DC'), 'instrument');
  });

  it('does not classify /story, which was deprecated in favor of the Explore story mode', () => {
    // A classified path with no registry entry fails the coverage test, and a registry entry for
    // a route that never renders puts a 404 in the palette. Story is neither: it is a mode of
    // `/explore`.
    assert.ok(!CLASSIFIED_PATHS.includes('/story'));
  });

  it('separates a catalogue index from its record pages', () => {
    assert.equal(surfaceClassFor('/books'), 'reading');
    assert.equal(surfaceClassFor('/books/the-bluest-eye'), 'record');
    assert.equal(surfaceClassFor('/law'), 'reading');
    assert.equal(surfaceClassFor('/law/hb-1557'), 'record');
    assert.equal(surfaceClassFor('/entity/lynching-sample'), 'record');
    assert.equal(surfaceClassFor('/place/paul-laurence-dunbar-high-school'), 'record');
  });

  it('lets a specific child override its parent prefix', () => {
    // `/stories/*` is a reading room, but the credits page is a utility surface.
    assert.equal(surfaceClassFor('/stories'), 'reading');
    assert.equal(surfaceClassFor('/stories/redlining'), 'reading');
    assert.equal(surfaceClassFor('/stories/mosaic-credits'), 'utility');
    assert.equal(surfaceClassFor('/corrections'), 'utility');
    assert.equal(surfaceClassFor('/corrections/status/ABC123'), 'utility');
  });

  it('emits nothing for an endpoint, which renders no chrome', () => {
    for (const route of ENDPOINT_ROUTES) {
      assert.equal(surfaceClassFor(route), null, `${route} must have no surface class`);
    }
  });

  it('ignores trailing slashes, fragments, and leftover `/` query', () => {
    assert.equal(surfaceClassFor('/about/'), 'reading');
    assert.equal(surfaceClassFor('/?era=1960s&kind=school'), 'door');
    assert.equal(surfaceClassFor('/about#sources'), 'reading');
    assert.equal(surfaceClassFor('/?junk=1'), 'door');
    assert.equal(surfaceClassFor('/explore?era=1960s'), 'instrument');
  });

  it('falls back to utility so an unknown path still gets the 404 surface chrome', () => {
    assert.equal(surfaceClassFor('/no-such-page'), 'utility');
  });
});

describe('surface class coverage', () => {
  it('gives every rendered route in the App Router tree exactly one class', () => {
    const routes = renderedRoutes(appDir, '');
    assert.ok(routes.length > 15, `expected the whole public surface, found ${routes.length}`);

    const endpoints = new Set(ENDPOINT_ROUTES);
    const unclassified = routes.filter((route) => {
      if (endpoints.has(route)) return false;
      // The fallback is deliberate for unknown paths, but a route that exists on disk and
      // resolves only by falling through is a route nobody classified.
      return surfaceClassFor(concretePath(route)) === 'utility' && !isDeclaredUtility(route);
    });

    assert.deepEqual(unclassified, [], 'these routes have no declared surface class');
  });
});

/** Routes the registry names as Utility on purpose, as opposed to reaching it by fallback. */
function isDeclaredUtility(route: string): boolean {
  const declared = [
    '/corrections',
    '/corrections/status/[receiptCode]',
    '/submit',
    '/support',
    '/privacy',
    '/design-system',
    '/locate',
    '/stories/mosaic-credits',
  ];
  return declared.includes(route);
}
