/**
 * Commits a prepared operator intake outcome through the real audit/outbox path.
 *
 * This is the ONLY function in this package that writes anything. It calls the existing
 * `commitWithAudit` from the Postgres data-access boundary, preserving the same
 * atomic audit+outbox+idempotency transaction every other BlackStory writer uses instead of
 * reimplementing any part of it. There is no function anywhere in this package that publishes,
 * promotes, or approves anything; see `promotion-boundary.test.ts`.
 */
import { commitWithAudit, type AtomicStore, type CommitWithAuditResult } from '@repo/data-access';
import type { OperatorIntakeAccepted } from './intake.js';

/** Commits one accepted operator intake outcome. Rejected outcomes have nothing to commit. */
export async function commitOperatorIntake(
  store: AtomicStore,
  outcome: OperatorIntakeAccepted,
): Promise<CommitWithAuditResult> {
  return commitWithAudit(store, {
    mutations: outcome.mutations,
    auditEvent: outcome.auditEvent,
    outboxMessage: outcome.outboxMessage,
  });
}
