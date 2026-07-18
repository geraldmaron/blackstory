
/**
 * REAL roster entry: legal change monitoring. Wraps `@repo/domain`'s legal
 * monitoring module and fixture-only adapter clients automation proposes review_queue events,
 * humans dispose. No live network in tests; live adapter wiring requires api.data.gov and
 * LegiScan keys documented as human follow-up.
 */
import {
  proposeLegalReviewEvents,
  type LegalMonitoringPriorState,
  type LegalMonitoringSourceSnapshot,
  type LegalReviewQueueEvent,
} from '../../../../domain/src/legal/index.js';
import {
  createCongressGovFixtureClient,
  createCourtListenerFixtureClient,
  createEcfrFixtureClient,
  createLegiScanFixtureClient,
} from '../../../../domain/src/adapters/legal/index.js';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';
import type { ScheduledJobDefinition } from '../types.js';

export const LEGAL_CHANGE_MONITORING_JOB_ID = 'legal-change-monitoring';

export type LegalChangeMonitoringJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly prior: readonly LegalMonitoringPriorState[];
  readonly existingDedupeKeys?: ReadonlySet<string>;
  readonly jobDefinition?: ScheduledJobDefinition;
};

export type LegalChangeMonitoringJobResult = {
  readonly run: JobRunRecord;
  readonly proposedEvents: readonly LegalReviewQueueEvent[];
  readonly summary: {
    readonly adaptersChecked: number;
    readonly monitoringRows: number;
    readonly eventsProposed: number;
  };
};

function collectMonitoringRows(): readonly LegalMonitoringSourceSnapshot[] {
  const clients = [
    createCongressGovFixtureClient(),
    createEcfrFixtureClient(),
    createCourtListenerFixtureClient(),
    createLegiScanFixtureClient(),
  ];
  return clients.flatMap((client) => client.parseFixtures().monitoringRows);
}


/**
 * Runs one legal monitoring sweep over fixture adapter outputs. Pure aside from the injected
 * prior state proposes deduped review_queue events without applying any public writes.
 */
export function runLegalChangeMonitoringJob(
  input: LegalChangeMonitoringJobInput,
): LegalChangeMonitoringJobResult {
  const started = startJobRun({
    jobId: LEGAL_CHANGE_MONITORING_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });

  const monitoringRows = collectMonitoringRows();
  const proposedEvents = proposeLegalReviewEvents({
    detectedAt: input.completedAt,
    current: monitoringRows,
    prior: input.prior,
    existingDedupeKeys: input.existingDedupeKeys,
    eventTypeBySource: {
      'congress-gov-v3': 'became_law',
      'ecfr-versioner': 'cfr_version',
      'courtlistener-bulk': 'new_opinion',
      'legiscan-free': 'bill_status_change',
    },
  });

  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: monitoringRows.length,
    itemsProcessed: monitoringRows.length,
  });

  return {
    run,
    proposedEvents,
    summary: {
      adaptersChecked: 4,
      monitoringRows: monitoringRows.length,
      eventsProposed: proposedEvents.length,
    },
  };
}
