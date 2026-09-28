-- The public /data page reads reference.statistical_observations (data-page-indicators.ts), and
-- the anon policy on it looks up reference.statistical_series. `anon` has those policies but no
-- table grant, so under `postgres` the read only worked because postgres bypasses everything.
-- Found by the parity probe for web_public (repo-mzvhp): the query swallows errors and returns
-- [], so a missing grant would have emptied the page silently rather than failing.
-- Granted to web_public only; the anon data API surface is unchanged.
BEGIN;
GRANT USAGE ON SCHEMA reference TO web_public;
GRANT SELECT ON reference.statistical_observations, reference.statistical_series TO web_public;
COMMIT;
