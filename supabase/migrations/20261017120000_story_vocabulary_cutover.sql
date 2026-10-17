-- Story vocabulary cutover (bead repo-tx3lb, epic repo-7kzea).
--
-- Retires "article" as a content-type name. Story is the umbrella; a story has a `format`
-- (chapter | entry); entries belong to a `collection`. Table, column, index, constraint,
-- trigger, function and policy names move together, and the stored values move with them:
--   kind 'article'  -> format 'entry'          series (jsonb) -> collection (jsonb)
--   ids  'article_*' -> 'story_*'               titles lose their 'President: ' / 'Chapter: ' prefix
-- No compatibility views, no dual-read. Editorial history (revision snapshots) is rewritten to
-- the same shape so no legacy key survives; the append-only triggers are disabled only for the
-- duration of this transaction.
--
-- published.release_stories.content_hash is NOT recomputed here: the hash is sha256 over the
-- application's JSON.stringify of the projection (key order matters), which SQL cannot
-- reproduce. Run `stories.ts rehash` immediately after this migration, before the app is
-- released.

-- Everything below must be one atomic step; the migration runner wraps it in a transaction.

-- 1. Quiesce: no writer may interleave, and the history/version triggers must not fire on the
--    rewrite (version_article would bump revision and flip published rows back to draft).
LOCK TABLE reference.articles, reference.article_revisions, reference.article_reviews,
  reference.article_publications, reference.editorial_media, published.release_articles
  IN ACCESS EXCLUSIVE MODE;

ALTER TABLE reference.articles DISABLE TRIGGER article_version;
ALTER TABLE reference.articles DISABLE TRIGGER article_history;
ALTER TABLE reference.article_revisions DISABLE TRIGGER article_revisions_immutable;
ALTER TABLE reference.article_reviews DISABLE TRIGGER article_reviews_immutable;
ALTER TABLE reference.article_publications DISABLE TRIGGER article_publications_immutable;

-- 2. Foreign keys come off while ids are rewritten, and go back on under the new names.
ALTER TABLE reference.article_revisions DROP CONSTRAINT article_revisions_article_id_fkey;
ALTER TABLE reference.article_reviews DROP CONSTRAINT article_reviews_article_id_revision_fkey;
ALTER TABLE reference.article_publications DROP CONSTRAINT article_publications_article_id_revision_fkey;
ALTER TABLE reference.editorial_media DROP CONSTRAINT editorial_media_article_id_fkey;

-- 3. Rename the tables, columns and indexes. Constraint-backed indexes (primary keys, the slug
--    unique constraint) are renamed with their constraints in step 4.
ALTER TABLE reference.articles RENAME TO stories;
ALTER TABLE reference.stories RENAME COLUMN kind TO format;
ALTER TABLE reference.stories RENAME COLUMN series TO collection;
ALTER TABLE reference.article_revisions RENAME TO story_revisions;
ALTER TABLE reference.story_revisions RENAME COLUMN article_id TO story_id;
ALTER TABLE reference.article_reviews RENAME TO story_reviews;
ALTER TABLE reference.story_reviews RENAME COLUMN article_id TO story_id;
ALTER TABLE reference.article_publications RENAME TO story_publications;
ALTER TABLE reference.story_publications RENAME COLUMN article_id TO story_id;
ALTER TABLE reference.editorial_media RENAME COLUMN article_id TO story_id;
ALTER TABLE published.release_articles RENAME TO release_stories;
ALTER TABLE published.release_stories RENAME COLUMN article_id TO story_id;

ALTER INDEX reference.articles_kind_idx RENAME TO stories_format_idx;
ALTER INDEX reference.articles_series_id_idx RENAME TO stories_collection_id_idx;
ALTER INDEX reference.articles_series_position_unique RENAME TO stories_collection_position_unique;
ALTER INDEX reference.article_reviews_current_idx RENAME TO story_reviews_current_idx;
ALTER INDEX published.release_articles_slug_idx RENAME TO release_stories_slug_idx;

-- 4. Stored values. The format check is replaced, not widened: 'article' stops being valid.
ALTER TABLE reference.stories DROP CONSTRAINT articles_kind_check;
UPDATE reference.stories SET format = 'entry' WHERE format = 'article';
ALTER TABLE reference.stories
  ADD CONSTRAINT stories_format_check CHECK (format IN ('chapter', 'entry'));
ALTER TABLE reference.stories RENAME CONSTRAINT articles_pkey TO stories_pkey;
ALTER TABLE reference.stories RENAME CONSTRAINT articles_slug_key TO stories_slug_key;
ALTER TABLE reference.stories RENAME CONSTRAINT articles_slug_check TO stories_slug_check;
ALTER TABLE reference.stories RENAME CONSTRAINT articles_status_check TO stories_status_check;
ALTER TABLE reference.stories RENAME CONSTRAINT articles_archived_draft TO stories_archived_draft;
ALTER TABLE reference.story_revisions RENAME CONSTRAINT article_revisions_pkey TO story_revisions_pkey;
ALTER TABLE reference.story_reviews RENAME CONSTRAINT article_reviews_pkey TO story_reviews_pkey;
ALTER TABLE reference.story_reviews RENAME CONSTRAINT article_reviews_decision_check TO story_reviews_decision_check;
ALTER TABLE reference.story_reviews RENAME CONSTRAINT article_reviews_reason_check TO story_reviews_reason_check;
ALTER TABLE reference.story_reviews RENAME CONSTRAINT article_reviews_reviewer_id_fkey TO story_reviews_reviewer_id_fkey;
ALTER TABLE reference.story_publications RENAME CONSTRAINT article_publications_pkey TO story_publications_pkey;
ALTER TABLE reference.story_publications RENAME CONSTRAINT article_publications_actor_id_fkey TO story_publications_actor_id_fkey;
ALTER TABLE reference.story_publications RENAME CONSTRAINT article_publications_previous_release_id_fkey TO story_publications_previous_release_id_fkey;
ALTER TABLE reference.story_publications RENAME CONSTRAINT article_publications_release_id_fkey TO story_publications_release_id_fkey;
ALTER TABLE published.release_stories RENAME CONSTRAINT release_articles_pkey TO release_stories_pkey;
ALTER TABLE published.release_stories RENAME CONSTRAINT release_articles_release_id_fkey TO release_stories_release_id_fkey;
ALTER TABLE published.release_stories RENAME CONSTRAINT release_articles_slug_check TO release_stories_slug_check;

-- Ids and titles. Only ids that carry the legacy prefix change; a UUID draft keeps its id.
CREATE TEMP TABLE _story_id_map ON COMMIT DROP AS
  SELECT id AS old_id, 'story_' || substr(id, length('article_') + 1) AS new_id
  FROM reference.stories WHERE id LIKE 'article\_%';

UPDATE reference.stories s SET id = m.new_id FROM _story_id_map m WHERE s.id = m.old_id;
UPDATE reference.stories SET title = regexp_replace(title, '^(President|Chapter): ', '')
  WHERE title ~ '^(President|Chapter): ';

UPDATE reference.story_revisions r SET story_id = m.new_id FROM _story_id_map m WHERE r.story_id = m.old_id;
UPDATE reference.story_reviews r SET story_id = m.new_id FROM _story_id_map m WHERE r.story_id = m.old_id;
UPDATE reference.story_publications r SET story_id = m.new_id FROM _story_id_map m WHERE r.story_id = m.old_id;
UPDATE reference.editorial_media r SET story_id = m.new_id FROM _story_id_map m WHERE r.story_id = m.old_id;

-- Revision snapshots are to_jsonb(row): rewrite their keys and values to the new shape so no
-- legacy key remains in history. Content (body, references, summary) is untouched.
UPDATE reference.story_revisions SET snapshot =
  (snapshot - 'kind' - 'series' - 'id' - 'title')
  || jsonb_build_object(
       'id', COALESCE((SELECT m.new_id FROM _story_id_map m WHERE m.old_id = snapshot ->> 'id'), snapshot ->> 'id'),
       'format', CASE WHEN snapshot ->> 'kind' = 'article' THEN 'entry' ELSE snapshot ->> 'kind' END,
       'collection', snapshot -> 'series',
       'title', regexp_replace(snapshot ->> 'title', '^(President|Chapter): ', '')
     )
  WHERE snapshot ? 'kind';

-- Foreign keys back, under the new names.
ALTER TABLE reference.story_revisions
  ADD CONSTRAINT story_revisions_story_id_fkey FOREIGN KEY (story_id) REFERENCES reference.stories(id);
ALTER TABLE reference.story_reviews
  ADD CONSTRAINT story_reviews_story_id_revision_fkey
  FOREIGN KEY (story_id, revision) REFERENCES reference.story_revisions(story_id, revision);
ALTER TABLE reference.story_publications
  ADD CONSTRAINT story_publications_story_id_revision_fkey
  FOREIGN KEY (story_id, revision) REFERENCES reference.story_revisions(story_id, revision);
ALTER TABLE reference.editorial_media
  ADD CONSTRAINT editorial_media_story_id_fkey FOREIGN KEY (story_id) REFERENCES reference.stories(id);

-- 5. Released slices. The payload is the public projection; the generated columns read it, so
--    they are dropped and re-added under their new names.
DROP INDEX published.release_articles_kind_idx;
DROP INDEX published.release_articles_series_idx;
ALTER TABLE published.release_stories DROP COLUMN kind;
ALTER TABLE published.release_stories DROP COLUMN series_id;

UPDATE published.release_stories SET payload =
  (payload - 'kind' - 'series' - 'id' - 'title')
  || jsonb_build_object(
       'id', COALESCE((SELECT m.new_id FROM _story_id_map m WHERE m.old_id = payload ->> 'id'), payload ->> 'id'),
       'format', CASE WHEN payload ->> 'kind' = 'article' THEN 'entry' ELSE COALESCE(payload ->> 'kind', 'chapter') END,
       'title', regexp_replace(payload ->> 'title', '^(President|Chapter): ', '')
     )
  || CASE WHEN payload ? 'series' THEN jsonb_build_object('collection', payload -> 'series') ELSE '{}'::jsonb END;

UPDATE published.release_stories r SET story_id = m.new_id FROM _story_id_map m WHERE r.story_id = m.old_id;

ALTER TABLE published.release_stories
  ADD COLUMN format text GENERATED ALWAYS AS (COALESCE(payload ->> 'format', 'chapter')) STORED,
  ADD COLUMN collection_id text GENERATED ALWAYS AS ((payload -> 'collection') ->> 'id') STORED;
CREATE INDEX release_stories_format_idx ON published.release_stories (release_id, format);
CREATE INDEX release_stories_collection_idx ON published.release_stories (release_id, collection_id)
  WHERE collection_id IS NOT NULL;

ALTER POLICY release_articles_select_active ON published.release_stories
  RENAME TO release_stories_select_active;

-- 6. History functions and triggers, under story names.
CREATE OR REPLACE FUNCTION reference.record_story_revision() RETURNS trigger
  LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  INSERT INTO reference.story_revisions(story_id,revision,snapshot,actor_id,reason)
  VALUES(NEW.id,NEW.revision,to_jsonb(NEW),
    COALESCE(NULLIF(current_setting('app.editorial_actor',true),''),current_user),
    COALESCE(NULLIF(current_setting('app.editorial_reason',true),''),'Story lifecycle write'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION reference.version_story() RETURNS trigger
  LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  IF TG_OP='INSERT' THEN NEW.revision:=1;
  ELSIF (to_jsonb(NEW)-ARRAY['revision','status','row_updated_at','created_at']) IS DISTINCT FROM
        (to_jsonb(OLD)-ARRAY['revision','status','row_updated_at','created_at']) THEN
    NEW.revision:=OLD.revision+1; NEW.status:='draft';
  ELSE NEW.revision:=OLD.revision;
  END IF;
  NEW.row_updated_at:=clock_timestamp();
  RETURN NEW;
END $function$;

DROP TRIGGER article_version ON reference.stories;
DROP TRIGGER article_history ON reference.stories;
DROP FUNCTION reference.version_article();
DROP FUNCTION reference.record_article_revision();
CREATE TRIGGER story_version BEFORE INSERT OR UPDATE ON reference.stories
  FOR EACH ROW EXECUTE FUNCTION reference.version_story();
CREATE TRIGGER story_history AFTER INSERT OR UPDATE ON reference.stories
  FOR EACH ROW EXECUTE FUNCTION reference.record_story_revision();

ALTER TRIGGER article_revisions_immutable ON reference.story_revisions RENAME TO story_revisions_immutable;
ALTER TRIGGER article_reviews_immutable ON reference.story_reviews RENAME TO story_reviews_immutable;
ALTER TRIGGER article_publications_immutable ON reference.story_publications RENAME TO story_publications_immutable;
ALTER TABLE reference.story_revisions ENABLE TRIGGER story_revisions_immutable;
ALTER TABLE reference.story_reviews ENABLE TRIGGER story_reviews_immutable;
ALTER TABLE reference.story_publications ENABLE TRIGGER story_publications_immutable;

COMMENT ON COLUMN reference.stories.format IS
  'chapter = long-form with the prose floor; entry = a short, individually cited piece in a collection.';
COMMENT ON COLUMN reference.stories.collection IS
  'Ordered set an entry belongs to ({id,label,position,positionLabel}); null for chapters.';
