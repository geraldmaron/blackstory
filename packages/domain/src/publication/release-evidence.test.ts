/**
 * MOB-005 close evidence: deterministic two-release activation/rollback/size report.
 *
 * Validates committed fixtures under `fixtures/release-evidence/` match live generation.
 * Regenerate with: UPDATE_RELEASE_EVIDENCE=1 pnpm --filter @repo/domain test release-evidence
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { redactLocationForPublic } from '@repo/security';
import {
  ReleaseActivationError,
  activateRelease,
  collectGarbage,
  createInMemoryReleaseStore,
  generateReleaseArtifacts,
  rollbackTo,
  type GenerateReleaseArtifactsInput,
} from './release-activation.js';
import { bootstrapManifestToJson } from './mobile-bootstrap.js';
import {
  DECEASED_RESIDENCE_FIXTURE,
  INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE,
  PLACE_HARLEM_NY_FIXTURE,
} from '../map/fixtures.js';

const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/release-evidence',
);
const UPDATE = process.env.UPDATE_RELEASE_EVIDENCE === '1';

const BOOTSTRAP = {
  schemaRange: { min: 1, max: 1 },
  compatibility: {
    apiVersion: 'v1',
    minSupportedApiVersion: 'v1',
    deprecationWindowDays: 90,
    minSupportedAppBuild: 1000,
  },
  featureFlags: { search: true, map: true },
  legalVersions: { privacyPolicy: '2026-07-01', termsOfService: '2026-07-01' },
  cacheDirectives: {
    bootstrapMaxAgeSeconds: 60,
    bootstrapStaleWhileRevalidateSeconds: 600,
    releaseArtifactImmutableMaxAgeSeconds: 31_536_000,
  },
} as const;

function input(releaseId: string): GenerateReleaseArtifactsInput {
  return {
    releaseId,
    generatedAt: '2026-07-21T12:00:00.000Z',
    mapEntities: [PLACE_HARLEM_NY_FIXTURE, INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE, DECEASED_RESIDENCE_FIXTURE],
    redactLocation: redactLocationForPublic,
    contentIndex: [{ id: 'story-1', kind: 'story', title: 'A Story', version: 'v1' }],
    entitiesList: { schemaVersion: 1, entities: [{ id: 'ent_a', displayName: 'A' }] },
    searchIndex: { schemaVersion: 1, docs: [{ id: 'ent_a', nameLower: 'a' }] },
    bootstrap: BOOTSTRAP,
  };
}

function writeJson(relativePath: string, value: unknown): void {
  const fullPath = path.join(FIXTURE_ROOT, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(FIXTURE_ROOT, relativePath), 'utf8')) as T;
}

function buildEvidencePack() {
  const relA = generateReleaseArtifacts(input('rel_mob005_a'));
  const relB = generateReleaseArtifacts(input('rel_mob005_b'));
  const store = createInMemoryReleaseStore();

  const activationLog: Record<string, unknown>[] = [];
  activationLog.push({
    step: 'activate_a',
    result: activateRelease(store, relA),
  });
  activationLog.push({
    step: 'activate_b',
    result: activateRelease(store, relB),
  });
  activationLog.push({
    step: 'rollback_a',
    result: rollbackTo(store, 'rel_mob005_a'),
  });

  const failureInjection: Record<string, unknown>[] = [];
  const tampered = {
    ...relB,
    artifacts: relB.artifacts.map((artifact, index) =>
      index === 0 ? { ...artifact, json: { tampered: true } } : artifact,
    ),
  };
  try {
    activateRelease(store, tampered);
    failureInjection.push({ case: 'corrupted_artifact', outcome: 'unexpected_success' });
  } catch (error) {
    failureInjection.push({
      case: 'corrupted_artifact',
      outcome: 'rejected',
      code: error instanceof ReleaseActivationError ? error.code : 'unknown',
      activeReleaseId: store.getPointer()?.activeReleaseId,
    });
  }

  activateRelease(store, generateReleaseArtifacts(input('rel_mob005_c')));
  const gc = collectGarbage(store);
  failureInjection.push({ case: 'gc_one_deep', gc });

  return {
    manifests: {
      rel_mob005_a: bootstrapManifestToJson(relA.manifest),
      rel_mob005_b: bootstrapManifestToJson(relB.manifest),
    },
    sizeReport: {
      rel_mob005_a: relA.sizeReport,
      rel_mob005_b: relB.sizeReport,
    },
    activationLog,
    failureInjection,
  };
}

function stripGzipSizes(
  report: Readonly<Record<string, readonly { readonly kind: string; readonly byteLength: number; readonly gzipByteLength: number }[]>>,
): Record<string, readonly { readonly kind: string; readonly byteLength: number }[]> {
  const out: Record<string, { readonly kind: string; readonly byteLength: number }[]> = {};
  for (const [releaseId, rows] of Object.entries(report)) {
    out[releaseId] = rows.map(({ kind, byteLength }) => ({ kind, byteLength }));
  }
  return out;
}

test('MOB-005 evidence pack is deterministic and matches committed fixtures', () => {
  const pack = buildEvidencePack();

  if (UPDATE) {
    writeJson('manifests/rel_mob005_a.json', pack.manifests.rel_mob005_a);
    writeJson('manifests/rel_mob005_b.json', pack.manifests.rel_mob005_b);
    writeJson('size-report.json', pack.sizeReport);
    writeJson('activation-log.json', pack.activationLog);
    writeJson('failure-injection.json', pack.failureInjection);
  }

  assert.deepEqual(pack.manifests.rel_mob005_a, readJson('manifests/rel_mob005_a.json'));
  assert.deepEqual(pack.manifests.rel_mob005_b, readJson('manifests/rel_mob005_b.json'));
  // gzipByteLength varies across zlib/Node builds; assert stable uncompressed sizes only.
  assert.deepEqual(
    stripGzipSizes(pack.sizeReport),
    stripGzipSizes(readJson('size-report.json')),
  );
  for (const rows of Object.values(pack.sizeReport)) {
    for (const row of rows) {
      assert.ok(row.gzipByteLength > 0);
      assert.ok(row.gzipByteLength <= row.byteLength + 64);
    }
  }
  assert.deepEqual(pack.activationLog, readJson('activation-log.json'));
  assert.deepEqual(pack.failureInjection, readJson('failure-injection.json'));

  assert.ok(pack.manifests.rel_mob005_a.releaseStamp.startsWith('rel_mob005_a@'));
  assert.ok(pack.sizeReport.rel_mob005_a.length >= 8);
});
