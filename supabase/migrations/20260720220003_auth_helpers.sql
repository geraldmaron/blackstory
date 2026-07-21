-- 0003_auth_helpers: read bb_role from JWT app_metadata only (ADR-020).

CREATE OR REPLACE FUNCTION bb_auth.current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    auth.jwt() -> 'app_metadata' ->> 'bb_role',
    ''
  );
$$;

COMMENT ON FUNCTION bb_auth.current_role() IS
  'Returns app_metadata.bb_role. Never reads user_metadata.';

CREATE OR REPLACE FUNCTION bb_auth.has_role(expected text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT bb_auth.current_role() IS NOT DISTINCT FROM expected;
$$;

CREATE OR REPLACE FUNCTION bb_auth.has_any_role(VARIADIC expected text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT bb_auth.current_role() = ANY (expected);
$$;

CREATE OR REPLACE FUNCTION bb_auth.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT bb_auth.has_any_role('admin', 'research', 'publication', 'security');
$$;

CREATE OR REPLACE FUNCTION bb_auth.can_publish()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT bb_auth.has_any_role('admin', 'publication');
$$;

GRANT EXECUTE ON FUNCTION bb_auth.current_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_auth.has_role(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_auth.has_any_role(text[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_auth.is_staff() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION bb_auth.can_publish() TO anon, authenticated, service_role;
