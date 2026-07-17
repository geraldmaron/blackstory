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

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const CONSTITUTION_DIR = join(PACKAGE_ROOT, 'constitution');
export const POLICY_V1_PATH = join(CONSTITUTION_DIR, 'policy.v1.json');
export const CONSTITUTION_SCHEMA_PATH = join(CONSTITUTION_DIR, 'product-constitution.schema.json');
export const FIXTURES_DIR = join(CONSTITUTION_DIR, 'fixtures');

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
  const parsed = productConstitutionSchema.parse(readJsonFile(POLICY_V1_PATH));
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
  return constitutionFixtureSchema.parse(readJsonFile(join(FIXTURES_DIR, fileName)));
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
