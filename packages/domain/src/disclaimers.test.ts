/**
 * Tests for the versioned disclaimer registry and sensitivity presentation labels,
 * including:
 * - Every disclaimer carries a review date, and disclaimer copy renders only through shared
 * components (a repo check finds no ad-hoc disclaimer strings in app code).
 * - Copy passes the constitution's procedural language caps.
 * - Presentation-layer half of "identity attributes are never a valid rationale on their
 * own" — this file only proves THIS module's own copy stays conduct-based; the data-entry
 * gate is a separate system.
 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { evaluateProceduralLanguage, loadProductConstitution } from '@blap/schemas';
import { SENSITIVITY_CLASSES } from './entity-status.js';
import {
  assertNoIdentityAttributeFraming,
  assertDisclaimerRegistryComplete,
  DISCLAIMER_CLASSES,
  DISCLAIMER_REGISTRY,
  getDisclaimer,
  IDENTITY_ATTRIBUTE_TERMS,
  SENSITIVITY_CLASS_PRESENTATION_LABELS,
} from './disclaimers.js';

const DOMAIN_ROOT = dirname(fileURLToPath(import.meta.url));
const WEB_APP_SRC = join(DOMAIN_ROOT, '..', '..', '..', 'apps', 'web', 'src');
const POLICY = loadProductConstitution();

// ---------------------------------------------------------------------------
// Registry completeness and shape
// ---------------------------------------------------------------------------

test('disclaimer classes match the BB-095 AC3 spec exactly', () => {
  assert.deepEqual(DISCLAIMER_CLASSES, [
    'site_wide',
    'visiting_historic_sites',
    'private_property',
    'sensitive_content',
    'non_endorsement',
    'safety_advisory',
  ]);
});

test('every disclaimer carries a non-blank body and a review date', () => {
  assert.doesNotThrow(() => assertDisclaimerRegistryComplete());
  for (const disclaimerClass of DISCLAIMER_CLASSES) {
    const record = getDisclaimer(disclaimerClass);
    assert.equal(record.class, disclaimerClass);
    assert.ok(record.body.length > 20);
    assert.match(record.reviewDate, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('site-wide disclaimer explicitly disclaims legal and travel advice', () => {
  const body = getDisclaimer('site_wide').body.toLowerCase();
  assert.match(body, /not legal advice/);
  assert.match(body, /not travel advice/);
  assert.match(body, /educational/);
});

test('non-endorsement disclaimer never brands inclusion as endorsement', () => {
  const body = getDisclaimer('non_endorsement').body.toLowerCase();
  assert.match(body, /never an endorsement/);
});

test('safety-advisory disclaimer never claims a real-time safety assessment', () => {
  const body = getDisclaimer('safety_advisory').body.toLowerCase();
  assert.match(body, /not a real-time safety assessment/);
  assert.equal(body.includes('dangerous'), false);
});

// ---------------------------------------------------------------------------
// copy passes the constitution's procedural language caps
// ---------------------------------------------------------------------------

test('every disclaimer body is free of unsupported procedural language (constitution caps)', () => {
  for (const disclaimerClass of DISCLAIMER_CLASSES) {
    const body = getDisclaimer(disclaimerClass).body;
    const evaluation = evaluateProceduralLanguage(body, 'unknown_procedural', POLICY);
    assert.deepEqual(evaluation.violations, []);
  }
});

test('sensitivity class presentation labels are free of unsupported procedural language', () => {
  for (const sensitivityClass of SENSITIVITY_CLASSES) {
    const label = SENSITIVITY_CLASS_PRESENTATION_LABELS[sensitivityClass];
    const evaluation = evaluateProceduralLanguage(label, 'unknown_procedural', POLICY);
    assert.deepEqual(evaluation.violations, []);
  }
});

// ---------------------------------------------------------------------------
// conduct-based framing only, never identity attributes
// ---------------------------------------------------------------------------

test('sensitivity presentation labels cover every SensitivityClass and stay conduct-based', () => {
  assert.deepEqual(
    Object.keys(SENSITIVITY_CLASS_PRESENTATION_LABELS).sort(),
    [...SENSITIVITY_CLASSES].sort(),
  );
  for (const label of Object.values(SENSITIVITY_CLASS_PRESENTATION_LABELS)) {
    assert.doesNotThrow(() => assertNoIdentityAttributeFraming(label));
  }
});

test('non-endorsement and sensitive-content disclaimer copy never references identity attributes', () => {
  assert.doesNotThrow(() => assertNoIdentityAttributeFraming(getDisclaimer('non_endorsement').body));
  assert.doesNotThrow(() => assertNoIdentityAttributeFraming(getDisclaimer('sensitive_content').body));
});

test('assertNoIdentityAttributeFraming actually catches identity-attribute language', () => {
  for (const term of IDENTITY_ATTRIBUTE_TERMS) {
    assert.throws(() => assertNoIdentityAttributeFraming(`Flagged because the subject was ${term}.`));
  }
});

// ---------------------------------------------------------------------------
// "renders only through shared components a repo check finds no ad-hoc disclaimer
// strings in app code"
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'coverage']);

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
    } else if (SOURCE_EXTENSIONS.has(fullPath.slice(fullPath.lastIndexOf('.')))) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Signature phrases lifted verbatim from the registry bodies above. If any of these literal
 * sentences shows up hand-typed in apps/web source, it means a surface duplicated disclaimer
 * copy instead of rendering it from `DISCLAIMER_REGISTRY` `getDisclaimer` exactly the
 * "ad-hoc disclaimer strings scattered through the codebase" prohibits. Test source files are
 * exempt (a test asserting rendered disclaimer text legitimately contains these phrases via the
 * registry constant, not as hand-authored copy).
 */
const DISCLAIMER_SIGNAL_PHRASES = [
  'not legal advice, not travel advice',
  'does not grant, imply, or facilitate access',
  "inclusion in this index is never an endorsement",
  'not a real-time safety assessment',
  'confirm current access and any visiting requirements',
] as const;

test('repo check: no ad-hoc disclaimer strings duplicated in apps/web app code', async () => {
  const files = await collectSourceFiles(WEB_APP_SRC);
  const offenders: string[] = [];

  for (const file of files) {
    if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
    const contents = await readFile(file, 'utf8');
    const lower = contents.toLowerCase();
    for (const phrase of DISCLAIMER_SIGNAL_PHRASES) {
      if (lower.includes(phrase.toLowerCase())) {
        offenders.push(`${relative(WEB_APP_SRC, file)}: "${phrase}"`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'apps/web source files must render disclaimer copy from DISCLAIMER_REGISTRY, never duplicate it inline',
  );
});

test('DISCLAIMER_REGISTRY itself is the single source for these phrases (sanity check)', () => {
  const serializedRegistry = JSON.stringify(DISCLAIMER_REGISTRY).toLowerCase();
  for (const phrase of DISCLAIMER_SIGNAL_PHRASES) {
    assert.ok(
      serializedRegistry.includes(phrase.toLowerCase()),
      `expected the registry to contain the phrase "${phrase}" — update this fixture if registry copy changes`,
    );
  }
});
