/**
 * Fixed operator MCP copy for juxtaposition and observation payloads.
 * Matches docs/methodology/juxtaposition-not-causation.md.
 */

export { JUXTAPOSITION_DISCLAIMER } from '@repo/domain/juxtaposition';

export const OBSERVATIONS_DISCLAIMER =
  'Values are transcribed published statistics, not BlackStory judgments.';

export const FORBIDDEN_CAUSAL_METHODOLOGY_POINTER =
  'Automated causal impact estimates are not available. See docs/methodology/juxtaposition-not-causation.md — juxtapose published indicators with heritage entities; causal claims require separately evidenced heritage claims.';

export const DEFAULT_OBSERVATION_LIMIT = 100;
export const MAX_OBSERVATION_LIMIT = 500;
