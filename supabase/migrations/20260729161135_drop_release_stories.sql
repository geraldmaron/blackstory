-- Drop bb_public.release_stories (repo-8dj0): the legacy /stories + /themes surfaces are
-- retired (repo-dx4n) — every route 308s to /chapters — and the last web readers
-- (listPublicStoryViews / listPublicStoryListItems / resolvePublicStoryView) are deleted,
-- so nothing reads these rows. The 5 remaining active-release rows are the user-authorized
-- legacy stories; rel_seed_001's rows were already removed in the 2026-07-29 dead-projection
-- cleanup. Future story publishing belongs to the bb_research story-intake pipeline
-- (repo-cqey), which does not target this table.
DROP TABLE IF EXISTS bb_public.release_stories;
