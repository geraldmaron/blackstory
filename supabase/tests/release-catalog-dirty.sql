-- dirty_at must carry the time of the write, not the start of the writing transaction.
-- A stamp from transaction start can be older than one a quicker writer already committed,
-- and the catalog publisher then skips this transaction's records as already published.
-- Run against an isolated migrated database: psql -v ON_ERROR_STOP=1 -f supabase/tests/release-catalog-dirty.sql
BEGIN;

CREATE TEMP TABLE dirty_probe (id int);
CREATE TRIGGER dirty_probe_marks_catalog
  AFTER INSERT ON dirty_probe
  FOR EACH STATEMENT EXECUTE FUNCTION ops.mark_release_catalog_dirty();

DO $$
DECLARE began timestamptz := now(); stamped timestamptz;
BEGIN
  PERFORM pg_sleep(0.05);
  INSERT INTO dirty_probe VALUES (1);
  SELECT dirty_at INTO stamped FROM published.release_catalog_publish_watermark WHERE id = 'catalog';
  IF stamped IS NULL OR stamped <= began THEN
    RAISE EXCEPTION 'dirty_at % is not later than transaction start %', stamped, began;
  END IF;
END;
$$;

ROLLBACK;
