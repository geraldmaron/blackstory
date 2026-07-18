
/**
 * Composes the real safe fetch + citation prefill + draft-case creation into one
 * operator workflow: "take a URL/topic, run it through capture + citation scaffolding + draft-
 * case creation." This is pure composition no new fetch, quarantine, or case logic lives
 * here. It only sequences `runQuickAddFetch`, `buildCitationPrefill`, `planSelectiveCapture`,
 * and `prepareLeadIntake`, each already real and independently tested in this package.
 *
 * Used by both the `research-intake` CLI command and the admin quick-add route, so the two
 * surfaces the brief asks for (Claude/CLI session, admin console) share one implementation.
 */
import type { SafeFetchDependencies, SafeFetchResult } from '@blap/security';
import {
  buildCitationPrefill,
  createNodeSafeFetchDependencies,
  planSelectiveCapture,
  runQuickAddFetch,
  type CapturePlan,
  type CitationPrefill,
} from './fetch.js';
import {
  prepareLeadIntake,
  type OperatorIntakeContext,
  type OperatorIntakeOutcome,
} from './intake.js';

export type ResearchIntakeInput = {
  readonly url: string;
  readonly title?: string;
  readonly description?: string;
  readonly location?: string;
  readonly era?: string;
  readonly targetRecordId?: string;
  readonly submitterContact?: string;
};

export type ResearchIntakeOutcome = {
  readonly fetch: SafeFetchResult;
  readonly citation?: CitationPrefill;
  readonly capturePlan?: CapturePlan;
  readonly intake?: OperatorIntakeOutcome;
};


/**
 * Fetches `input.url` through, pre-fills citation metadata from what comes back, notes
 * the (unwired) capture-plan integration point, then opens a draft research case through the
 * same `prepareLeadIntake` path `submit-lead` uses. If the fetch is denied, no intake is
 * attempted the caller sees exactly why (`fetch.reason`) and nothing is proposed.
 */
export async function runResearchIntake(
  input: ResearchIntakeInput,
  context: OperatorIntakeContext,
  dependencies: SafeFetchDependencies = createNodeSafeFetchDependencies(),
): Promise<ResearchIntakeOutcome> {
  const fetchResult = await runQuickAddFetch(input.url, dependencies);
  if (!fetchResult.ok) {
    return { fetch: fetchResult };
  }

  const now = new Date(context.nowMs ?? Date.now()).toISOString();
  const citation = buildCitationPrefill(input.url, fetchResult, now);
  const capturePlan = planSelectiveCapture(fetchResult);

  const title = input.title ?? citation.suggestedTitle;
  const description = input.description?.trim() || citation.excerpt;
  const location = input.location;
  const era = input.era;
  const targetRecordId = input.targetRecordId;
  const submitterContact = input.submitterContact;

  const intake = prepareLeadIntake(
    {
      title,
      description,
      url: input.url,
      ...(location ? { location } : {}),
      ...(era ? { era } : {}),
      ...(targetRecordId ? { targetRecordId } : {}),
      ...(submitterContact ? { submitterContact } : {}),
    },
    context,
  );

  return { fetch: fetchResult, citation, capturePlan, intake };
}
