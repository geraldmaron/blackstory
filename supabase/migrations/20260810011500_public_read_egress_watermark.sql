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

-- Added in the same session, after the monitor's own end-to-end test caught the gap.
--
-- The table above deliberately avoids keying on `queryid`, because queryid changes whenever the
-- SQL text is edited and would silently re-baseline. The same hazard applies one level up: the
-- monitor matches statements by a LIKE fingerprint, and editing a fingerprint changes which
-- statements the counters cover. Observed live: correcting an over-broad fingerprint made the
-- next run compare the new population against the old one's stored total and report 20 days of
-- accumulated traffic as a single day's egress, i.e. a false alarm at ~6x budget.
--
-- Storing the fingerprint alongside the counters lets the monitor notice that the baseline is
-- not comparable and re-baseline instead of alerting on an artefact.
alter table bb_ops.public_read_egress_watermark
  add column if not exists fingerprint text;

comment on column bb_ops.public_read_egress_watermark.fingerprint is
  'The LIKE pattern the stored counters were captured under. When the monitor edits a '
  'fingerprint, the previous counters describe a different set of statements and the delta '
  'between them is meaningless; comparing this column forces a re-baseline instead.';
