-- Stamp dirty_at with the time of the write, not the time the writing transaction began.
--
-- now() is the transaction's start time. The incremental publisher opens its transaction, waits
-- on the release lock, and only then writes entities, so its stamp could be older than a stamp a
-- quicker writer had already committed. A catalog publish that advanced published_at to that newer
-- stamp then read the slow writer's commit as already published and skipped it.
--
-- clock_timestamp() is the time of this update. The update holds the watermark row's lock until
-- commit, so a later writer stamps after this one commits, and every committed stamp is newer than
-- any published_at a catalog run captured before that commit.
create or replace function ops.mark_release_catalog_dirty()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  update published.release_catalog_publish_watermark
  set dirty_at = clock_timestamp()
  where id = 'catalog';
  return null;
end;
$function$;
