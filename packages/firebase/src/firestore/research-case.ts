
/**
 * Enforces server-side research-case permissions before executing domain transitions,
 * publication promotion, retraction, assignment, evidence, preview, or backfill work.
 */
import {
  assertAdminPermission,
  assertRecentReauth,
  type RecentReauthOptions,
  type VerifiedAdminToken,
} from '../admin-auth.js';

export const RESEARCH_CASE_SERVER_ACTIONS = [
  'assign',
  'record_evidence',
  'transition',
  'preview',
  'schedule_backfill',
  'promote',
  'retract',
] as const;

export type ResearchCaseServerAction = (typeof RESEARCH_CASE_SERVER_ACTIONS)[number];

export type ServerResearchCaseState =
  | 'candidate'
  | 'relevance_review'
  | 'relevance_confirmed'
  | 'minimum_record'
  | 'partial_enrichment'
  | 'substantial_enrichment'
  | 'insufficient_evidence'
  | 'excluded'
  | 'merged'
  | 'retracted';

const RESEARCH_ACTIONS = new Set<ResearchCaseServerAction>([
  'assign',
  'record_evidence',
  'transition',
  'preview',
  'schedule_backfill',
]);

export function assertResearchCaseActionAuthorized(
  token: VerifiedAdminToken,
  action: ResearchCaseServerAction,
  options: RecentReauthOptions = {},
): void {
  if (RESEARCH_ACTIONS.has(action)) {
    assertAdminPermission(token, 'research:write');
    return;
  }
  if (action === 'promote') {
    assertRecentReauth(token, 'publication', options);
    return;
  }
  assertRecentReauth(token, 'retraction', options);
}

export function assertResearchCaseTransitionAuthorized(
  token: VerifiedAdminToken,
  targetState: ServerResearchCaseState,
  options: RecentReauthOptions = {},
): void {
  if (targetState === 'retracted') {
    assertResearchCaseActionAuthorized(token, 'retract', options);
    return;
  }
  assertResearchCaseActionAuthorized(token, 'transition', options);
}


/**
 * Executes a domain transition only after server authorization and verifies that the
 * domain operation reached the requested state. Clients cannot bypass either check.
 */
export function executeAuthorizedResearchCaseTransition<TRecord extends { readonly state: string }>(
  token: VerifiedAdminToken,
  record: TRecord,
  targetState: ServerResearchCaseState,
  transition: (record: TRecord) => TRecord,
  options: RecentReauthOptions = {},
): TRecord {
  assertResearchCaseTransitionAuthorized(token, targetState, options);
  const result = transition(record);
  if (result.state !== targetState) {
    throw new Error(
      `Research-case transition returned ${result.state} instead of requested ${targetState}`,
    );
  }
  return result;
}

/** Executes a non-transition workflow operation after its server permission gate. */
export function executeAuthorizedResearchCaseAction<T>(
  token: VerifiedAdminToken,
  action: Exclude<ResearchCaseServerAction, 'transition'>,
  operation: () => T,
  options: RecentReauthOptions = {},
): T {
  assertResearchCaseActionAuthorized(token, action, options);
  return operation();
}
