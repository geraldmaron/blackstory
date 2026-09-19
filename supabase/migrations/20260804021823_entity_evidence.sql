-- repo-n7p6.3 (WS3): raw evidence captured for the entity-depth enrichment epic.
--
-- The audit behind repo-n7p6 found the released catalog was built with no evidence-fetch step
-- at all: lane records were published from deterministic string templates over registry index
-- fields (see backfill-nrhp-black-heritage-summaries.ts, whose own header explains it exists
-- only to satisfy the non-empty-summary publish gate). This table is where the missing step
-- lands its output. WS4's model harness reads ONLY from here, so every enriched sentence it
-- writes is traceable to a row in this table — that is the whole point of "evidence-first".
--
-- entity_id join strategy matches bb_research.entity_enrichment (WS2): plain text, no FK.
-- landscape_candidates.id, bb_canonical.entities.id and bb_public.release_entities.entity_id
-- are one id space, and evidence is fetched for candidates that may not be released yet, so a
-- hard FK to any one of those tables would reject legitimate rows. See the entity_enrichment
-- migration comment for the full reasoning.
--
-- content_text holds source prose verbatim. Every source written here must be public domain
-- (US federal works: NPS nomination forms, LOC) or an open license recorded in provenance
-- (CC BY-SA for Wikipedia). Licence-bearing text is why provenance is NOT NULL: WS4 output
-- carries attribution derived from it, and a row with no provenance cannot be attributed.
CREATE TABLE bb_research.entity_evidence (
  id text PRIMARY KEY,
  entity_id text NOT NULL,
  lane text,
  -- Which collector produced the row ('nrhp-nomination', 'wikipedia', 'search-agent', ...).
  collector text NOT NULL,
  source_url text NOT NULL,
  -- tier1 = federal/state government, courts, official archives (isTier1Host in
  -- scripts/lib/tier1-sources.ts). tier2 = reputable secondary (state encyclopedias,
  -- universities, historical societies). lead = off-policy host recorded for a human to judge;
  -- a 'lead' row is deliberately NOT evidence and WS4 must never read one.
  source_tier text NOT NULL CHECK (source_tier IN ('tier1', 'tier2', 'lead')),
  title text,
  content_text text,
  -- sha256 of normalized content_text. Drives both resumability (re-running fetches nothing
  -- already stored) and the evidence_digest the WS2 ledger compares to decide "nothing
  -- changed, skip the model call".
  content_hash text,
  char_count integer,
  -- Heuristic 0-1 score from lib/evidence-collectors/text-quality.ts. NPS nomination PDFs are
  -- scanned-then-OCR'd and quality varies by form vintage; low scores are quarantined rather
  -- than fed to a model that would confidently launder OCR noise into public prose.
  quality_score numeric,
  status text NOT NULL DEFAULT 'captured'
    CHECK (status IN ('captured', 'quarantined', 'superseded')),
  provenance jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per (entity, collector, source). A re-run UPSERTs rather than accumulating
-- duplicate captures of the same document.
CREATE UNIQUE INDEX entity_evidence_entity_collector_url_key
  ON bb_research.entity_evidence (entity_id, collector, source_url);

CREATE INDEX entity_evidence_entity_idx ON bb_research.entity_evidence (entity_id);
CREATE INDEX entity_evidence_lane_idx ON bb_research.entity_evidence (lane);
CREATE INDEX entity_evidence_status_idx ON bb_research.entity_evidence (status);
CREATE INDEX entity_evidence_content_hash_idx ON bb_research.entity_evidence (content_hash);

ALTER TABLE bb_research.entity_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_evidence_staff_select ON bb_research.entity_evidence
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));

REVOKE INSERT, UPDATE, DELETE ON bb_research.entity_evidence FROM authenticated;
GRANT SELECT ON bb_research.entity_evidence TO authenticated;
GRANT ALL ON bb_research.entity_evidence TO service_role;
