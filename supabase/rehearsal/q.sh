#!/bin/sh
# usage: q.sh "<sql>"   -- runs against the local story_rehearsal DB only
docker exec supabase_db_blackstory-editorial-e2e psql -U postgres -d story_rehearsal -At -F ' | ' -c "$1"
