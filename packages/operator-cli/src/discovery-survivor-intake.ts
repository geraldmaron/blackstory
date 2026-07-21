/**
 * Bridge discovery campaign survivors into operator lead intake (draft research cases).
 *
 * Maps accepted/merged discovery candidates with a canonical URL into prepareLeadIntake
 * outcomes. Callers must pass accepted outcomes to commitOperatorIntake to persist —
 * this module never writes canonical records and never publishes.
 */
import {
  listCampaignSurvivors,
  toEditorialLeadPreview,
  type DiscoveryCampaignResult,
  type DiscoveryCandidateRecord,
} from '@repo/domain';
import {
  prepareLeadIntake,
  type OperatorIntakeContext,
  type OperatorIntakeOutcome,
} from './intake.js';

export const DISCOVERY_SURVIVOR_INTAKE_VERSION = 'discovery-survivor-intake.v1' as const;

export type DiscoverySurvivorIntakeItem = {
  readonly candidateId: string;
  readonly title: string;
  readonly url: string;
  readonly summary?: string;
  readonly outcome: OperatorIntakeOutcome;
};

export type DiscoverySurvivorIntakeResult = {
  readonly version: typeof DISCOVERY_SURVIVOR_INTAKE_VERSION;
  readonly considered: number;
  readonly prepared: number;
  readonly skippedNoUrl: number;
  readonly skippedRejected: number;
  readonly items: readonly DiscoverySurvivorIntakeItem[];
};

export type PrepareDiscoverySurvivorIntakeInput = {
  readonly campaign: DiscoveryCampaignResult;
  readonly context: OperatorIntakeContext;
  /** Cap how many survivors become draft cases (default 25). */
  readonly maxSurvivors?: number;
};

function leadFromSurvivor(candidate: DiscoveryCandidateRecord):
  | {
      readonly title: string;
      readonly url: string;
      readonly description: string;
    }
  | undefined {
  const preview = toEditorialLeadPreview(candidate);
  const url = preview.canonicalUrl?.trim();
  if (!url) return undefined;
  const title = preview.title?.trim() || preview.candidateId;
  const summary = preview.summary?.trim();
  const description = [
    summary ?? 'Discovery survivor awaiting research triage.',
    `Discovery candidate id: ${candidate.id}`,
    `Source adapter: ${candidate.adapterRecord.provenance.adapterId}`,
  ].join('\n\n');
  return { title, url, description };
}

/**
 * Prepare (do not commit) lead intake + draft research cases for campaign survivors.
 */
export function prepareDiscoverySurvivorIntake(
  input: PrepareDiscoverySurvivorIntakeInput,
): DiscoverySurvivorIntakeResult {
  const max = Math.max(1, input.maxSurvivors ?? 25);
  const survivors = listCampaignSurvivors(input.campaign).slice(0, max);
  const items: DiscoverySurvivorIntakeItem[] = [];
  let skippedNoUrl = 0;
  let skippedRejected = 0;

  for (const survivor of survivors) {
    const lead = leadFromSurvivor(survivor);
    if (!lead) {
      skippedNoUrl += 1;
      continue;
    }
    const outcome = prepareLeadIntake(
      {
        title: lead.title,
        description: lead.description,
        url: lead.url,
      },
      input.context,
    );
    if (!outcome.accepted) {
      skippedRejected += 1;
      continue;
    }
    items.push({
      candidateId: survivor.id,
      title: lead.title,
      url: lead.url,
      ...(lead.description ? { summary: lead.description.slice(0, 200) } : {}),
      outcome,
    });
  }

  return {
    version: DISCOVERY_SURVIVOR_INTAKE_VERSION,
    considered: survivors.length,
    prepared: items.length,
    skippedNoUrl,
    skippedRejected,
    items,
  };
}
