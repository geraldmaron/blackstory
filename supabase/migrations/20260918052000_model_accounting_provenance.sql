BEGIN;
-- Preserve unverified historical estimates as provenance, outside billed cost aggregates.
UPDATE research.model_invocations SET price_snapshot = price_snapshot ||
  jsonb_build_object('unverifiedLegacyEstimateUsd',cost_usd_estimate)
  WHERE cost_usd_estimate IS NOT NULL;
ALTER TABLE research.model_invocations RENAME COLUMN cost_usd_estimate TO cost_usd;
UPDATE research.model_invocations SET cost_usd = NULL;
ALTER TABLE research.model_invocations
  ADD COLUMN cost_source text CHECK (cost_source IN ('provider-response','external-receipt')),
  ADD COLUMN accounting_incomplete boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT model_cost_source_required CHECK ((cost_usd IS NULL) = (cost_source IS NULL)),
  ADD CONSTRAINT model_unknown_cost_incomplete CHECK (cost_usd IS NOT NULL OR accounting_incomplete);
COMMENT ON COLUMN research.model_invocations.cost_usd IS
  'Known reported inference charges. NULL means unknown; fees and external provider bills may be separate.';
COMMIT;
