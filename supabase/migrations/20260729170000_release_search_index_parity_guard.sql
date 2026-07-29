-- Guard: every bb_public.release_entities row must have its bb_public.search_index twin
-- by the time the transaction commits, or the entity is published but unfindable.
--
-- Why a deferred constraint trigger (not app code): the 2026-07-24 incident that
-- orphaned 7 entities (ent_james_baldwin_001 et al.) came from ad-hoc SQL, not from a
-- repo script — publish-release-entities-incremental.ts already writes both rows in one
-- transaction. Only a database-level invariant catches the next ad-hoc writer.
-- DEFERRABLE INITIALLY DEFERRED so single-transaction publishers that insert
-- release_entities first and search_index second still pass at COMMIT.

CREATE OR REPLACE FUNCTION bb_public.assert_search_index_twin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bb_public.search_index si
    WHERE si.release_id = NEW.release_id
      AND si.entity_id = NEW.entity_id
  ) THEN
    RAISE EXCEPTION
      'release_entities row (release_id=%, entity_id=%) has no bb_public.search_index twin; '
      'publish both in the same transaction (see publish-release-entities-incremental.ts)',
      NEW.release_id, NEW.entity_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS release_entities_search_index_parity ON bb_public.release_entities;

CREATE CONSTRAINT TRIGGER release_entities_search_index_parity
AFTER INSERT ON bb_public.release_entities
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION bb_public.assert_search_index_twin();
