import type {
  InvalidModelOutput,
  ModelInvocation,
  ResearchContractMap,
  ResearchContractName,
} from './contracts.js';
import { validateContract } from './contracts.js';

export interface StructuredOutputAccepted<K extends ResearchContractName> {
  readonly ok: true;
  readonly value: ResearchContractMap[K];
}

export interface StructuredOutputQuarantined {
  readonly ok: false;
  readonly quarantine: InvalidModelOutput;
}

export type StructuredOutputResult<K extends ResearchContractName> =
  StructuredOutputAccepted<K> | StructuredOutputQuarantined;

export interface ParseStructuredOutputInput<K extends ResearchContractName> {
  readonly contract: K;
  readonly invocation: ModelInvocation;
  readonly quarantineId: string;
  readonly now: Date;
  readonly retentionDays: number;
}

function quarantine(
  input: ParseStructuredOutputInput<ResearchContractName>,
  validationErrors: readonly string[],
): StructuredOutputQuarantined {
  const retentionUntil = new Date(input.now);
  retentionUntil.setUTCDate(retentionUntil.getUTCDate() + input.retentionDays);
  return {
    ok: false,
    quarantine: {
      schemaVersion: '1.0.0',
      id: input.quarantineId,
      invocationId: input.invocation.id,
      rawOutput: input.invocation.rawResponse,
      validationErrors,
      quarantinedAt: input.now.toISOString(),
      retentionUntil: retentionUntil.toISOString(),
    },
  };
}

/**
 * Parse exactly one provider response as JSON. This intentionally performs no
 * brace scanning, markdown stripping, coercion, or silent repair.
 */
export function parseStructuredModelOutput<K extends ResearchContractName>(
  input: ParseStructuredOutputInput<K>,
): StructuredOutputResult<K> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.invocation.rawResponse) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown JSON parse error';
    return quarantine(input, [`Invalid JSON: ${detail}`]);
  }

  const validation = validateContract(input.contract, parsed);
  if (!validation.ok) return quarantine(input, validation.errors);
  return { ok: true, value: validation.value };
}

/** A repair is a new invocation and must retain an explicit link to the invalid original. */
export function assertSeparateRepairInvocation(
  original: ModelInvocation,
  repair: ModelInvocation,
): void {
  if (original.id === repair.id || original.activityId === repair.activityId) {
    throw new Error('A repair must be recorded as a separate invocation and activity');
  }
  if (repair.repairOfInvocationId !== original.id) {
    throw new Error('A repair must reference the original invocation');
  }
}
