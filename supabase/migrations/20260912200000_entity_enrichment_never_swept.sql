-- repo-n7p6.21: a status for ledger rows that were never picked up by a sweep at all.
--
-- 20260811170000 taught the ledger 'no-lane-significance' — evidence was read, and the
-- judgement about it is finished. This is the other end of the same distinction: 'pending'
-- with lane IS NULL means no sweep has ever touched the entity, so there is no evidence to
-- judge and nothing for WS4 to read. Reconciled 2026-09-12: the pending pool has been
-- shrinking (1,196 -> 903 since 2026-08-18) but the lane=NULL residue has not gone to zero
-- (411 -> 349) -- these are not "about to be enriched", they are "never entered a lane".
--
-- Left merged into plain 'pending', a naive read of the ledger (or a future 'bd ready'-style
-- query run against it) overestimates how much is actually ready, exactly as the original
-- filing warned. Deriving the distinction at query time was rejected (owner ruling,
-- 2026-09-12): every consumer would have to remember lane IS NULL means something different
-- from lane IS NOT NULL, and WS4 runs against this column at scale.
--
-- Not terminal in the way 'no-lane-significance' is: a sweep can pick these rows up at any
-- time, at which point normal lane assignment moves them out of 'never_swept' the same way it
-- already moves rows out of plain 'pending'.
ALTER TABLE bb_research.entity_enrichment
  DROP CONSTRAINT entity_enrichment_status_check;

ALTER TABLE bb_research.entity_enrichment
  ADD CONSTRAINT entity_enrichment_status_check
  CHECK (status IN ('pending', 'enriched', 'quarantined', 'skipped', 'no-lane-significance', 'never_swept'));

-- Backfill: the 349 rows this status exists for -- status='pending' with no lane ever
-- assigned, i.e. no sweep has ever touched them. Scoped narrowly by the same predicate the
-- 2026-09-12 reconciliation measured (lane IS NULL); rows already carrying a lane, however
-- stale, are untouched here.
UPDATE bb_research.entity_enrichment
SET status = 'never_swept',
    updated_at = now()
WHERE status = 'pending'
  AND lane IS NULL;
