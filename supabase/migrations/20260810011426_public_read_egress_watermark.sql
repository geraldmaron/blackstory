-- Watermark for the public-read egress monitor (follow-up to the 2026-08-07 egress incident).
--
-- Why this exists: between 2026-07-21 and 2026-08-09, `SELECT projection FROM
-- bb_public.release_entities` ran 49,226 times for 140.6M rows, about 253GB of egress and ~80%
-- of all query time on the project. Nothing detected it. It was found by hand, 20 days in,
-- after the bill. Every fix that followed is a fix to the *cause*; this table is what makes a
-- recurrence visible, which is the part that was actually missing.
--
-- Same reasoning as `.github/workflows/canonical-convergence-monitor.yml`: the failure mode was
-- not that the code was wrong, it was that nothing was watching.
--
-- pg_stat_statements counters are cumulative since `stats_reset`, so a threshold on the raw
-- totals cannot tell a spike today from a spike three weeks ago. The monitor needs a delta, and
-- a delta needs somewhere to remember the last reading. That is all this is.
--
-- Deliberately keyed by a stable label rather than by `queryid`: queryid is a hash of the
-- normalized statement and changes whenever the SQL text is edited, which would silently reset
-- the baseline to zero on an unrelated refactor and hide exactly the regression this watches for.

create table if not exists bb_ops.public_read_egress_watermark (
  -- Stable name for the read being watched (e.g. 'release_entities_full_catalog').
  label text primary key,
  -- Raw pg_stat_statements counters at capture time.
  calls bigint not null,
  rows_returned bigint not null,
  -- Detects a counter reset (server restart, extension reset, pg_stat_statements eviction).
  -- Without this, a reset reads as a huge negative delta and the monitor reports a false green.
  stats_since timestamptz not null,
  captured_at timestamptz not null default now()
);

-- Internal ops state, same posture as bb_public.release_catalog_publish_watermark: RLS on with
-- no policies, so only RLS-bypassing roles (postgres / service_role) can read or write it.
-- Nothing on the public API surface reads this. Do not add a policy to silence advisor 0008.
alter table bb_ops.public_read_egress_watermark enable row level security;

comment on table bb_ops.public_read_egress_watermark is
  'Last pg_stat_statements reading per watched public read, so the egress monitor can compute a '
  'delta. RLS enabled with no policies ON PURPOSE (service_role only).';
