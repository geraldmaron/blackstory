#!/bin/zsh
# Rebuild the isolated story_rehearsal DB, restore the pre-migration data, add the archived-draft case, migrate, verify.
set -u
S="$(cd "$(dirname "$0")" && pwd)"
cd "$(git rev-parse --show-toplevel)"
PG() { docker exec -i supabase_db_blackstory-editorial-e2e psql -U postgres "$@"; }
PG -c "drop database if exists story_rehearsal;" >/dev/null && PG -c "create database story_rehearsal;" >/dev/null && PG -d story_rehearsal -q < $S/schema.sql >/dev/null 2>&1
PG -d story_rehearsal -q < $S/data-old.sql >/dev/null 2>&1
$S/q.sh "insert into reference.articles (id, slug, title, summary, era_label, place_label, published_at, body, \"references\", status, kind, tags, contributors) values ('fb925185-c763-42b0-b373-84211dc27965','production-editorial-validation','Production editorial validation','s','e','p','2026-10-15','[]'::jsonb,'[]'::jsonb,'draft','article','{}','[]'::jsonb)" >/dev/null
for i in 1 2 3; do $S/q.sh "update reference.articles set summary='s$i' where slug='production-editorial-validation'" >/dev/null; done
$S/q.sh "update reference.articles set archived_at=now() where slug='production-editorial-validation'" >/dev/null
BODY_B=$($S/q.sh "select md5(string_agg(id||'|'||slug||'|'||summary||'|'||body::text||'|'||\"references\"::text||'|'||coalesce(hero_image::text,''), E'\n' order by slug)) from reference.articles")
REV_B=$($S/q.sh "select md5(string_agg(a.slug||r.revision||'|'||(r.snapshot->>'summary')||'|'||(r.snapshot->>'body'), ',' order by a.slug, r.revision)) from reference.article_revisions r join reference.articles a on a.id=r.article_id")
REL_B=$($S/q.sh "select md5(string_agg(release_id||slug||(payload->>'summary')||(payload->>'body'), ',' order by release_id, slug)) from published.release_articles")
PG -d story_rehearsal --single-transaction -v ON_ERROR_STOP=1 < supabase/migrations/20261017120000_story_vocabulary_cutover.sql > $S/migrate.log 2>&1; echo "migrate exit=$?"; grep -i error $S/migrate.log
BODY_A=$($S/q.sh "select md5(string_agg(case when id like 'story\_%' then 'article_'||substr(id,7) else id end||'|'||slug||'|'||summary||'|'||body::text||'|'||\"references\"::text||'|'||coalesce(hero_image::text,''), E'\n' order by slug)) from reference.stories")
REV_A=$($S/q.sh "select md5(string_agg(a.slug||r.revision||'|'||(r.snapshot->>'summary')||'|'||(r.snapshot->>'body'), ',' order by a.slug, r.revision)) from reference.story_revisions r join reference.stories a on a.id=r.story_id")
REL_A=$($S/q.sh "select md5(string_agg(release_id||slug||(payload->>'summary')||(payload->>'body'), ',' order by release_id, slug)) from published.release_stories")
[ "$BODY_B" = "$BODY_A" ] && echo "stories content equal: yes" || echo "stories content equal: NO"
[ "$REV_B" = "$REV_A" ] && echo "revision content equal: yes" || echo "revision content equal: NO"
[ "$REL_B" = "$REL_A" ] && echo "release content equal: yes" || echo "release content equal: NO"
$S/q.sh "select 'stories', count(*) from reference.stories union all select 'revisions', count(*) from reference.story_revisions union all select 'release rows', count(*) from published.release_stories union all select 'legacy rows', count(*) from reference.stories where format='article' or id like 'article%'"
$S/q.sh "select 'legacy relations', count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relname ilike '%article%' and n.nspname in ('reference','published','publication','ops','access_control','audit','research')"
$S/q.sh "select 'legacy in history/releases', (select count(*) from reference.story_revisions where snapshot ? 'kind' or snapshot ? 'series' or snapshot::text ~ 'article_(potus|buying|the_count|wealth)' or snapshot->>'title' ~ '^(President|Chapter): ') + (select count(*) from published.release_stories where payload ? 'kind' or payload ? 'series' or payload::text ~ '\"article\"|article_(potus|buying|the_count|wealth)')"
# Post-cutover step: recompute content_hash with the new code, then prove reference rows and the
# active release agree (audit must report only "ok") and that a second rehash changes nothing.
U=postgres://postgres:postgres@127.0.0.1:55432/story_rehearsal
run_stories() { DATABASE_URL=$U fnm exec --using=22 -- node --conditions development --import tsx packages/ops-data/scripts/stories.ts "$@" 2>&1; }
echo "audit before rehash: $(run_stories audit | jq -c '[.stories[].state] | group_by(.) | map({(.[0]): length}) | add')"
echo "rehash: $(run_stories rehash | jq -c '{rows, updated}')"
echo "audit after rehash:  $(run_stories audit | jq -c '[.stories[].state] | group_by(.) | map({(.[0]): length}) | add')"
echo "rehash again:        $(run_stories rehash | jq -c '{rows, updated}')"
