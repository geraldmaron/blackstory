
/**
 * Test data builder for claim fixtures tied to entities.
 */
import { createIdFactory, type IdFactory } from '../ids.js';
import type { ClaimFixture, ClaimStatus } from './types.js';

export type ClaimBuilderOptions = {
  ids?: IdFactory;
  clock?: () => Date;
};

export class ClaimBuilder {
  private readonly ids: IdFactory;
  private readonly clock: () => Date;
  private entityId = 'ent_0001';
  private predicate = 'located_at';
  private object = 'Sample Place';
  private status: ClaimStatus = 'proposed';
  private confidence = 0.5;
  private idOverride: string | undefined;

  constructor(options: ClaimBuilderOptions = {}) {
    this.ids = options.ids ?? createIdFactory('clm');
    this.clock = options.clock ?? (() => new Date('2026-01-01T00:00:00.000Z'));
  }

  withId(id: string): this {
    this.idOverride = id;
    return this;
  }

  withEntityId(entityId: string): this {
    this.entityId = entityId;
    return this;
  }

  withPredicate(predicate: string): this {
    this.predicate = predicate;
    return this;
  }

  withObject(object: string): this {
    this.object = object;
    return this;
  }

  withStatus(status: ClaimStatus): this {
    this.status = status;
    return this;
  }

  withConfidence(confidence: number): this {
    if (confidence < 0 || confidence > 1) {
      throw new RangeError('claim confidence must be between 0 and 1');
    }
    this.confidence = confidence;
    return this;
  }

  build(): ClaimFixture {
    return {
      id: this.idOverride ?? this.ids.next(),
      entityId: this.entityId,
      predicate: this.predicate,
      object: this.object,
      status: this.status,
      confidence: this.confidence,
      createdAt: this.clock().toISOString(),
    };
  }
}

export function buildClaim(overrides: Partial<ClaimFixture> = {}): ClaimFixture {
  const builder = new ClaimBuilder();
  if (overrides.id) builder.withId(overrides.id);
  if (overrides.entityId) builder.withEntityId(overrides.entityId);
  if (overrides.predicate) builder.withPredicate(overrides.predicate);
  if (overrides.object) builder.withObject(overrides.object);
  if (overrides.status) builder.withStatus(overrides.status);
  if (overrides.confidence !== undefined) builder.withConfidence(overrides.confidence);
  return { ...builder.build(), ...overrides };
}
