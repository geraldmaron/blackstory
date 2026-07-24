-- repo-xez5.2: model routing policy + invocation logging.
-- bb_research.model_invocations already tracks provider/model/price_snapshot but has no
-- queryable token-count or cost columns, so a spend-by-lane/model report has nothing to
-- aggregate. Add nullable columns the routing module's logger populates on every call;
-- nullable because pre-existing non-LLM activity rows never wrote to this table (0 rows today).
ALTER TABLE bb_research.model_invocations
  ADD COLUMN IF NOT EXISTS lane text,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS prompt_tokens integer CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  ADD COLUMN IF NOT EXISTS completion_tokens integer CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  ADD COLUMN IF NOT EXISTS cost_usd_estimate numeric(12, 6) CHECK (cost_usd_estimate IS NULL OR cost_usd_estimate >= 0);

CREATE INDEX IF NOT EXISTS model_invocations_lane_model_idx
  ON bb_research.model_invocations (lane, model_id);
