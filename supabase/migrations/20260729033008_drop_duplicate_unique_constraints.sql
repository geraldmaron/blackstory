
-- release_entities_pkey and release_stories_pkey already enforce uniqueness on the same
-- columns as these constraints; the duplicate uniq constraints just cost extra write-time
-- maintenance for no additional guarantee (confirmed no FK depends on either).
ALTER TABLE bb_public.release_entities DROP CONSTRAINT release_entities_release_entity_uniq;
ALTER TABLE bb_public.release_stories DROP CONSTRAINT release_stories_release_slug_uniq;
