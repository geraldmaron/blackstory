-- Editorial state extends the existing article lifecycle. Public reads remain release scoped.
ALTER TABLE reference.articles ADD COLUMN contributors jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE reference.articles ADD COLUMN revision bigint NOT NULL DEFAULT 1;

CREATE TABLE reference.contributors (
 id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 kind text NOT NULL CHECK (kind IN ('person','editorial')),
 biography text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE access_control.contributor_accounts (
 contributor_id text PRIMARY KEY REFERENCES reference.contributors(id),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id)
);
INSERT INTO reference.contributors(id,name,kind,biography) VALUES
 ('gerald-dagher','Gerald Dagher','person',''),
 ('neo','Neo','editorial','BlackStory’s house editorial voice. Research and editorial assistance are reviewed by the credited human contributors.');

CREATE TABLE reference.article_revisions (
 article_id text NOT NULL REFERENCES reference.articles(id),
 revision bigint NOT NULL,
 snapshot jsonb NOT NULL,
 actor_id text NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(article_id,revision)
);
CREATE TABLE reference.article_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 article_id text NOT NULL,
 revision bigint NOT NULL,
 reviewer_id uuid NOT NULL REFERENCES auth.users(id),
 decision text NOT NULL CHECK (decision IN ('approved','needs_evidence','rejected')),
 reason text NOT NULL CHECK(length(btrim(reason))>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(article_id,revision) REFERENCES reference.article_revisions(article_id,revision)
);
CREATE INDEX article_reviews_current_idx ON reference.article_reviews(article_id,revision,created_at DESC);

CREATE FUNCTION reference.version_article() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.revision:=1;
 ELSIF (to_jsonb(NEW)-ARRAY['revision','status','row_updated_at','created_at']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['revision','status','row_updated_at','created_at']) THEN
   NEW.revision:=OLD.revision+1; NEW.status:='draft';
 ELSE NEW.revision:=OLD.revision;
 END IF;
 NEW.row_updated_at:=clock_timestamp();
 RETURN NEW;
END $$;
CREATE FUNCTION reference.record_article_revision() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
 INSERT INTO reference.article_revisions(article_id,revision,snapshot,actor_id,reason)
 VALUES(NEW.id,NEW.revision,to_jsonb(NEW),
 COALESCE(NULLIF(current_setting('app.editorial_actor',true),''),current_user),
 COALESCE(NULLIF(current_setting('app.editorial_reason',true),''),'Article lifecycle write'))
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER article_version BEFORE INSERT OR UPDATE ON reference.articles
 FOR EACH ROW EXECUTE FUNCTION reference.version_article();
CREATE TRIGGER article_history AFTER INSERT OR UPDATE ON reference.articles
 FOR EACH ROW EXECUTE FUNCTION reference.record_article_revision();
INSERT INTO reference.article_revisions(article_id,revision,snapshot,actor_id,reason)
 SELECT id,revision,to_jsonb(a),'migration','Existing article baseline; authorship not inferred'
 FROM reference.articles a;

-- Unreleased media stays private. The publication executor copies approved media separately.
CREATE TABLE reference.editorial_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 article_id text NOT NULL REFERENCES reference.articles(id),
 content_type text NOT NULL CHECK(content_type IN ('image/png','image/jpeg','image/webp')),
 object_path text NOT NULL UNIQUE,
 content_hash text NOT NULL,
 byte_length integer NOT NULL CHECK(byte_length BETWEEN 1 AND 5242880),
 credit text NOT NULL CHECK(length(btrim(credit))>0),
 rights_status text NOT NULL CHECK(rights_status IN ('public_domain','licensed','fair_use')),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('editorial-media','editorial-media',false,5242880,ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;
-- All private editorial reads/writes use the verified server boundary, never the Data API.
ALTER TABLE reference.contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control.contributor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference.article_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference.article_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference.editorial_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reference.contributors, access_control.contributor_accounts,
 reference.article_revisions,reference.article_reviews,reference.editorial_media FROM PUBLIC,anon,authenticated;
GRANT ALL ON reference.contributors, access_control.contributor_accounts,
 reference.article_revisions,reference.article_reviews,reference.editorial_media TO service_role;
REVOKE ALL ON FUNCTION reference.version_article(),reference.record_article_revision() FROM PUBLIC,anon,authenticated;

-- Publication receipts tie each immutable release to the reviewed source revision.
CREATE TABLE reference.article_publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 article_id text NOT NULL, revision bigint NOT NULL,
 release_id text NOT NULL REFERENCES publication.releases(id),
 previous_release_id text NOT NULL REFERENCES publication.releases(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id), reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(article_id,revision) REFERENCES reference.article_revisions(article_id,revision)
);
ALTER TABLE reference.article_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reference.article_publications FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON reference.article_publications TO service_role,admin_app;
GRANT SELECT,INSERT,UPDATE ON reference.contributors,access_control.contributor_accounts,reference.editorial_media TO admin_app;
GRANT SELECT,INSERT ON reference.article_revisions,reference.article_reviews TO admin_app;
CREATE FUNCTION reference.editorial_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Editorial history is append only'; END $$;
CREATE TRIGGER article_revisions_immutable BEFORE UPDATE OR DELETE ON reference.article_revisions FOR EACH ROW EXECUTE FUNCTION reference.editorial_append_only();
CREATE TRIGGER article_reviews_immutable BEFORE UPDATE OR DELETE ON reference.article_reviews FOR EACH ROW EXECUTE FUNCTION reference.editorial_append_only();
CREATE TRIGGER article_publications_immutable BEFORE UPDATE OR DELETE ON reference.article_publications FOR EACH ROW EXECUTE FUNCTION reference.editorial_append_only();
REVOKE ALL ON FUNCTION reference.editorial_append_only() FROM PUBLIC,anon,authenticated;

-- Private editing must not inherit the public corrections intake's broad receipt access.
ALTER TABLE reference.articles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reference.articles FROM PUBLIC,anon,authenticated,web_public;
GRANT SELECT,INSERT,UPDATE ON reference.articles TO admin_app,service_role;
CREATE POLICY editorial_intake_private ON submissions.intake_items AS RESTRICTIVE
 FOR ALL TO anon,authenticated,web_public
 USING (kind IS DISTINCT FROM 'entity_editorial')
 WITH CHECK (kind IS DISTINCT FROM 'entity_editorial');
CREATE INDEX editorial_intake_entity_idx ON submissions.intake_items
 ((payload->'proposal'->>'entityId'),created_at DESC) WHERE kind='entity_editorial';
CREATE FUNCTION reference.protect_editorial_intake() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Editorial proposals retain their review history'; END IF;
 IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.payload->'proposal' IS DISTINCT FROM OLD.payload->'proposal' THEN
   RAISE EXCEPTION 'An editorial proposal is immutable; submit a new proposal';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER editorial_intake_immutable BEFORE UPDATE OR DELETE ON submissions.intake_items
 FOR EACH ROW WHEN (OLD.kind='entity_editorial') EXECUTE FUNCTION reference.protect_editorial_intake();
REVOKE ALL ON FUNCTION reference.protect_editorial_intake() FROM PUBLIC,anon,authenticated;
