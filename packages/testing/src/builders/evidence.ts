/**
 * Test data builder for evidence fixtures linking claims to sources.
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
  private excerpt = 'Supporting excerpt for the claim.';
  private confidence = 0.5;
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

  withExcerpt(excerpt: string): this {
    this.excerpt = excerpt;
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
      excerpt: this.excerpt,
      confidence: this.confidence,
      capturedAt: this.clock().toISOString(),
    };
  }
}

export function buildEvidence(overrides: Partial<EvidenceFixture> = {}): EvidenceFixture {
  const builder = new EvidenceBuilder();
  if (overrides.id) builder.withId(overrides.id);
  if (overrides.claimId) builder.withClaimId(overrides.claimId);
  if (overrides.sourceId) builder.withSourceId(overrides.sourceId);
  if (overrides.excerpt) builder.withExcerpt(overrides.excerpt);
  if (overrides.confidence !== undefined) builder.withConfidence(overrides.confidence);
  return { ...builder.build(), ...overrides };
}
