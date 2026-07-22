/**
 * Reject client requests that ask for automated causal impact estimates.
 */
import { FORBIDDEN_CAUSAL_METHODOLOGY_POINTER } from '../constants.js';
import { OperatorMcpError } from '../errors.js';

const CAUSAL_FIELD_NAMES = new Set([
  'impactOf',
  'causalEffect',
  'computeImpact',
  'estimateImpact',
  'effectSize',
]);

const CAUSAL_TEXT_PATTERN =
  /\b(impact of|effect of|caused by|causal impact|how much did .+ (cause|affect|change))\b/i;

export function assertNoForbiddenCausalRequest(input: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(input)) {
    if (CAUSAL_FIELD_NAMES.has(key)) {
      throw new OperatorMcpError(
        'forbidden_causal',
        FORBIDDEN_CAUSAL_METHODOLOGY_POINTER,
        { field: key },
      );
    }
    if (typeof value === 'string' && CAUSAL_TEXT_PATTERN.test(value)) {
      throw new OperatorMcpError(
        'forbidden_causal',
        FORBIDDEN_CAUSAL_METHODOLOGY_POINTER,
        { field: key, value },
      );
    }
  }
}
