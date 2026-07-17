/**
 * Test data builder for provenance source fixtures.
 */
import { createIdFactory, type IdFactory } from '../ids.js';
import type { SourceFixture } from './types.js';

export type SourceBuilderOptions = {
  ids?: IdFactory;
  clock?: () => Date;
};

export class SourceBuilder {
  private readonly ids: IdFactory;
  private readonly clock: () => Date;
  private title = 'Sample Source';
  private url = 'https://example.test/sources/sample';
  private authority: SourceFixture['authority'] = 'secondary';
  private rights: SourceFixture['rights'] = 'unknown';
  private idOverride: string | undefined;

  constructor(options: SourceBuilderOptions = {}) {
    this.ids = options.ids ?? createIdFactory('src');
    this.clock = options.clock ?? (() => new Date('2026-01-01T00:00:00.000Z'));
  }

  withId(id: string): this {
    this.idOverride = id;
    return this;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  withUrl(url: string): this {
    this.url = url;
    return this;
  }

  withAuthority(authority: SourceFixture['authority']): this {
    this.authority = authority;
    return this;
  }

  withRights(rights: SourceFixture['rights']): this {
    this.rights = rights;
    return this;
  }

  build(): SourceFixture {
    return {
      id: this.idOverride ?? this.ids.next(),
      title: this.title,
      url: this.url,
      authority: this.authority,
      rights: this.rights,
      capturedAt: this.clock().toISOString(),
    };
  }
}

export function buildSource(overrides: Partial<SourceFixture> = {}): SourceFixture {
  const builder = new SourceBuilder();
  if (overrides.id) builder.withId(overrides.id);
  if (overrides.title) builder.withTitle(overrides.title);
  if (overrides.url) builder.withUrl(overrides.url);
  if (overrides.authority) builder.withAuthority(overrides.authority);
  if (overrides.rights) builder.withRights(overrides.rights);
  return { ...builder.build(), ...overrides };
}
