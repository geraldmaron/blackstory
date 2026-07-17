/**
 * Shared types for legal source adapters (Congress.gov, eCFR, CourtListener, LegiScan).
 */
import type { LegalMonitoringSourceSnapshot } from '../../legal/monitoring.js';
import type { LegalSnapshot } from '../../legal/types.js';

export type LegalAdapterParseResult = {
  readonly snapshots: readonly LegalSnapshot[];
  readonly monitoringRows: readonly LegalMonitoringSourceSnapshot[];
};

export type LegalFixtureClient = {
  readonly adapterId: string;
  parseFixtures(): LegalAdapterParseResult;
};
