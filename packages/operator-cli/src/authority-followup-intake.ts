/**
 * Bridges a discovery campaign's harvested authority-host follow-up leads
 * (`DiscoveryCampaignResult.authorityFollowUps`) into research intake.
 *
 * Turns `authorityFollowUps` into intake rows, so a follow-up the harness emits becomes work
 * rather than a counter: without this bridge the leads reach only
 * `community-obscurity-run.ts`'s `authorityFollowUpTotal`, and a low-authority candidate that
 * cited a real authority host would produce a number in a summary and nothing else. It uses only
 * pieces that already exist and are already tested: `runResearchIntake` (SSRF-safe fetch via
 * `createNodeSafeFetchDependencies`, citation prefill, draft-case creation via
 * `prepareLeadIntake`, no full-text republication). No new fetch, quarantine, or catalog-write
 * logic lives here — this only loops the existing single-URL path once per lead, the same way
 * `discovery-survivor-intake.ts` loops `prepareLeadIntake` once per campaign survivor.
 */
import type { AuthorityFollowUpLead } from '@repo/domain';
import type { SafeFetchDependencies } from '@repo/security/url-safety';
import type { OperatorIntakeContext } from './intake.js';
import {
  runResearchIntake,
  type ResearchCaptureSink,
  type ResearchIntakeInput,
  type ResearchIntakeOutcome,
} from './research-intake.js';

export const AUTHORITY_FOLLOWUP_INTAKE_VERSION = 'authority-followup-intake.v1' as const;

export type AuthorityFollowUpIntakeItem = {
  readonly leadUrl: string;
  readonly host: string;
  readonly parentCandidateId: string;
  readonly parentStableIdentifier: string;
  readonly outcome: ResearchIntakeOutcome;
};

export type AuthorityFollowUpIntakeResult = {
  readonly version: typeof AUTHORITY_FOLLOWUP_INTAKE_VERSION;
  readonly considered: number;
  readonly items: readonly AuthorityFollowUpIntakeItem[];
};

export type RunAuthorityFollowUpIntakeInput = {
  readonly leads: readonly AuthorityFollowUpLead[];
  readonly context: OperatorIntakeContext;
  readonly dependencies?: SafeFetchDependencies;
  /** Present only when the caller wants a real evidence capture persisted per successful fetch (mirrors `research-intake --commit`). */
  readonly captureSink?: ResearchCaptureSink;
  /** Caps how many leads are processed in one run (default 25, matches `discovery-survivor-intake`'s `maxSurvivors`). */
  readonly maxLeads?: number;
};

function intakeInputFromLead(lead: AuthorityFollowUpLead): ResearchIntakeInput {
  return {
    url: lead.url,
    title: lead.host,
    description: `Authority follow-up (${lead.reason}) from candidate ${lead.parentStableIdentifier}`,
  };
}

/**
 * Runs the existing `runResearchIntake` once per authority follow-up lead, sequentially (each
 * intake performs a real network fetch, so leads are not run concurrently). Never commits on
 * its own: pass `captureSink` to persist a real evidence capture per successful fetch, and gate
 * any research-case commit the same way the `research-intake` CLI case does (via `--commit` at
 * the call site, not inside this function).
 */
export async function runAuthorityFollowUpIntake(
  input: RunAuthorityFollowUpIntakeInput,
): Promise<AuthorityFollowUpIntakeResult> {
  const max = Math.max(1, input.maxLeads ?? 25);
  const leads = input.leads.slice(0, max);
  const items: AuthorityFollowUpIntakeItem[] = [];

  for (const lead of leads) {
    const outcome = await runResearchIntake(
      intakeInputFromLead(lead),
      input.context,
      input.dependencies,
      input.captureSink,
    );
    items.push({
      leadUrl: lead.url,
      host: lead.host,
      parentCandidateId: lead.parentCandidateId,
      parentStableIdentifier: lead.parentStableIdentifier,
      outcome,
    });
  }

  return { version: AUTHORITY_FOLLOWUP_INTAKE_VERSION, considered: leads.length, items };
}
