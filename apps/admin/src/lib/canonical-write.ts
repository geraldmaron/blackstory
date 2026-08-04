/**
 * The one way anything in this app is allowed to change `bb_canonical`.
 *
 * Every write verb the workbench grows (field edit, merge, bulk kind reassign) goes through
 * `commitCanonicalWrite`. It resolves the caller's verified staff identity from the session
 * cookie, checks the role against the permission the verb needs, and then hands the state
 * change to `commitWithAuditPostgres`, which writes domain state, the audit event, and the
 * outbox message in one transaction. There is no path that mutates state without the audit
 * row: they are the same INSERT batch, so a write that is not audited is a write that did not
 * happen.
 *
 * Failures come back as values rather than exceptions. A server action rendering a form needs
 * to tell an operator "your role cannot do this" in the page, not throw a digest-scrubbed 500.
 *
 * Note on the invariant this reverses: the console previously promised that admin never mutates
 * canonical — decisions were staged and only a signed release manifest made anything live.
 * That still holds for publication. It no longer holds for the record itself: an operator with
 * `canonical:write` now edits canonical rows directly, which is why the audit row is mandatory
 * and the actor is taken from the verified session rather than from a form field.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { AuditActor, DomainAuditEvent, DomainOutboxMessage } from '@repo/domain';
import type { AdminPermission } from '../auth/server-authorization';
import type { StaffRole } from '../auth/role-mutation';
import type { ServerAdminIdentity } from '../auth/supabase-server';
import { StaffPermissionDeniedError, assertStaffPermission } from '../auth/staff-permissions';
import { commitWithAuditPostgres, type PostgresCommitInput } from './postgres-commit';

/** Canonical write verbs. Adding one here is what makes it exist; there is no ad-hoc path. */
export const CANONICAL_WRITE_VERBS = [
  'entity.field_edit',
  'entity.merge',
  'entity.merge_reverse',
  'entity.bulk_kind_reassign',
] as const;

export type CanonicalWriteVerb = (typeof CANONICAL_WRITE_VERBS)[number];

const PERMISSION_BY_VERB: Readonly<Record<CanonicalWriteVerb, AdminPermission>> = {
  'entity.field_edit': 'canonical:write',
  'entity.merge': 'canonical:merge',
  // Reversing a merge needs the same authority as making one: both rewrite who owns what.
  'entity.merge_reverse': 'canonical:merge',
  'entity.bulk_kind_reassign': 'canonical:bulk_write',
};

export function permissionForCanonicalVerb(verb: CanonicalWriteVerb): AdminPermission {
  return PERMISSION_BY_VERB[verb];
}

export type CanonicalWriteRequest = {
  readonly verb: CanonicalWriteVerb;
  /** The canonical row this write is about; the audit subject and outbox aggregate id. */
  readonly subjectId: string;
  /** Operator-supplied justification. Required — an unexplained canonical edit is not auditable. */
  readonly reason: string;
  /** Verb-specific detail recorded on the audit event (before/after values, member ids, counts). */
  readonly data?: Readonly<Record<string, unknown>>;
  /**
   * Reuse of a key replays the earlier commit instead of writing twice, so a double-submitted
   * form is harmless. Omitted means "always a new write".
   */
  readonly idempotencyKey?: string;
  readonly correlationId?: string;
  /** How many canonical rows this write touches; recorded so bulk edits are legible in the log. */
  readonly affectedCount?: number;
  /**
   * The actual state change, inside the audited transaction. Anything it returns is merged into
   * the audit event's `data` — detail that only exists once the write has run (which row ids
   * moved, what was left behind) has nowhere else to be recorded, and the audit row is inserted
   * after this callback, so it lands in the same transaction.
   */
  readonly applyState: (client: pg.PoolClient) => Promise<void | Readonly<Record<string, unknown>>>;
};

export type CanonicalWriteResult =
  | {
      readonly status: 'ok';
      readonly eventId: string;
      /** True when an identical idempotency key had already been committed. */
      readonly replayed: boolean;
      readonly actor: ServerAdminIdentity;
    }
  | { readonly status: 'unauthenticated' }
  | {
      readonly status: 'forbidden';
      readonly role: StaffRole;
      readonly permission: AdminPermission;
      readonly message: string;
    }
  | { readonly status: 'invalid'; readonly message: string }
  | { readonly status: 'failed'; readonly message: string };

export type CanonicalWriteDependencies = {
  readonly readIdentity: () => Promise<ServerAdminIdentity | null>;
  readonly commit: (input: PostgresCommitInput) => Promise<{
    readonly eventId: string;
    readonly replayed: boolean;
  }>;
  readonly newId: () => string;
  readonly now: () => string;
};

/**
 * `next/headers` is imported lazily: this module is unit-testable outside a request scope, and
 * only the real default path needs the Next runtime.
 */
const defaultDependencies: CanonicalWriteDependencies = {
  async readIdentity() {
    const { readVerifiedAdminIdentity } = await import('../auth/supabase-server');
    return readVerifiedAdminIdentity();
  },
  commit: commitWithAuditPostgres,
  newId: () => randomUUID(),
  now: () => new Date().toISOString(),
};

/** Trimmed reason, or undefined when the operator gave nothing usable. */
function normalizeReason(reason: string): string | undefined {
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function actorFor(identity: ServerAdminIdentity): AuditActor {
  return { id: identity.uid, type: 'user', displayName: identity.email };
}

export async function commitCanonicalWrite(
  request: CanonicalWriteRequest,
  dependencies: Partial<CanonicalWriteDependencies> = {},
): Promise<CanonicalWriteResult> {
  const deps = { ...defaultDependencies, ...dependencies };

  const permission = PERMISSION_BY_VERB[request.verb];
  if (!permission) {
    return { status: 'invalid', message: `Unknown canonical write verb: ${request.verb}` };
  }

  const subjectId = request.subjectId.trim();
  if (!subjectId) {
    return { status: 'invalid', message: 'A subject id is required for a canonical write.' };
  }

  const reason = normalizeReason(request.reason);
  if (!reason) {
    return { status: 'invalid', message: 'A reason is required for every canonical write.' };
  }

  const identity = await deps.readIdentity();
  if (!identity) {
    return { status: 'unauthenticated' };
  }

  try {
    assertStaffPermission(identity.role, permission);
  } catch (error) {
    if (error instanceof StaffPermissionDeniedError) {
      return {
        status: 'forbidden',
        role: error.role,
        permission: error.permission,
        message: `Your role (${error.role}) cannot ${request.verb.replace(/[._]/g, ' ')}. This needs ${error.permission}.`,
      };
    }
    throw error;
  }

  const occurredAt = deps.now();
  const eventId = deps.newId();
  const correlationId = request.correlationId ?? deps.newId();
  const idempotencyKey = request.idempotencyKey ?? `canonical:${request.verb}:${eventId}`;

  // Held by reference: `applyState` runs before the audit row is serialized, so anything it
  // returns can still be folded in.
  const auditData: Record<string, unknown> = {
    ...(request.data ?? {}),
    verb: request.verb,
    permission,
    actorRole: identity.role,
    affectedCount: request.affectedCount ?? 1,
  };

  const auditEvent: DomainAuditEvent = {
    id: eventId,
    // Canonical edits are corrections to a published record, which is what the closed audit
    // vocabulary calls them; `data.verb` carries which kind of correction it was.
    action: 'correction.applied',
    category: 'correction',
    actor: actorFor(identity),
    subject: { type: 'entity', id: subjectId, path: `bb_canonical.entities/${subjectId}` },
    reason,
    requestId: eventId,
    correlationId,
    entityId: subjectId,
    idempotencyKey,
    occurredAt,
    data: auditData,
  };

  const outboxMessage: DomainOutboxMessage = {
    id: deps.newId(),
    eventId,
    topic: 'canonical.entity.changed',
    aggregateType: 'entity',
    aggregateId: subjectId,
    payload: { verb: request.verb, entityId: subjectId, affectedCount: request.affectedCount ?? 1 },
    status: 'pending',
    attempts: 0,
    maxAttempts: 5,
    availableAt: occurredAt,
    createdAt: occurredAt,
    correlationId,
    idempotencyKey,
  };

  try {
    const result = await deps.commit({
      auditEvent,
      outboxMessage,
      applyState: async (client) => {
        const extra = await request.applyState(client);
        if (extra) Object.assign(auditData, extra);
      },
    });
    return {
      status: 'ok',
      eventId: result.eventId,
      replayed: result.replayed,
      actor: identity,
    };
  } catch (error) {
    // The transaction rolled back, so no partial state survived; report and keep the detail
    // server-side rather than leaking a driver message into the page.
    console.error('canonical write failed', { verb: request.verb, subjectId }, error);
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
