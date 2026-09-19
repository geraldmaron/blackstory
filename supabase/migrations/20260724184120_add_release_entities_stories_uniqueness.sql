alter table bb_public.release_entities
  add constraint release_entities_release_entity_uniq unique (release_id, entity_id);

alter table bb_public.release_stories
  add constraint release_stories_release_slug_uniq unique (release_id, slug);
