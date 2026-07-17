/**
 * Test data builder for evidence fixtures linking claims to sources (BB-016-aware).
 */
import { createIdFactory, type IdFactory } from '../ids.js';
import type { EvidenceFixture } from './types.js';

export type EvidenceBuilderOptions = {
  ids?: IdFactory;
  clock?: () => Date;
};

export class EvidenceBuilder {
  private readonly ids: IdFactory;
  private readonly clock: () => Date;
  private claimId = 'clm_0001';
  private sourceId = 'src_0001';
  private sourceItemId = 'sitm_0001';
  private excerpt = 'Supporting excerpt for the claim.';
  private excerptKind: NonNullable<EvidenceFixture['excerptKind']> = 'short';
  private rightsStatus: NonNullable<EvidenceFixture['rightsStatus']> = 'unknown';
  private confidence = 0.5;
  private page: string | undefined;
  private observedAt: string | undefined;
  private idOverride: string | undefined;

  constructor(options: EvidenceBuilderOptions = {}) {
    this.ids = options.ids ?? createIdFactory('evd');
    this.clock = options.clock ?? (() => new Date('2026-01-01T00:00:00.000Z'));
  }

  withId(id: string): this {
    this.idOverride = id;
    return this;
  }

  withClaimId(claimId: string): this {
    this.claimId = claimId;
    return this;
  }

  withSourceId(sourceId: string): this {
    this.sourceId = sourceId;
    return this;
  }

  withSourceItemId(sourceItemId: string): this {
    this.sourceItemId = sourceItemId;
    return this;
  }

  withExcerpt(excerpt: string): this {
    this.excerpt = excerpt;
    return this;
  }

  withExcerptKind(excerptKind: NonNullable<EvidenceFixture['excerptKind']>): this {
    this.excerptKind = excerptKind;
    return this;
  }

  withRightsStatus(rightsStatus: NonNullable<EvidenceFixture['rightsStatus']>): this {
    this.rightsStatus = rightsStatus;
    return this;
  }

  withPage(page: string): this {
    this.page = page;
    return this;
  }

  withObservedAt(observedAt: string): this {
    this.observedAt = observedAt;
    return this;
  }

  withConfidence(confidence: number): this {
    if (confidence < 0 || confidence > 1) {
      throw new RangeError('evidence confidence must be between 0 and 1');
    }
    this.confidence = confidence;
    return this;
  }

  build(): EvidenceFixture {
    return {
      id: this.idOverride ?? this.ids.next(),
      claimId: this.claimId,
      sourceId: this.sourceId,
      sourceItemId: this.sourceItemId,
      excerpt: this.excerpt,
      excerptKind: this.excerptKind,
      rightsStatus: this.rightsStatus,
      confidence: this.confidence,
      capturedAt: this.clock().toISOString(),
      page: this.page,
      observedAt: this.observedAt,
    };
  }
}

export function buildEvidence(overrides: Partial<EvidenceFixture> = {}): EvidenceFixture {
  const builder = new EvidenceBuilder();
  if (overrides.id) builder.withId(overrides.id);
  if (overrides.claimId) builder.withClaimId(overrides.claimId);
  if (overrides.sourceId) builder.withSourceId(overrides.sourceId);
  if (overrides.sourceItemId) builder.withSourceItemId(overrides.sourceItemId);
  if (overrides.excerpt) builder.withExcerpt(overrides.excerpt);
  if (overrides.excerptKind) builder.withExcerptKind(overrides.excerptKind);
  if (overrides.rightsStatus) builder.withRightsStatus(overrides.rightsStatus);
  if (overrides.page) builder.withPage(overrides.page);
  if (overrides.observedAt) builder.withObservedAt(overrides.observedAt);
  if (overrides.confidence !== undefined) builder.withConfidence(overrides.confidence);
  return { ...builder.build(), ...overrides };
}
