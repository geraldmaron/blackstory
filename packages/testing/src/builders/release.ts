/**
 * Test data builder for publication release fixtures.
 */
import { createIdFactory, type IdFactory } from '../ids.js';
import type { PublicationReleaseFixture, ReleaseStatus } from './types.js';

export type ReleaseBuilderOptions = {
  ids?: IdFactory;
  snapshotIds?: IdFactory;
  clock?: () => Date;
};

export class PublicationReleaseBuilder {
  private readonly ids: IdFactory;
  private readonly snapshotIds: IdFactory;
  private readonly clock: () => Date;
  private version = '2026.01.01';
  private status: ReleaseStatus = 'draft';
  private notes = '';
  private idOverride: string | undefined;
  private snapshotOverride: string | undefined;

  constructor(options: ReleaseBuilderOptions = {}) {
    this.ids = options.ids ?? createIdFactory('rel');
    this.snapshotIds = options.snapshotIds ?? createIdFactory('snp');
    this.clock = options.clock ?? (() => new Date('2026-01-01T00:00:00.000Z'));
  }

  withId(id: string): this {
    this.idOverride = id;
    return this;
  }

  withVersion(version: string): this {
    this.version = version;
    return this;
  }

  withStatus(status: ReleaseStatus): this {
    this.status = status;
    return this;
  }

  withSnapshotId(snapshotId: string): this {
    this.snapshotOverride = snapshotId;
    return this;
  }

  withNotes(notes: string): this {
    this.notes = notes;
    return this;
  }

  build(): PublicationReleaseFixture {
    const released = this.status === 'released' || this.status === 'retracted';
    return {
      id: this.idOverride ?? this.ids.next(),
      version: this.version,
      status: this.status,
      snapshotId: this.snapshotOverride ?? this.snapshotIds.next(),
      releasedAt: released ? this.clock().toISOString() : null,
      notes: this.notes,
    };
  }
}

export function buildPublicationRelease(
  overrides: Partial<PublicationReleaseFixture> = {},
): PublicationReleaseFixture {
  const builder = new PublicationReleaseBuilder();
  if (overrides.id) builder.withId(overrides.id);
  if (overrides.version) builder.withVersion(overrides.version);
  if (overrides.status) builder.withStatus(overrides.status);
  if (overrides.snapshotId) builder.withSnapshotId(overrides.snapshotId);
  if (overrides.notes) builder.withNotes(overrides.notes);
  const built = builder.build();
  return {
    ...built,
    ...overrides,
    releasedAt:
      overrides.releasedAt !== undefined
        ? overrides.releasedAt
        : overrides.status === 'released' || overrides.status === 'retracted'
          ? built.releasedAt
          : built.releasedAt,
  };
}
