/** Unified names and identifiers with temporal qualifiers. Pure mapping helpers collect entity name fields without changing stored records or asserting identity matches. */
import type { CanonicalEntity } from './entity.js';
import { normalizeAlias } from './resolution/normalization.js';

// ---------------------------------------------------------------------------
// EntityName: unified temporal naming contract
// ---------------------------------------------------------------------------

export const ENTITY_NAME_TYPES = [
  'display',
  'former_name',
  'aka',
  'spelling',
  'translated',
  'historical',
  'other',
] as const;

export type EntityNameType = (typeof ENTITY_NAME_TYPES)[number];

export type EntityName = {
  readonly entityId: string;
  readonly value: string;
  readonly normalizedValue: string;
  readonly nameType: EntityNameType;
  readonly language?: string;
  readonly validFrom?: string;
  readonly validTo?: string | null;
  readonly isPreferred: boolean;
  readonly evidenceIds: readonly string[];
};

function toEntityName(
  entityId: string,
  value: string,
  nameType: EntityNameType,
  extra: Partial<Pick<EntityName, 'validFrom' | 'validTo' | 'isPreferred' | 'evidenceIds'>> = {},
): EntityName {
  return {
    entityId,
    value,
    normalizedValue: normalizeAlias(value),
    nameType,
    isPreferred: extra.isPreferred ?? false,
    evidenceIds: extra.evidenceIds ?? [],
    ...(extra.validFrom !== undefined ? { validFrom: extra.validFrom } : {}),
    ...(extra.validTo !== undefined ? { validTo: extra.validTo } : {}),
  };
}

/**
 * Migrates every scattered name field on a `CanonicalEntity` (`displayName`, `aliases`,
 * `school.names`, `place.historicalNames`) into the unified `EntityName` shape. Pure and
 * read-only; does not mutate the entity or its stored form.
 */
export function migrateEntityNames(entity: CanonicalEntity): readonly EntityName[] {
  const names: EntityName[] = [
    toEntityName(entity.id, entity.displayName, 'display', { isPreferred: true }),
  ];
  for (const alias of entity.aliases ?? []) {
    names.push(
      toEntityName(entity.id, alias.value, alias.kind ?? 'other', {
        isPreferred: alias.primary ?? false,
        ...(alias.validFrom !== undefined ? { validFrom: alias.validFrom } : {}),
        ...(alias.validTo !== undefined ? { validTo: alias.validTo } : {}),
      }),
    );
  }
  for (const schoolName of entity.school?.names ?? []) {
    names.push(
      toEntityName(entity.id, schoolName.name, 'historical', {
        isPreferred: schoolName.primary ?? false,
        ...(schoolName.validFrom !== undefined ? { validFrom: schoolName.validFrom } : {}),
        ...(schoolName.validTo !== undefined ? { validTo: schoolName.validTo } : {}),
      }),
    );
  }
  for (const historicalName of entity.place?.historicalNames ?? []) {
    names.push(toEntityName(entity.id, historicalName, 'historical'));
  }
  return names;
}

// ---------------------------------------------------------------------------
// EntityIdentifierRecord: external-identifier contract + trusted-namespace weighting
// ---------------------------------------------------------------------------

export type EntityIdentifierRecord = {
  readonly entityId: string;
  readonly namespace: string;
  readonly value: string;
  readonly normalizedValue: string;
  readonly authority?: string;
  readonly evidenceIds: readonly string[];
};

/**
 * External authority-control namespaces where an exact value match is essentially unambiguous
 * (a Wikidata QID or an NRHP reference number cannot collide the way an internal archive
 * accession number can). Matched case/whitespace/diacritic-insensitively via `normalizeAlias`.
 * Drives both the resolver's identifier-dominant re-weighting and is available for identifier
 * ingestion/validation elsewhere.
 */
export const TRUSTED_IDENTIFIER_NAMESPACES: ReadonlySet<string> = new Set(
  ['wikidata', 'loc', 'viaf', 'nps', 'nrhp', 'nces', 'ushmm', 'snac', 'fast'].map(normalizeAlias),
);

export function isTrustedIdentifierNamespace(namespace: string): boolean {
  return TRUSTED_IDENTIFIER_NAMESPACES.has(normalizeAlias(namespace));
}

/**
 * Migrates `CanonicalEntity.identifiers` (`{system, value, note?}`) into the unified
 * `EntityIdentifierRecord` shape. `system` becomes `namespace`; `note` is dropped (it was
 * free-text, not modeled here).
 */
export function migrateEntityIdentifiers(
  entity: CanonicalEntity,
): readonly EntityIdentifierRecord[] {
  return (entity.identifiers ?? []).map((identifier) => ({
    entityId: entity.id,
    namespace: identifier.system,
    value: identifier.value,
    normalizedValue: normalizeAlias(identifier.value),
    evidenceIds: [],
  }));
}

// ---------------------------------------------------------------------------
// Uniqueness invariant: namespace/value -> at most one active entity
// ---------------------------------------------------------------------------

export type IdentifierUniquenessViolation = {
  readonly namespace: string;
  readonly normalizedValue: string;
  readonly entityIds: readonly string[];
};

/**
 * Validates "every namespace/value identifier pair maps to at most one active entity, unless
 * explicitly flagged ambiguous." Returns the list of violations (empty = valid); does not throw,
 * so callers can decide how to surface violations (review queue, hard-fail gate, etc).
 * Records whose `entityId` is in `ambiguousEntityIds` are exempt from collision counting for that
 * entity (an operator has explicitly acknowledged the ambiguity).
 */
export function findIdentifierUniquenessViolations(
  records: readonly EntityIdentifierRecord[],
  options: { readonly ambiguousEntityIds?: ReadonlySet<string> } = {},
): readonly IdentifierUniquenessViolation[] {
  const ambiguous = options.ambiguousEntityIds ?? new Set<string>();
  const byKey = new Map<
    string,
    { namespace: string; normalizedValue: string; entityIds: Set<string> }
  >();
  for (const record of records) {
    if (ambiguous.has(record.entityId)) continue;
    const namespace = normalizeAlias(record.namespace);
    const key = `${namespace}::${record.normalizedValue}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.entityIds.add(record.entityId);
    } else {
      byKey.set(key, {
        namespace,
        normalizedValue: record.normalizedValue,
        entityIds: new Set([record.entityId]),
      });
    }
  }
  const violations: IdentifierUniquenessViolation[] = [];
  for (const entry of byKey.values()) {
    if (entry.entityIds.size > 1) {
      violations.push({
        namespace: entry.namespace,
        normalizedValue: entry.normalizedValue,
        entityIds: [...entry.entityIds],
      });
    }
  }
  return violations;
}

/** Throws with a descriptive message if any identifier uniqueness violation exists. */
export function assertIdentifierUniqueness(
  records: readonly EntityIdentifierRecord[],
  options?: { readonly ambiguousEntityIds?: ReadonlySet<string> },
): void {
  const violations = findIdentifierUniquenessViolations(records, options);
  if (violations.length > 0) {
    const [first] = violations;
    throw new Error(
      `Identifier uniqueness violation: ${first!.namespace}/${first!.normalizedValue} maps to ` +
        `${first!.entityIds.length} entities (${first!.entityIds.join(', ')})` +
        (violations.length > 1 ? ` and ${violations.length - 1} more` : ''),
    );
  }
}
