
/**
 * Operator identity and session stamping for proposer contribution lane.
 *
 * Every record an operator proposes (lead, source registration, evidence, bulk-import row)
 * carries who proposed it and which session proposed it, so audit events and
 * quarantine records stay attributable even though the pipeline that receives them is the
 * same one every other proposer (public submitter, adapter) uses.
 *
 * Invariant this module protects: an `OperatorIdentity` is a *proposer* identity only. It is
 * never accepted anywhere a `VerifiedAdminToken` (packages/firebase/src/admin-auth.ts) or a
 * fresh-reauth approver identity is required see promotion-boundary.test.ts.
 */
import type { AuditActor } from '@repo/domain';

export const OPERATOR_SOURCES = ['claude_session', 'cursor_session', 'cli', 'admin_console'] as const;

/** Where the operator proposal originated. Never a `system`/automated-worker actor type. */
export type OperatorSource = (typeof OPERATOR_SOURCES)[number];

export type OperatorIdentity = {
  /** Stable id for the human operator (or the Claude session acting on their behalf). */
  readonly operatorId: string;
  /** Id for *this* working session distinct sessions must not share a session id. */
  readonly sessionId: string;
  readonly source: OperatorSource;
  readonly displayName?: string;
};

export function assertOperatorIdentity(identity: OperatorIdentity): void {
  if (!identity.operatorId.trim()) {
    throw new Error('operatorId is required');
  }
  if (!identity.sessionId.trim()) {
    throw new Error('sessionId is required');
  }
  if (!OPERATOR_SOURCES.includes(identity.source)) {
    throw new Error(`Unknown operator source: ${String(identity.source)}`);
  }
}


/**
 * Builds the audit actor for an operator-proposed record. Operators are always
 * recorded as `type: 'user'` never `system` because a human (or a Claude session acting
 * on the owner's behalf) is proposing, not an automated worker.
 */
export function buildOperatorActor(identity: OperatorIdentity): AuditActor {
  assertOperatorIdentity(identity);
  return {
    id: identity.operatorId,
    type: 'user',
    ...(identity.displayName ? { displayName: identity.displayName } : {}),
  };
}

export type OperatorStamp = {
  readonly operatorId: string;
  readonly sessionId: string;
  readonly source: OperatorSource;
};

/** Stable, serializable stamp embedded into every proposal payload this package builds. */
export function operatorStamp(identity: OperatorIdentity): OperatorStamp {
  assertOperatorIdentity(identity);
  return {
    operatorId: identity.operatorId,
    sessionId: identity.sessionId,
    source: identity.source,
  };
}
