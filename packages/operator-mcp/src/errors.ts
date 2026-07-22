/**
 * Operator MCP tool error codes from docs/research/operator-mcp-indicator-contracts.md.
 */

export const OPERATOR_MCP_ERROR_CODES = [
  'unknown_metric',
  'unknown_jurisdiction',
  'boundary_mismatch',
  'forbidden_causal',
  'invalid_input',
] as const;

export type OperatorMcpErrorCode = (typeof OPERATOR_MCP_ERROR_CODES)[number];

export class OperatorMcpError extends Error {
  readonly code: OperatorMcpErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: OperatorMcpErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OperatorMcpError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function formatOperatorMcpError(error: OperatorMcpError): {
  readonly code: OperatorMcpErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
} {
  return {
    code: error.code,
    message: error.message,
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
}
