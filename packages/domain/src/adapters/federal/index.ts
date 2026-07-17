/**
 * Federal archive and public-history adapter registry (BB-046).
 * Exports adapter definitions, shared utilities, and fixture parsers for five source families.
 */
export { locAdapterDefinition, LOC_ADAPTER_ID, LOC_PARSER_VERSION } from './loc/definition.js';

export { naraAdapterDefinition, NARA_ADAPTER_ID, NARA_PARSER_VERSION } from './nara/definition.js';

export { dplaAdapterDefinition, DPLA_ADAPTER_ID, DPLA_PARSER_VERSION } from './dpla/definition.js';

export { npsAdapterDefinition, NPS_ADAPTER_ID, NPS_PARSER_VERSION } from './nps/definition.js';

export {
  schoolHistoryAdapterDefinition,
  SCHOOL_HISTORY_ADAPTER_ID,
  SCHOOL_HISTORY_PARSER_VERSION,
} from './school-history/definition.js';

export {
  buildFederalAdapterDefinition,
  DEFAULT_FEDERAL_EXPORT_FILTER,
  DEFAULT_FEDERAL_RETENTION,
  FEDERAL_GOVERNMENT_RECORD_RIGHTS,
  FEDERAL_PUBLIC_DOMAIN_RIGHTS,
  FEDERAL_SECONDARY_RIGHTS,
} from './shared/contract-builder.js';

export { filterLargeExportPayload, type ExportFilterResult } from './shared/export-filter.js';

export { buildIsolatedFederalRunResult, type BuildIsolatedRunInput } from './shared/failure-isolation.js';

export {
  FEDERAL_ADAPTER_KILL_SWITCH_PREFIX,
  federalAdapterKillSwitchId,
  parseFederalAdapterKillSwitchId,
} from './shared/kill-switch.js';

export { parseFederalFixtureBatch } from './shared/parser.js';

export { partitionByRetention, qualifiesForCandidateRetention } from './shared/retention.js';

export type {
  FederalAdapterDefinition,
  FederalAdapterFamily,
  FederalExportFilterPolicy,
  FederalParseResult,
  FederalRejectedRecord,
  FederalRetentionRules,
  IsolatedFederalRunResult,
  RawFederalExportRecord,
} from './shared/types.js';

import { dplaAdapterDefinition } from './dpla/definition.js';
import { locAdapterDefinition } from './loc/definition.js';
import { naraAdapterDefinition } from './nara/definition.js';
import { npsAdapterDefinition } from './nps/definition.js';
import { schoolHistoryAdapterDefinition } from './school-history/definition.js';
import type { FederalAdapterDefinition } from './shared/types.js';

/** All federal adapter definitions in stable registration order. */
export const FEDERAL_ADAPTER_DEFINITIONS: readonly FederalAdapterDefinition[] = [
  locAdapterDefinition,
  naraAdapterDefinition,
  dplaAdapterDefinition,
  npsAdapterDefinition,
  schoolHistoryAdapterDefinition,
] as const;

export function getFederalAdapterDefinition(adapterId: string): FederalAdapterDefinition | undefined {
  return FEDERAL_ADAPTER_DEFINITIONS.find((definition) => definition.adapterId === adapterId);
}
