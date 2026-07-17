/**
 * Entity relationships with evidence and temporal/geographic context (BB-014).
 */
export const RELATIONSHIP_TYPES = [
  'located_at',
  'occurred_at',
  'attended',
  'founded',
  'employed_by',
  'member_of',
  'related_to',
  'depicts',
  'cites',
  'governed_by',
  'part_of',
  'successor_of',
  'other',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export type TemporalContext = {
  readonly label?: string;
  readonly validFrom?: string;
  readonly validTo?: string | null;
};

export type GeographicRelationshipContext = {
  readonly locationId?: string;
  readonly jurisdictionId?: string;
  readonly notes?: string;
};

export type EntityRelationship = {
  readonly id: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly type: RelationshipType;
  /** Evidence record ids supporting this relationship (BB-016 deepens evidence). */
  readonly evidenceIds: readonly string[];
  readonly temporal?: TemporalContext;
  readonly geographic?: GeographicRelationshipContext;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function assertRelationshipHasEvidence(rel: Pick<EntityRelationship, 'evidenceIds'>): void {
  if (!rel.evidenceIds || rel.evidenceIds.length === 0) {
    throw new Error('Relationships must include at least one evidence id');
  }
}
