/**
 * Read-only loaders for the shared product constitution JSON and fixtures.
 * Policy values live only under packages/schemas/constitution/; this module
 * never exposes mutation or write APIs for public endpoints.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  constitutionFixtureSchema,
  productConstitutionSchema,
  type ConstitutionFixture,
  type ProductConstitution,
} from './schema.js';

/** Prefer DISCOVERY_REPO_ROOT (Cloud Functions upload root) when the bundle inlines this module. */
function resolveSchemasPackageRoot(): string {
  const deployRoot = process.env.DISCOVERY_REPO_ROOT?.trim();
  if (deployRoot !== undefined && deployRoot.length > 0) {
    return join(deployRoot, 'packages', 'schemas');
  }
  return join(dirname(fileURLToPath(import.meta.url)), '../..');
}

function constitutionDir(): string {
  return join(resolveSchemasPackageRoot(), 'constitution');
}

export const CONSTITUTION_DIR = constitutionDir();
export const POLICY_V1_PATH = join(constitutionDir(), 'policy.v1.json');
export const CONSTITUTION_SCHEMA_PATH = join(constitutionDir(), 'product-constitution.schema.json');
export const FIXTURES_DIR = join(constitutionDir(), 'fixtures');

const FIXTURE_FILES = {
  included: 'included.json',
  excluded: 'excluded.json',
  disputed: 'disputed.json',
  sparse: 'sparse.json',
  sensitive: 'sensitive.json',
  living_person: 'living-person.json',
} as const;

export type FixtureKind = keyof typeof FIXTURE_FILES;

let cachedPolicy: ProductConstitution | undefined;

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** Load and validate the active product constitution (cached, read-only).  */
export function loadProductConstitution(): ProductConstitution {
  if (cachedPolicy) {
    return cachedPolicy;
  }
  const policyPath = join(constitutionDir(), 'policy.v1.json');
  const parsed = productConstitutionSchema.parse(readJsonFile(policyPath));
  cachedPolicy = Object.freeze(structuredClone(parsed)) as ProductConstitution;
  return cachedPolicy;
}

/** Return the policy version string from the loaded constitution.  */
export function getPolicyVersion(policy: ProductConstitution = loadProductConstitution()): string {
  return policy.policyVersion;
}

/** Load a named constitution fixture used by evaluation tests.  */
export function loadConstitutionFixture(kind: FixtureKind): ConstitutionFixture {
  const fileName = FIXTURE_FILES[kind];
  return constitutionFixtureSchema.parse(
    readJsonFile(join(constitutionDir(), 'fixtures', fileName)),
  );
}

/** Load all constitution fixtures (included, excluded, disputed, sparse, sensitive, living-person).  */
export function loadAllConstitutionFixtures(): Record<FixtureKind, ConstitutionFixture> {
  return {
    included: loadConstitutionFixture('included'),
    excluded: loadConstitutionFixture('excluded'),
    disputed: loadConstitutionFixture('disputed'),
    sparse: loadConstitutionFixture('sparse'),
    sensitive: loadConstitutionFixture('sensitive'),
    living_person: loadConstitutionFixture('living_person'),
  };
}

/** Test helper: clear the in-memory policy cache.  */
export function resetProductConstitutionCache(): void {
  cachedPolicy = undefined;
}
