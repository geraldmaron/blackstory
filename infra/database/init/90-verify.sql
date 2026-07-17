-- Verification queries for role isolation (BB-012).
-- Exit non-zero via psql ON_ERROR_STOP when expectations fail.

DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(expected, ', ')
  INTO missing
  FROM (
    VALUES
      ('role_public_read'),
      ('role_submissions_write'),
      ('role_admin_app'),
      ('role_research'),
      ('role_publication'),
      ('role_migrations'),
      ('role_backup_readonly'),
      ('role_security')
  ) AS t(expected)
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = t.expected);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing roles: %', missing;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'postgis extension missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RAISE EXCEPTION 'pg_trgm extension missing';
  END IF;
END
$$;

SELECT
  r.rolname,
  r.rolconnlimit,
  r.rolcanlogin
FROM pg_roles r
WHERE r.rolname LIKE 'role_%'
ORDER BY r.rolname;
