/**
 * get_entity_context — juxtapose an entity with curated indicator bindings.
 */
import { JUXTAPOSITION_DISCLAIMER } from '../constants.js';
import type { IndicatorDbReader } from '../db/types.js';
import { OperatorMcpError } from '../errors.js';
import { mapEntityBinding } from '../mappers.js';
import type { EntityContextBinding, GetEntityContextInput } from '../types.js';
import { assertNoForbiddenCausalRequest } from './causal-guard.js';

export async function getEntityContext(
  reader: IndicatorDbReader,
  input: GetEntityContextInput,
): Promise<{
  readonly entityId: string;
  readonly bindings: readonly EntityContextBinding[];
  readonly juxtapositionDisclaimer: string;
}> {
  assertNoForbiddenCausalRequest(input as unknown as Record<string, unknown>);

  const entityId = input.entityId?.trim();
  if (!entityId) {
    throw new OperatorMcpError('invalid_input', 'entityId is required');
  }

  const bindingRows = await reader.listEntityBindings(
    entityId,
    input.purpose?.trim() || undefined,
  );

  const bindings: EntityContextBinding[] = [];
  for (const row of bindingRows) {
    const observation = await reader.resolveObservation({
      metricId: row.metric_id,
      jurisdictionId: row.jurisdiction_id,
      ...(input.referencePeriod !== undefined ? { referencePeriod: input.referencePeriod } : {}),
    });
    bindings.push(mapEntityBinding(row, observation));
  }

  return {
    entityId,
    bindings,
    juxtapositionDisclaimer: JUXTAPOSITION_DISCLAIMER,
  };
}
