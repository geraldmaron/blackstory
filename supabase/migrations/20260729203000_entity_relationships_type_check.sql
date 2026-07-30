-- Harden entity_relationships.relationship_type to the documented 20-type vocabulary.

ALTER TABLE bb_canonical.entity_relationships
  DROP CONSTRAINT IF EXISTS entity_relationships_relationship_type_check;

ALTER TABLE bb_canonical.entity_relationships
  ADD CONSTRAINT entity_relationships_relationship_type_check
  CHECK (relationship_type IN (
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
    'caused',
    'enabled',
    'influenced',
    'participated_in',
    'overturned',
    'commemorates',
    'authored',
    'other'
  ));

COMMENT ON CONSTRAINT entity_relationships_relationship_type_check ON bb_canonical.entity_relationships IS
  'Mirrors RELATIONSHIP_TYPES in packages/domain/src/relationship.ts — prevents drift as machine edges multiply.';
