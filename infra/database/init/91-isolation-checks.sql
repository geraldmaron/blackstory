-- Runtime privilege isolation checks (BB-012).
-- Run as superuser/owner after init. Each block must raise on unexpected privilege.

-- Public read cannot write bb_public.
DO $$
BEGIN
  SET LOCAL ROLE role_public_read;
  BEGIN
    INSERT INTO bb_public.released_entity (slug, display_name) VALUES ('x', 'x');
    RAISE EXCEPTION 'role_public_read unexpectedly inserted into bb_public';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  RESET ROLE;
END
$$;

-- Research cannot write bb_public.
DO $$
BEGIN
  SET LOCAL ROLE role_research;
  BEGIN
    INSERT INTO bb_public.released_entity (slug, display_name) VALUES ('y', 'y');
    RAISE EXCEPTION 'role_research unexpectedly inserted into bb_public';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  RESET ROLE;
END
$$;

-- Publication cannot modify raw evidence.
DO $$
BEGIN
  SET LOCAL ROLE role_publication;
  BEGIN
    INSERT INTO bb_evidence.raw_capture (source_uri) VALUES ('https://example.invalid/capture');
    RAISE EXCEPTION 'role_publication unexpectedly inserted into bb_evidence';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  RESET ROLE;
END
$$;

-- Submissions cannot touch publication schema.
DO $$
BEGIN
  SET LOCAL ROLE role_submissions_write;
  BEGIN
    INSERT INTO bb_publication.release_manifest (release_id) VALUES ('r1');
    RAISE EXCEPTION 'role_submissions_write unexpectedly inserted into bb_publication';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  RESET ROLE;
END
$$;

-- Allowed paths still work.
SET ROLE role_public_read;
SELECT count(*) FROM bb_public.released_entity;
RESET ROLE;

SET ROLE role_submissions_write;
INSERT INTO bb_submissions.intake_item (payload) VALUES ('{"ok":true}'::jsonb);
RESET ROLE;

SET ROLE role_research;
INSERT INTO bb_research.staging_note (body) VALUES ('note');
INSERT INTO bb_evidence.raw_capture (source_uri) VALUES ('https://example.invalid/ok');
RESET ROLE;

SET ROLE role_publication;
INSERT INTO bb_publication.release_manifest (release_id) VALUES ('release-test-1');
INSERT INTO bb_public.released_entity (slug, display_name) VALUES ('entity-1', 'Entity One');
RESET ROLE;
