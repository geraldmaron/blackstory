-- repo-n9dq: a terminal ledger status for evidence that was captured, verified as belonging to
-- the entity, read by a drafter, and found to carry no Black-history significance for its lane.
--
-- Until now the harness had no way to record that outcome. Its only options were to draft
-- architectural padding to clear the 120-character summary floor — the exact failure the
-- enrichment effort exists to undo — or to write nothing, leaving the row 'pending' so every
-- later sweep and every drafting wave re-selected it and re-spent on it. Measured: wave 4's
-- 40-subject selection contained 8 of wave 3's own refusals, at the top of the list, because a
-- refused subject keeps whatever evidence volume put it there in the first place.
--
-- Distinct from 'skipped', which means the entity has no usable evidence to read. This status
-- asserts the opposite and stronger thing: the evidence WAS read, and the judgement about it is
-- finished. The two must not be merged, because they imply different follow-up — 'skipped' wants
-- a re-sweep, this wants nothing until the sources change.
--
-- Terminal, not permanent. entity_enrichment.evidence_digest records exactly which evidence the
-- judgement was made about, so a later sweep that captures a new source changes the digest and
-- the row can be reopened by comparing the two. The refusal expires when its input does.
ALTER TABLE bb_research.entity_enrichment
  DROP CONSTRAINT entity_enrichment_status_check;

ALTER TABLE bb_research.entity_enrichment
  ADD CONSTRAINT entity_enrichment_status_check
  CHECK (status IN ('pending', 'enriched', 'quarantined', 'skipped', 'no-lane-significance'));
