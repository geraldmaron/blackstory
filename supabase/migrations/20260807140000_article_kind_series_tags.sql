-- Stories: chapters and record articles in one table.
--
-- The long-form surface now publishes two editorial contracts out of the same storage:
-- `chapter` (the era-immersion pieces, 2,000-word floor, second-person era structure) and
-- `article` (a short record entry: a paragraph of context plus individually-cited
-- call-outs). They share a table because they share everything that matters downstream —
-- the body-block renderer, the citation-integrity gate, the source-tier registry, and the
-- release projection. Only the gates and the index presentation branch on kind.
--
-- `kind` defaults to 'chapter' so every row authored before this migration keeps the
-- contract it was written under without a backfill.
--
-- `series` carries membership in an ordered collection (id, label, position,
-- positionLabel). Position is the collection's own ordering key — presidency number, not
-- publication date — so an index can present the series in the order its subject runs in.
-- Stored as jsonb rather than a side table: a series has no independent lifecycle, no
-- rows of its own, and is always read with the article.
--
-- `tags` are free facet labels the index groups and filters on.

alter table bb_reference.articles
  add column if not exists kind text not null default 'chapter',
  add column if not exists series jsonb,
  add column if not exists tags text[] not null default '{}';

alter table bb_reference.articles
  drop constraint if exists articles_kind_check;
alter table bb_reference.articles
  add constraint articles_kind_check check (kind in ('chapter', 'article'));

-- Position must be unique within a series: two entries claiming one slot sort
-- nondeterministically, which reads to a visitor as a broken collection. Enforced here as
-- well as in the authoring CLI, because the CLI only sees the fixtures in one invocation
-- while this sees every row.
create unique index if not exists articles_series_position_unique
  on bb_reference.articles ((series ->> 'id'), ((series ->> 'position')::int))
  where series is not null;

create index if not exists articles_kind_idx on bb_reference.articles (kind);
create index if not exists articles_series_id_idx on bb_reference.articles ((series ->> 'id'))
  where series is not null;

comment on column bb_reference.articles.kind is
  'Editorial contract: chapter (long-form, prose floor) or article (record entry, cited call-outs).';
comment on column bb_reference.articles.series is
  'Optional ordered-collection membership: {id, label, position, positionLabel}.';
comment on column bb_reference.articles.tags is
  'Free facet labels the stories index groups and filters on.';

-- The public projection is a frozen payload, so release_articles needs no new columns.
-- kind and series ride inside payload and are surfaced for filtering by generated
-- columns, which keeps the index query sargable without a second write path.
alter table bb_public.release_articles
  add column if not exists kind text
    generated always as (coalesce(payload ->> 'kind', 'chapter')) stored,
  add column if not exists series_id text
    generated always as (payload -> 'series' ->> 'id') stored;

create index if not exists release_articles_kind_idx
  on bb_public.release_articles (release_id, kind);
create index if not exists release_articles_series_idx
  on bb_public.release_articles (release_id, series_id)
  where series_id is not null;
