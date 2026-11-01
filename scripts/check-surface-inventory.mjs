/**
 * Keep the redesign inventory aligned with the routes and implementation files that ship.
 * The inventory is a planning baseline, not a visual QA report.
 *
 * Run with `pnpm check:surface-inventory` or as part of `pnpm validate`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = path.join(ROOT, 'apps/web/src/app');
const MANIFEST_PATH = path.join(ROOT, 'docs/redesign/surface-inventory.json');
const VALID_STATUSES = new Set(['baseline', 'partial', 'pending', 'complete']);
const VALID_STATE_STATUSES = new Set([...VALID_STATUSES, 'not-applicable']);
const VALID_FAMILIES = new Set([
  'ground-map',
  'records-archive',
  'reading-data',
  'trust-policy',
  'forms',
  'utility',
  'admin',
  'redirect',
]);
const VALID_ACCESS = new Set(['public', 'public-redirect', 'staff', 'auth-entry']);
const PAGE_FILE = /^page\.(?:tsx?|jsx?)$/;
const ROUTE_STATES = ['default', 'loading', 'error', 'empty', 'selected', 'auth'];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

/** Next route groups do not contribute a URL segment; private folders are not routes. */
function routeFromPagePath(relativePath) {
  const parts = toPosix(relativePath).split('/');
  const file = parts.pop();
  if (!file || !PAGE_FILE.test(file)) return null;
  for (const segment of parts) {
    if (segment.startsWith('@')) {
      throw new Error(
        `unsupported parallel route slot segment "${segment}" in ${relativePath}; inventory discovery only maps URL routes`,
      );
    }
    if (/^\(\.{1,3}\)/.test(segment) || /^\(\.\.\)\(\.\.\)/.test(segment)) {
      throw new Error(
        `unsupported intercepted route segment "${segment}" in ${relativePath}; inventory discovery only maps URL routes`,
      );
    }
  }
  const segments = parts.filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')));
  if (segments.some((segment) => segment.startsWith('_'))) return null;
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

/** Walk page files only, pruning Next private folders and accepting JS/TS page conventions. */
function discoverRoutes(appDir) {
  const routes = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('_')) continue;
        walk(path.join(directory, entry.name));
      } else if (PAGE_FILE.test(entry.name)) {
        const fullPath = path.join(directory, entry.name);
        const relativePath = toPosix(path.relative(path.resolve(appDir, '../../../..'), fullPath));
        const route = routeFromPagePath(path.relative(appDir, fullPath));
        if (route !== null) routes.push({ route, source: relativePath });
      }
    }
  }
  walk(appDir);
  return routes.sort((a, b) => a.route.localeCompare(b.route) || a.source.localeCompare(b.source));
}

/** Dynamic parameter names do not distinguish App Router URL shapes. */
function routeShape(route) {
  return route
    .split('/')
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return '[[...]]';
      if (/^\[\.\.\..+\]$/.test(segment)) return '[...]';
      if (/^\[[^\]]+\]$/.test(segment)) return '[]';
      return segment;
    })
    .join('/');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateStatus(value, label, errors, root, verification, allowNotApplicable = false) {
  const valid = allowNotApplicable ? VALID_STATE_STATUSES : VALID_STATUSES;
  if (!valid.has(value)) {
    const accepted = allowNotApplicable
      ? 'baseline, partial, pending, complete, or not-applicable'
      : 'baseline, partial, pending, or complete';
    errors.push(`${label}: status must be ${accepted} (received ${JSON.stringify(value)})`);
  }
  if (value === 'complete') {
    if (!verification || !/^[0-9a-f]{7,40}$/i.test(verification.revision ?? '')) {
      errors.push(`${label}: complete status requires verification.revision with a commit SHA`);
    }
    validateRefs(root, verification?.evidence, `${label}.verification.evidence`, errors);
  }
}

function validateStates(root, states, label, errors, requiredNames = []) {
  if (!isRecord(states) || Object.keys(states).length === 0) {
    errors.push(`${label}: expected named states with a status, reason, and evidence`);
    return;
  }
  for (const name of requiredNames) {
    if (!Object.hasOwn(states, name))
      errors.push(`${label}.${name}: required state entry is missing`);
  }
  for (const [stateName, state] of Object.entries(states)) {
    const stateLabel = `${label}.${stateName}`;
    if (!isRecord(state)) {
      errors.push(`${stateLabel}: expected an object`);
      continue;
    }
    if (!VALID_STATE_STATUSES.has(state.status)) {
      errors.push(
        `${stateLabel}.status: expected baseline, partial, pending, complete, or not-applicable (received ${JSON.stringify(state.status)})`,
      );
    }
    if (typeof state.reason !== 'string' || state.reason.trim() === '') {
      errors.push(`${stateLabel}.reason: required explanation for this state status`);
    }
    validateRefs(root, state.evidence, `${stateLabel}.evidence`, errors);
    validateStatus(state.status, `${stateLabel}.status`, errors, root, state.verification, true);
  }
}

function validateRefs(root, refs, label, errors) {
  if (!Array.isArray(refs) || refs.length === 0) {
    errors.push(`${label}: must contain at least one path reference`);
    return;
  }
  for (const ref of refs) {
    if (typeof ref !== 'string' || ref.length === 0 || path.isAbsolute(ref)) {
      errors.push(`${label}: invalid repository-relative path ${JSON.stringify(ref)}`);
      continue;
    }
    const resolved = path.resolve(root, ref);
    if (!resolved.startsWith(`${root}${path.sep}`) || !statExists(resolved)) {
      errors.push(`${label}: referenced file does not exist: ${ref}`);
    }
  }
}

function statExists(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/** Validate an already-loaded inventory against the current app tree. */
function validateInventory({ root, appDir, manifest }) {
  const errors = [];
  if (!isRecord(manifest) || manifest.schemaVersion !== 1) {
    return ['manifest: expected an object with schemaVersion 1'];
  }
  if (!Array.isArray(manifest.routes)) return ['manifest.routes: expected an array'];
  if (!Array.isArray(manifest.sharedSurfaces))
    return ['manifest.sharedSurfaces: expected an array'];

  let discovered;
  try {
    discovered = discoverRoutes(appDir);
  } catch (error) {
    return [`route discovery failed: ${error instanceof Error ? error.message : String(error)}`];
  }
  const actualByRoute = new Map();
  for (const route of discovered) {
    const prior = actualByRoute.get(route.route) ?? [];
    prior.push(route.source);
    actualByRoute.set(route.route, prior);
  }
  for (const [route, sources] of actualByRoute) {
    if (sources.length > 1) {
      errors.push(`duplicate source route ${route}: ${sources.join(', ')}`);
    }
  }
  const actualByShape = new Map();
  for (const route of discovered) {
    const shape = routeShape(route.route);
    const prior = actualByShape.get(shape) ?? [];
    prior.push(route.route);
    actualByShape.set(shape, prior);
  }
  for (const [shape, routes] of actualByShape) {
    if (routes.length > 1) {
      errors.push(
        `dynamic route shape collision ${shape}: ${routes.join(', ')} use equivalent URL patterns`,
      );
    }
  }

  const manifestByRoute = new Map();
  const manifestSources = new Map();
  for (const [index, entry] of manifest.routes.entries()) {
    const label = `routes[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${label}: expected an object`);
      continue;
    }
    if (typeof entry.route !== 'string' || !entry.route.startsWith('/')) {
      errors.push(`${label}.route: expected an absolute route pattern`);
    } else if (manifestByRoute.has(entry.route)) {
      errors.push(`${label}.route: duplicate manifest route ${entry.route}`);
    } else {
      manifestByRoute.set(entry.route, entry);
    }
    for (const key of ['family', 'access', 'source']) {
      if (typeof entry[key] !== 'string' || entry[key].length === 0) {
        errors.push(`${label}.${key}: required non-empty string`);
      }
    }
    if (typeof entry.family === 'string' && !VALID_FAMILIES.has(entry.family)) {
      errors.push(`${label}.family: expected a SURFACES.md work family (received ${entry.family})`);
    }
    if (typeof entry.access === 'string' && !VALID_ACCESS.has(entry.access)) {
      errors.push(
        `${label}.access: expected public, public-redirect, staff, or auth-entry (received ${entry.access})`,
      );
    }
    validateStatus(entry.status, `${label}.status`, errors, root, entry.verification);
    if (typeof entry.source === 'string') {
      if (manifestSources.has(entry.source)) {
        errors.push(`${label}.source: mapped more than once: ${entry.source}`);
      }
      manifestSources.set(entry.source, entry.route);
      const file = path.resolve(root, entry.source);
      if (!file.startsWith(`${root}${path.sep}`) || !statExists(file)) {
        errors.push(`${label}.source: route source does not exist: ${entry.source}`);
      }
    }

    const expected =
      typeof entry.source === 'string'
        ? discovered.find((item) => item.source === entry.source)
        : null;
    if (!expected) {
      errors.push(
        `${label}: source is not a discovered Next page module (expected page.tsx/js/ts/jsx): ${entry.source}`,
      );
    } else if (entry.route !== expected.route) {
      errors.push(
        `${label}: route ${entry.route} does not match source route ${expected.route} from ${entry.source}`,
      );
    }

    validateStates(root, entry.states, `${label}.states`, errors, ROUTE_STATES);
    validateRefs(root, entry.componentRefs, `${label}.componentRefs`, errors);
    validateRefs(root, entry.evidence, `${label}.evidence`, errors);
  }

  for (const route of discovered) {
    const entry = manifestByRoute.get(route.route);
    if (!entry) errors.push(`unmapped source route ${route.route}: ${route.source}`);
    else if (entry.source !== route.source) {
      errors.push(
        `source mapping drift for ${route.route}: manifest has ${entry.source}, source tree has ${route.source}`,
      );
    }
  }
  for (const route of manifestByRoute.keys()) {
    if (!actualByRoute.has(route)) errors.push(`removed or stale manifest route: ${route}`);
  }

  const surfaceIds = new Set();
  for (const [index, surface] of manifest.sharedSurfaces.entries()) {
    const label = `sharedSurfaces[${index}]`;
    if (!isRecord(surface)) {
      errors.push(`${label}: expected an object`);
      continue;
    }
    if (typeof surface.id !== 'string' || surface.id.length === 0)
      errors.push(`${label}.id: required non-empty string`);
    else if (surfaceIds.has(surface.id))
      errors.push(`${label}.id: duplicate shared surface ${surface.id}`);
    else surfaceIds.add(surface.id);
    if (typeof surface.name !== 'string' || !surface.name)
      errors.push(`${label}.name: required non-empty string`);
    validateStatus(surface.status, `${label}.status`, errors, root, surface.verification);
    validateStates(root, surface.states, `${label}.states`, errors);
    validateRefs(root, surface.componentRefs, `${label}.componentRefs`, errors);
    validateRefs(root, surface.evidence, `${label}.evidence`, errors);
  }
  return errors;
}

function main() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    console.error(
      `check-surface-inventory: cannot read ${path.relative(ROOT, MANIFEST_PATH)}: ${error.message}`,
    );
    process.exit(1);
  }
  const errors = validateInventory({ root: ROOT, appDir: APP_DIR, manifest });
  if (errors.length) {
    console.error('check-surface-inventory failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(
    `check-surface-inventory: ok (${manifest.routes.length} routes, ${manifest.sharedSurfaces.length} shared surfaces; coverage status is planning evidence, not visual verification)`,
  );
}

export { discoverRoutes, routeFromPagePath, validateInventory };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
