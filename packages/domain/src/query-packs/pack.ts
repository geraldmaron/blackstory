/**
 * Query pack construction, canonical hashing, and version identity (BB-038).
 */
import { hashUtf8 } from '../provenance/hashes.js';
import { assertQueryTermsValid } from './terms.js';
import type {
  QueryPack,
  QueryPackFixture,
  QueryPackVersion,
  QueryPackVersionId,
  QueryTerm,
} from './types.js';
import { QUERY_PACK_SCHEMA_VERSION } from './types.js';
import type { EntityKind } from '../entity-kinds.js';
import type { QueryPackTheme } from './types.js';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function assertSemverValid(semver: string): void {
  if (!SEMVER_PATTERN.test(semver.trim())) {
    throw new Error(`Invalid semver for query pack: ${semver}`);
  }
}

type CanonicalPackContent = {
  readonly id: string;
  readonly displayName: string;
  readonly entityKind: EntityKind;
  readonly theme: QueryPackTheme;
  readonly semver: string;
  readonly terms: readonly QueryTerm[];
  readonly notes?: string;
};

function canonicalizeTerms(terms: readonly QueryTerm[]): readonly QueryTerm[] {
  return [...terms]
    .map((term) => ({
      text: term.text.trim(),
      termClass: term.termClass,
      ...(term.researchOnlyOffensive ? { researchOnlyOffensive: true } : {}),
      ...(term.sourceId ? { sourceId: term.sourceId.trim() } : {}),
      ...(term.weight !== undefined ? { weight: term.weight } : {}),
    }))
    .sort((left, right) => {
      const byClass = left.termClass.localeCompare(right.termClass);
      if (byClass !== 0) {
        return byClass;
      }
      return left.text.localeCompare(right.text);
    });
}

function canonicalizePackContent(input: CanonicalPackContent): string {
  const payload = {
    id: input.id,
    displayName: input.displayName.trim(),
    entityKind: input.entityKind,
    theme: input.theme,
    semver: input.semver.trim(),
    terms: canonicalizeTerms(input.terms),
    ...(input.notes ? { notes: input.notes.trim() } : {}),
  };
  return JSON.stringify(payload);
}

export function computeQueryPackContentHash(input: CanonicalPackContent): string {
  return hashUtf8(canonicalizePackContent(input)).digest;
}

export function buildQueryPackVersionId(semver: string, contentHash: string): QueryPackVersionId {
  const shortHash = contentHash.slice(0, 8);
  return `${semver}+${shortHash}` as QueryPackVersionId;
}

export function buildQueryPackVersion(semver: string, contentHash: string): QueryPackVersion {
  assertSemverValid(semver);
  return { semver: semver.trim(), contentHash };
}

export type BuildQueryPackInput = {
  readonly id: string;
  readonly displayName: string;
  readonly entityKind: EntityKind;
  readonly theme: QueryPackTheme;
  readonly semver: string;
  readonly terms: readonly QueryTerm[];
  readonly createdAt: string;
  readonly notes?: string;
};

export function buildQueryPack(input: BuildQueryPackInput): QueryPack {
  assertSemverValid(input.semver);
  assertQueryTermsValid(input.terms);
  if (!input.id.trim()) {
    throw new Error('Query pack id is required');
  }
  if (!input.displayName.trim()) {
    throw new Error('Query pack displayName is required');
  }

  const contentHash = computeQueryPackContentHash({
    id: input.id,
    displayName: input.displayName,
    entityKind: input.entityKind,
    theme: input.theme,
    semver: input.semver,
    terms: input.terms,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  });
  const version = buildQueryPackVersion(input.semver, contentHash);
  const versionId = buildQueryPackVersionId(version.semver, version.contentHash);

  return {
    schemaVersion: QUERY_PACK_SCHEMA_VERSION,
    id: input.id.trim(),
    displayName: input.displayName.trim(),
    entityKind: input.entityKind,
    theme: input.theme,
    version,
    versionId,
    terms: input.terms,
    createdAt: input.createdAt,
    ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
  };
}

export function assertQueryPackValid(pack: QueryPack): void {
  if (pack.schemaVersion !== QUERY_PACK_SCHEMA_VERSION) {
    throw new Error(
      `Query pack schema version mismatch: expected ${QUERY_PACK_SCHEMA_VERSION}, got ${pack.schemaVersion}`,
    );
  }
  assertQueryTermsValid(pack.terms);
  const expectedHash = computeQueryPackContentHash({
    id: pack.id,
    displayName: pack.displayName,
    entityKind: pack.entityKind,
    theme: pack.theme,
    semver: pack.version.semver,
    terms: pack.terms,
    ...(pack.notes !== undefined ? { notes: pack.notes } : {}),
  });
  if (pack.version.contentHash !== expectedHash) {
    throw new Error('Query pack contentHash does not match canonical content');
  }
  const expectedVersionId = buildQueryPackVersionId(pack.version.semver, pack.version.contentHash);
  if (pack.versionId !== expectedVersionId) {
    throw new Error('Query pack versionId does not match semver+contentHash');
  }
}

type RawQueryPackFixture = {
  readonly schemaVersion: string;
  readonly pack: {
    readonly id: string;
    readonly displayName: string;
    readonly entityKind: EntityKind;
    readonly theme: QueryPackTheme;
    readonly version: { readonly semver: string };
    readonly terms: readonly QueryTerm[];
    readonly createdAt: string;
    readonly notes?: string;
  };
  readonly expectations: QueryPackFixture['expectations'];
};

export function parseQueryPackFixture(raw: unknown): QueryPackFixture {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Query pack fixture must be an object');
  }
  const fixture = raw as RawQueryPackFixture;
  if (fixture.schemaVersion !== QUERY_PACK_SCHEMA_VERSION) {
    throw new Error(`Unsupported fixture schema: ${String(fixture.schemaVersion)}`);
  }
  const pack = buildQueryPack({
    id: fixture.pack.id,
    displayName: fixture.pack.displayName,
    entityKind: fixture.pack.entityKind,
    theme: fixture.pack.theme,
    semver: fixture.pack.version.semver,
    terms: fixture.pack.terms,
    createdAt: fixture.pack.createdAt,
    ...(fixture.pack.notes !== undefined ? { notes: fixture.pack.notes } : {}),
  });
  assertQueryPackValid(pack);
  return { schemaVersion: QUERY_PACK_SCHEMA_VERSION, pack, expectations: fixture.expectations };
}

export function evaluateTextAgainstTerms(
  text: string,
  terms: readonly QueryTerm[],
): readonly QueryTerm[] {
  const normalized = text.toLowerCase();
  return terms.filter((term) => normalized.includes(term.text.toLowerCase()));
}
