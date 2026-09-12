-- Invention as a first-class entity kind, and the relationship vocabulary that can tell
-- inventing something apart from improving it.
--
-- WHY A NEW KIND RATHER THAN `artifact`: an artifact is an object; an invention is the
-- technology or process a reader recognises. Latimer's carbon-manufacturing process is not an
-- object. An invention also needs no patent to exist — patent access was unequal, enslaved
-- people could not exercise patent ownership as free citizens did, and innovation that never
-- entered the patent system is still innovation. Banneker's clock is the case that keeps that
-- honest.

ALTER TABLE bb_canonical.entities
  DROP CONSTRAINT IF EXISTS entities_kind_check;

ALTER TABLE bb_canonical.entities
  ADD CONSTRAINT entities_kind_check
  CHECK (kind IN (
    'person', 'place', 'school', 'organization', 'institution', 'event',
    'law', 'case', 'publication', 'artifact', 'movement', 'invention', 'other'
  ));

COMMENT ON CONSTRAINT entities_kind_check ON bb_canonical.entities IS
  'Mirrors ENTITY_KINDS in packages/domain/src/entity-kinds.ts and packages/public-contracts/src/v1/entity.ts. All three move together.';

-- entities.entity_class needs no change: `invention` classifies as `work`, alongside
-- publication and artifact, per KIND_TO_CLASSIFICATION in packages/domain/src/entity-class.ts.

-- ---------------------------------------------------------------------------------------------
-- relationship_type: collapse two constraints into one, and add invention contribution edges.
--
-- THE STATE THIS INHERITS, measured against the live database on 2026-09-08:
--   `entity_relationships_typed_predicate` (from 20260721041950) is present, allowing 25 values.
--   `entity_relationships_relationship_type_check` (from 20260729203000) is RECORDED AS APPLIED
--   in supabase_migrations.schema_migrations and is NOT present on the table.
-- So the ledger and the schema disagree, and a fresh apply onto a new environment would produce
-- a 20-value constraint that production does not have — under which `served_as`, `succeeded`,
-- `challenged_law`, `funded_by` and `published` would be rejected there while working here.
-- No live row uses any of those five (checked: 0 of 1,064 rows would be rejected), so the
-- divergence is currently latent rather than breaking.
--
-- Rather than add a third name to that pile, this drops both by name and creates one
-- authoritative constraint. Adding a relationship type after this is one edit, not two, and
-- there is no longer a constraint whose violation names a different constraint than the one
-- that rejected the row.

ALTER TABLE bb_canonical.entity_relationships
  DROP CONSTRAINT IF EXISTS entity_relationships_typed_predicate;

ALTER TABLE bb_canonical.entity_relationships
  DROP CONSTRAINT IF EXISTS entity_relationships_relationship_type_check;

ALTER TABLE bb_canonical.entity_relationships
  ADD CONSTRAINT entity_relationships_relationship_type_check
  CHECK (relationship_type IN (
    -- Structural and biographical.
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
    'served_as',
    'succeeded',
    'challenged_law',
    'funded_by',
    'published',
    -- Historical causation.
    'caused',
    'enabled',
    'influenced',
    'participated_in',
    'overturned',
    'commemorates',
    'authored',
    -- Invention contribution. `invented` and `co_invented` assert origination and carry the
    -- high-impact corroboration gate; the bounded edges below are what most patent-derived
    -- records should actually use, because most patents are improvements to a field that
    -- already existed.
    'invented',
    'co_invented',
    'improved',
    'developed',
    'designed',
    'led_development_of',
    'built_on',
    -- Commercial and institutional context.
    'commercialized',
    'assigned_to',
    'licensed_to',
    'manufactured_by',
    'demonstrated_at',
    -- The human network around the work. `documented_by` is how a compiler such as
    -- Henry E. Baker relates to the inventors he recorded.
    'collaborated_with',
    'mentored_by',
    'litigated_with',
    'documented_by',
    'other'
  ));

COMMENT ON CONSTRAINT entity_relationships_relationship_type_check ON bb_canonical.entity_relationships IS
  'The single relationship vocabulary. Mirrors RELATIONSHIP_TYPES in packages/domain-core/src/relationship.ts; supersedes entity_relationships_typed_predicate, which was dropped here so a new value needs one edit rather than two.';
