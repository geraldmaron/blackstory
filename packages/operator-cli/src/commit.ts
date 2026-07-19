
/**
 * Commits a prepared operator intake outcome through the real audit/outbox path.
 *
 * This is the ONLY function in this package that writes anything. It calls the existing
 * `commitWithAudit` (packages/firebase/src/firestore/audit-outbox.ts) directly the same
 * atomic audit+outbox+idempotency transaction every other BlackStory writer uses instead of
 * reimplementing any part of it. There is no function anywhere in this package that publishes,
 * promotes, or approves anything; see `promotion-boundary.test.ts`.
 */
import {
  commitWithAudit,
  type AtomicStore,
  type AuditEventDoc,
  type CommitWithAuditResult,
} from '@repo/firebase';
import type { OperatorIntakeAccepted } from './intake.js';

/** Commits one accepted operator intake outcome. Rejected outcomes have nothing to commit. */
export async function commitOperatorIntake(
  store: AtomicStore,
  outcome: OperatorIntakeAccepted,
): Promise<CommitWithAuditResult> {
  return commitWithAudit(store, {
    mutations: outcome.mutations,
    // `@repo/domain`'s `AuditEventAction`/category union has drifted ahead of
    // `@repo/firebase`'s zod-inferred `AuditEventDoc` (it now includes a `deletion`
    // category the Firestore schema doesn't yet declare). This package only ever produces
    // `research.created` `source.registered` events (see `AUDIT_ACTION_BY_PROPOSAL` in
    // `intake.ts`), both valid under either union, so this narrowing cast is safe today
    // but the drift itself is a pre-existing cross-package gap outside this package's
    // ownership, worth reconciling in `packages/firebase/src/firestore/types.ts` separately.
    auditEvent: outcome.auditEvent as unknown as AuditEventDoc,
    outboxMessage: outcome.outboxMessage,
  });
}
