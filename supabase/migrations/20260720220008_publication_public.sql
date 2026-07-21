-- 0008_publication_public: releases, active pointer, projections, search, submissions.

CREATE TABLE bb_publication.releases (
  id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN (
    'draft', 'preview', 'active', 'superseded', 'rolled_back'
  )),
  search_index_version text,
  signed_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_public.active_release (
  id text PRIMARY KEY DEFAULT 'active' CHECK (id = 'active'),
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  activated_at timestamptz NOT NULL,
  search_index_version text,
  manifest_hash text
);

CREATE TABLE bb_public.materialized_snapshots (
  name text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_public.release_entities (
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  entity_id text NOT NULL,
  display_name text NOT NULL,
  kind text NOT NULL,
  summary text,
  location jsonb,
  geohash text,
  lat double precision,
  lng double precision,
  claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  taxonomy jsonb NOT NULL DEFAULT '{}'::jsonb,
  related jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_image jsonb,
  projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, entity_id)
);

CREATE TABLE bb_public.release_stories (
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text NOT NULL,
  body jsonb NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_entity_ids text[] NOT NULL DEFAULT '{}',
  projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, slug)
);

CREATE TABLE bb_public.release_graph_adjacency (
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  entity_id text NOT NULL,
  adjacency jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (release_id, entity_id)
);

CREATE TABLE bb_public.release_graph_decades (
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  decade integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (release_id, decade)
);

CREATE TABLE bb_public.release_graph_all_time (
  release_id text PRIMARY KEY REFERENCES bb_publication.releases (id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE bb_public.search_index (
  id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  entity_id text,
  name text,
  name_lower text,
  aliases text[] NOT NULL DEFAULT '{}',
  topics text[] NOT NULL DEFAULT '{}',
  kind text,
  status text,
  geohash text,
  related_count integer,
  claim_count integer,
  facets jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_submissions.intake_items (
  id text PRIMARY KEY DEFAULT extensions.gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'quarantined'
    CHECK (status IN ('quarantined', 'promoted', 'rejected', 'spam')),
  created_by uuid NOT NULL,
  kind text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SECURITY DEFINER activation: publication/admin only; research cannot call successfully.
CREATE OR REPLACE FUNCTION bb_publication.activate_release(p_release_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bb_publication, bb_public, bb_audit, bb_auth, extensions, public
AS $$
DECLARE
  v_manifest_hash text;
  v_search_version text;
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  v_bb_role text := bb_auth.current_role();
BEGIN
  -- Research must never publish (ADR-009 / ADR-020).
  IF v_bb_role = 'research' THEN
    RAISE EXCEPTION 'activate_release denied: research cannot publish';
  END IF;

  -- Allow service_role JWT, DB postgres, or app_metadata publication/admin.
  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND v_bb_role IS DISTINCT FROM 'admin'
     AND v_bb_role IS DISTINCT FROM 'publication'
     AND current_user IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'activate_release denied: requires service_role or publication/admin bb_role';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM bb_publication.releases r WHERE r.id = p_release_id
  ) THEN
    RAISE EXCEPTION 'release % not found', p_release_id;
  END IF;

  UPDATE bb_publication.releases
  SET status = CASE
        WHEN id = p_release_id THEN 'active'
        WHEN status = 'active' THEN 'superseded'
        ELSE status
      END,
      activated_at = CASE WHEN id = p_release_id THEN now() ELSE activated_at END,
      updated_at = now()
  WHERE id = p_release_id OR status = 'active';

  SELECT signed_manifest ->> 'manifestHash', search_index_version
  INTO v_manifest_hash, v_search_version
  FROM bb_publication.releases
  WHERE id = p_release_id;

  INSERT INTO bb_public.active_release (id, release_id, activated_at, search_index_version, manifest_hash)
  VALUES ('active', p_release_id, now(), v_search_version, v_manifest_hash)
  ON CONFLICT (id) DO UPDATE
  SET release_id = EXCLUDED.release_id,
      activated_at = EXCLUDED.activated_at,
      search_index_version = EXCLUDED.search_index_version,
      manifest_hash = EXCLUDED.manifest_hash;

  INSERT INTO bb_audit.events (
    id, action, category, actor, subject, reason, request_id, correlation_id,
    release_id, idempotency_key, occurred_at
  ) VALUES (
    extensions.gen_random_uuid()::text,
    'publication.release_activated',
    'publication',
    jsonb_build_object('id', coalesce(auth.uid()::text, 'service'), 'type', 'service'),
    jsonb_build_object('type', 'release', 'id', p_release_id, 'path', 'bb_publication.releases/' || p_release_id),
    'Release activated',
    coalesce(auth.jwt() ->> 'request_id', extensions.gen_random_uuid()::text),
    extensions.gen_random_uuid()::text,
    p_release_id,
    'activate:' || p_release_id || ':' || extract(epoch from now())::text,
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION bb_publication.activate_release(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bb_publication.activate_release(text) TO service_role;
-- authenticated may execute only if can_publish(); function still rejects research.
GRANT EXECUTE ON FUNCTION bb_publication.activate_release(text) TO authenticated;
