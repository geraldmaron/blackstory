/**
 * Test data builder for historical entity fixtures.
 */
import { createIdFactory, type IdFactory } from '../ids.js';
import type { EntityFixture, EntityKind, LivingStatus } from './types.js';

export type EntityBuilderOptions = {
  ids?: IdFactory;
  clock?: () => Date;
};

export class EntityBuilder {
  private readonly ids: IdFactory;
  private readonly clock: () => Date;
  private kind: EntityKind = 'place';
  private name = 'Sample Place';
  private livingStatus: LivingStatus | undefined;
  private idOverride: string | undefined;

  constructor(options: EntityBuilderOptions = {}) {
    this.ids = options.ids ?? createIdFactory('ent');
    this.clock = options.clock ?? (() => new Date('2026-01-01T00:00:00.000Z'));
  }

  withId(id: string): this {
    this.idOverride = id;
    return this;
  }

  withKind(kind: EntityKind): this {
    this.kind = kind;
    return this;
  }

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withLivingStatus(status: LivingStatus): this {
    this.livingStatus = status;
    return this;
  }

  build(): EntityFixture {
    const fixture: EntityFixture = {
      id: this.idOverride ?? this.ids.next(),
      kind: this.kind,
      name: this.name,
      createdAt: this.clock().toISOString(),
    };
    if (this.livingStatus !== undefined) {
      fixture.livingStatus = this.livingStatus;
    }
    return fixture;
  }
}

export function buildEntity(overrides: Partial<EntityFixture> = {}): EntityFixture {
  const builder = new EntityBuilder();
  if (overrides.id) builder.withId(overrides.id);
  if (overrides.kind) builder.withKind(overrides.kind);
  if (overrides.name) builder.withName(overrides.name);
  if (overrides.livingStatus) builder.withLivingStatus(overrides.livingStatus);
  return { ...builder.build(), ...overrides };
}
