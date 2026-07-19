/**
 * Branded string identifiers for BlackStory domain entities and related records.
 */
export type EntityId = string & { readonly __brand: 'EntityId' };
export type RelationshipId = string & { readonly __brand: 'RelationshipId' };
export type MergeId = string & { readonly __brand: 'MergeId' };
export type LocationId = string & { readonly __brand: 'LocationId' };

function brandNonEmpty<T extends string>(value: string, label: string): T {
  if (!value.trim()) {
    throw new Error(`${label} must be non-empty`);
  }
  return value as T;
}

export function asEntityId(value: string): EntityId {
  return brandNonEmpty(value, 'EntityId');
}

export function asRelationshipId(value: string): RelationshipId {
  return brandNonEmpty(value, 'RelationshipId');
}

export function asMergeId(value: string): MergeId {
  return brandNonEmpty(value, 'MergeId');
}

export function asLocationId(value: string): LocationId {
  return brandNonEmpty(value, 'LocationId');
}
