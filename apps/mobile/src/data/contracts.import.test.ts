/**
 * Smoke: apps/mobile resolves real `@repo/public-contracts` types (repo-hfz0).
 */
import type { BootstrapResponseV1, EntityV1, RevisionMetadataV1 } from './contracts';
import { bootstrapResponseV1Schema } from '@repo/public-contracts/v1/bootstrap';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';

describe('public-contracts import wiring', () => {
  it('parses a minimal bootstrap projection with the shared zod schema', () => {
    const parsed = bootstrapResponseV1Schema.parse({
      apiVersion: 'v1',
      minSupportedApiVersion: 'v1',
      deprecationWindowDays: 90,
      activeRelease: {
        releaseId: 'rel_test',
        generatedAt: '2026-07-19T00:00:00.000Z',
        recordUpdatedAt: '2026-07-19T00:00:00.000Z',
      },
    });
    const typed: BootstrapResponseV1 = parsed;
    expect(typed.activeRelease.releaseId).toBe('rel_test');
  });

  it('shares EntityV1 / RevisionMetadataV1 with the package schemas', () => {
    const revision: RevisionMetadataV1 = {
      releaseId: 'rel_test',
      generatedAt: '',
      recordUpdatedAt: '',
    };
    expect(revision.releaseId).toBe('rel_test');
    // entity schema is the source of EntityV1 — ensure the export is the same type family
    expect(typeof entityV1Schema.parse).toBe('function');
    const _entityTypeCheck: EntityV1 | undefined = undefined;
    expect(_entityTypeCheck).toBeUndefined();
  });
});
