/**
 * Test data builder for quarantined submission fixtures.
 */
import { createIdFactory, type IdFactory } from '../ids.js';
import type { SubmissionFixture, SubmissionKind, SubmissionStatus } from './types.js';

export type SubmissionBuilderOptions = {
  ids?: IdFactory;
  clock?: () => Date;
};

export class SubmissionBuilder {
  private readonly ids: IdFactory;
  private readonly clock: () => Date;
  private kind: SubmissionKind = 'correction';
  private status: SubmissionStatus = 'quarantined';
  private entityId: string | null = null;
  private summary = 'Sample submission';
  private payload: Readonly<Record<string, unknown>> = {};
  private idOverride: string | undefined;

  constructor(options: SubmissionBuilderOptions = {}) {
    this.ids = options.ids ?? createIdFactory('sub');
    this.clock = options.clock ?? (() => new Date('2026-01-01T00:00:00.000Z'));
  }

  withId(id: string): this {
    this.idOverride = id;
    return this;
  }

  withKind(kind: SubmissionKind): this {
    this.kind = kind;
    return this;
  }

  withStatus(status: SubmissionStatus): this {
    this.status = status;
    return this;
  }

  withEntityId(entityId: string | null): this {
    this.entityId = entityId;
    return this;
  }

  withSummary(summary: string): this {
    this.summary = summary;
    return this;
  }

  withPayload(payload: Readonly<Record<string, unknown>>): this {
    this.payload = payload;
    return this;
  }

  build(): SubmissionFixture {
    return {
      id: this.idOverride ?? this.ids.next(),
      kind: this.kind,
      status: this.status,
      entityId: this.entityId,
      summary: this.summary,
      payload: this.payload,
      submittedAt: this.clock().toISOString(),
    };
  }
}

export function buildSubmission(overrides: Partial<SubmissionFixture> = {}): SubmissionFixture {
  const builder = new SubmissionBuilder();
  if (overrides.id) builder.withId(overrides.id);
  if (overrides.kind) builder.withKind(overrides.kind);
  if (overrides.status) builder.withStatus(overrides.status);
  if (overrides.entityId !== undefined) builder.withEntityId(overrides.entityId);
  if (overrides.summary) builder.withSummary(overrides.summary);
  if (overrides.payload) builder.withPayload(overrides.payload);
  return { ...builder.build(), ...overrides };
}
