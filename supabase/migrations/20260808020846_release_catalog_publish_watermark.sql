-- Event-driven signal for the release-catalog CDN artifact publisher (repo-csw0 follow-up).
--
-- Content in bb_public.release_entities / bb_public.search_index is mutated in place by
-- ~19 ad hoc scripts under packages/ops-data/scripts, none of which go through a shared write
-- path or bump bb_public.active_release.activated_at. Without a signal, keeping the CDN
-- artifact (public-media/public/releases/{releaseId}/entities.json) fresh means either a blind
-- poll-and-republish-everything timer (wastes a full 13MB rebuild + upload on every tick, most
-- of which are no-ops) or a true DB-initiated webhook (pg_net + an outbound secret living
-- inside Postgres, plus real risk of flooding a webhook during a bulk backfill that touches
-- thousands of rows in one script run).
--
-- This is the middle path: a STATEMENT-level trigger marks a single-row watermark dirty on any
-- write, regardless of how many rows the statement touched. The publisher (a scheduled GitHub
-- Actions job) can then poll this watermark cheaply and frequently — a single-row SELECT costs
-- nothing — and only pay for the expensive full catalog rebuild + Storage upload when
-- dirty_at is newer than published_at.

create table if not exists bb_public.release_catalog_publish_watermark (
  id text primary key default 'catalog',
  dirty_at timestamptz,
  published_at timestamptz,
  published_entities_hash text,
  published_search_index_hash text,
  constraint release_catalog_publish_watermark_singleton check (id = 'catalog')
);

insert into bb_public.release_catalog_publish_watermark (id, dirty_at, published_at)
values ('catalog', now(), null)
on conflict (id) do nothing;

-- Locked down: no policies, so only postgres / service_role (RLS-bypass roles) can touch it.
-- This is purely internal publisher state, never read by the public API surface.
alter table bb_public.release_catalog_publish_watermark enable row level security;

create or replace function bb_ops.mark_release_catalog_dirty()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update bb_public.release_catalog_publish_watermark
  set dirty_at = now()
  where id = 'catalog';
  return null;
end;
$$;

drop trigger if exists release_entities_mark_catalog_dirty on bb_public.release_entities;
create trigger release_entities_mark_catalog_dirty
  after insert or update or delete on bb_public.release_entities
  for each statement execute function bb_ops.mark_release_catalog_dirty();

drop trigger if exists search_index_mark_catalog_dirty on bb_public.search_index;
create trigger search_index_mark_catalog_dirty
  after insert or update or delete on bb_public.search_index
  for each statement execute function bb_ops.mark_release_catalog_dirty();
