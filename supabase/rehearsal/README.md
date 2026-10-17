# Story cutover rehearsal (local only)

Rebuilds an isolated `story_rehearsal` database inside the local editorial e2e Supabase
container, restores `data-old.sql` (the 48 stories, their revisions and the two release slices in the pre-cutover shape; gitignored, produced once from the local drafts), adds an
archived UUID-id draft with several revisions (the production shape), runs
`../../migrations/20261017120000_story_vocabulary_cutover.sql` in one transaction and compares content
fingerprints before and after. It refuses any target that is not `127.0.0.1/story_rehearsal`.

Needs `schema.sql` (the pre-cutover schema; do not regenerate it after the cutover migration is applied to the e2e container) and `data-old.sql`. Produced from the e2e container:
`docker exec supabase_db_blackstory-editorial-e2e pg_dump -U postgres -s --no-owner -d postgres > schema.sql`
(gitignored: it is a full schema dump). Then run `./rehearse.sh`.

The cutover migration is `supabase/migrations/20261017120000_story_vocabulary_cutover.sql`. This
harness restores the pre-cutover shape (`data-old.sql`, `schema.sql`), so it is a one-time rehearsal record,
not a recurring test.
