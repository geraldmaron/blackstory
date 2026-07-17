/**
 * Atomic Firestore release activation and rollback for BB-019.
 *
 * The active pointer, release lifecycle statuses, audit event, outbox message, and
 * idempotency marker commit in one transaction. Signed manifests and release artifacts
 * are never rewritten; rollback only points public traffic at an existing release.
 */
import {
  auditEventSchema,
  idempotencyRecordSchema,
  outboxMessageSchema,
  type AuditEventDoc,
  type IdempotencyRecordDoc,
  type OutboxMessageDoc,
} from './types.js';
import type { AtomicStore } from './audit-outbox.js';

export const RELEASE_ACTIVATION_STATUSES = [
  'draft',
  'preview',
  'active',
  'superseded',
  'rolled_back',
] as const;

export type ReleaseActivationStatus = (typeof RELEASE_ACTIVATION_STATUSES)[number];

export type ImmutablePublicationReleaseDoc = {
  readonly id: string;
  readonly status: ReleaseActivationStatus;
  readonly searchIndexVersion: string;
  readonly signedManifest: {
    readonly manifest: {
      readonly releaseId: string;
      readonly searchIndexVersion: string;
    };
    readonly manifestHash: {
      readonly algorithm: 'sha256';
      readonly digest: string;
    };
    readonly signature: {
      readonly algorithm: 'ecdsa-sha256';
      readonly keyId: string;
      readonly value: string;
    };
  };
  readonly createdAt: string;
  readonly createdBy: string;
  readonly activatedAt?: string;
  readonly supersededAt?: string;
  readonly rolledBackAt?: string;
};

export type ActivePublicReleasePointer = {
  readonly releaseId: string;
  readonly activatedAt: string;
  readonly searchIndexVersion: string;
  readonly manifestHash: string;
};

export type ActivateReleaseInput = {
  readonly targetReleaseId: string;
  readonly mode: 'activate' | 'rollback';
  readonly now: string;
  readonly auditEvent: AuditEventDoc;
  readonly outboxMessage: OutboxMessageDoc;
  /**
   * Synchronous verification against a trusted publication public key.
   * It must not perform I/O because Firestore may retry transaction callbacks.
   */
  readonly verifySignedManifest: (release: ImmutablePublicationReleaseDoc) => boolean;
};

export type ActivateReleaseResult = {
  readonly committed: boolean;
  readonly replayed: boolean;
  readonly releaseId: string;
  readonly previousReleaseId?: string;
  readonly searchIndexVersion: string;
};

const SHA256_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/;
const RELEASE_STATUSES = new Set<string>(RELEASE_ACTIVATION_STATUSES);

function requiredString(
  record: Readonly<Record<string, unknown>>,
  field: string,
  context: string,
): string {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${context}.${field} must be a non-empty string`);
  }
  return value;
}

function asRecord(value: unknown, context: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

export function parseImmutablePublicationRelease(value: unknown): ImmutablePublicationReleaseDoc {
  const release = asRecord(value, 'release');
  const id = requiredString(release, 'id', 'release');
  const status = requiredString(release, 'status', 'release');
  if (!RELEASE_STATUSES.has(status)) {
    throw new Error(`release.status is unsupported: ${status}`);
  }
  const searchIndexVersion = requiredString(release, 'searchIndexVersion', 'release');
  const signedManifest = asRecord(release.signedManifest, 'release.signedManifest');
  const manifest = asRecord(signedManifest.manifest, 'release.signedManifest.manifest');
  const manifestHash = asRecord(signedManifest.manifestHash, 'release.signedManifest.manifestHash');
  const signature = asRecord(signedManifest.signature, 'release.signedManifest.signature');
  const manifestReleaseId = requiredString(
    manifest,
    'releaseId',
    'release.signedManifest.manifest',
  );
  const manifestSearchIndexVersion = requiredString(
    manifest,
    'searchIndexVersion',
    'release.signedManifest.manifest',
  );
  const digest = requiredString(manifestHash, 'digest', 'release.signedManifest.manifestHash');
  if (
    manifestHash.algorithm !== 'sha256' ||
    !SHA256_DIGEST_PATTERN.test(digest) ||
    signature.algorithm !== 'ecdsa-sha256' ||
    !requiredString(signature, 'keyId', 'release.signedManifest.signature') ||
    !requiredString(signature, 'value', 'release.signedManifest.signature')
  ) {
    throw new Error('Release requires a valid signed sha256 manifest envelope');
  }
  if (id !== manifestReleaseId || searchIndexVersion !== manifestSearchIndexVersion) {
    throw new Error('Release identity must match its signed manifest');
  }

  return value as ImmutablePublicationReleaseDoc;
}

export function resolveActivePublicRelease(
  pointer: ActivePublicReleasePointer,
  releaseValue: unknown,
): ImmutablePublicationReleaseDoc {
  const release = parseImmutablePublicationRelease(releaseValue);
  if (
    release.status !== 'active' ||
    release.id !== pointer.releaseId ||
    release.searchIndexVersion !== pointer.searchIndexVersion ||
    release.signedManifest.manifestHash.digest !== pointer.manifestHash
  ) {
    throw new Error('Active release pointer does not match an active immutable release');
  }
  return release;
}

function keyDocumentId(key: string): string {
  return Buffer.from(key, 'utf8').toString('base64url');
}

function releasePath(releaseId: string): string {
  if (!SAFE_ID_PATTERN.test(releaseId)) {
    throw new Error('targetReleaseId is not a safe Firestore document id');
  }
  return `publicationReleases/${releaseId}`;
}

function assertActivationAudit(
  auditEvent: AuditEventDoc,
  outboxMessage: OutboxMessageDoc,
  targetReleaseId: string,
): void {
  if (
    auditEvent.action !== 'publication.release_activated' ||
    auditEvent.releaseId !== targetReleaseId
  ) {
    throw new Error('Activation audit event must identify the activated release');
  }
  if (
    outboxMessage.eventId !== auditEvent.id ||
    outboxMessage.idempotencyKey !== auditEvent.idempotencyKey ||
    outboxMessage.correlationId !== auditEvent.correlationId ||
    outboxMessage.aggregateType !== 'publicationRelease' ||
    outboxMessage.aggregateId !== targetReleaseId ||
    outboxMessage.payload.releaseId !== targetReleaseId ||
    typeof outboxMessage.payload.searchIndexVersion !== 'string' ||
    outboxMessage.status !== 'pending' ||
    outboxMessage.attempts !== 0
  ) {
    throw new Error('Activation outbox message must match its audit event and start pending');
  }
}

/**
 * Atomically flips the public pointer to a signed release. Normal activation accepts only
 * preview releases; rollback accepts only prior superseded/rolled-back releases.
 */
export async function activatePublicationRelease(
  store: AtomicStore,
  input: ActivateReleaseInput,
): Promise<ActivateReleaseResult> {
  if (!Number.isFinite(Date.parse(input.now))) {
    throw new Error('now must be an ISO-compatible date');
  }
  const targetPath = releasePath(input.targetReleaseId);
  const auditEvent = auditEventSchema.parse(input.auditEvent);
  const outboxMessage = outboxMessageSchema.parse(input.outboxMessage);
  assertActivationAudit(auditEvent, outboxMessage, input.targetReleaseId);
  const expectedSearchIndexVersion = outboxMessage.payload.searchIndexVersion as string;

  return store.runTransaction(async (transaction) => {
    const markerPath = `idempotencyKeys/${keyDocumentId(auditEvent.idempotencyKey)}`;
    const markerSnapshot = await transaction.get(markerPath);
    if (markerSnapshot.exists) {
      idempotencyRecordSchema.parse(markerSnapshot.data());
      return {
        committed: false,
        replayed: true,
        releaseId: input.targetReleaseId,
        searchIndexVersion: expectedSearchIndexVersion,
      };
    }

    const targetSnapshot = await transaction.get(targetPath);
    if (!targetSnapshot.exists) {
      throw new Error(`Target release does not exist: ${input.targetReleaseId}`);
    }
    const target = parseImmutablePublicationRelease(targetSnapshot.data());
    if (!input.verifySignedManifest(target)) {
      throw new Error(`Release ${target.id} manifest signature is invalid`);
    }
    const allowedTargetStatuses =
      input.mode === 'activate'
        ? new Set<ReleaseActivationStatus>(['preview'])
        : new Set<ReleaseActivationStatus>(['superseded', 'rolled_back']);
    if (!allowedTargetStatuses.has(target.status)) {
      throw new Error(`Release ${target.id} with status ${target.status} cannot ${input.mode}`);
    }
    if (target.searchIndexVersion !== expectedSearchIndexVersion) {
      throw new Error('Activation outbox search-index version must match the target release');
    }

    const pointerPath = 'publicMeta/activeRelease';
    const pointerSnapshot = await transaction.get(pointerPath);
    let previousRelease: ImmutablePublicationReleaseDoc | undefined;
    if (pointerSnapshot.exists) {
      const pointer = asRecord(pointerSnapshot.data(), 'active release pointer');
      const previousReleaseId = requiredString(pointer, 'releaseId', 'active release pointer');
      if (previousReleaseId === target.id) {
        throw new Error('Target release is already active');
      }
      const previousSnapshot = await transaction.get(releasePath(previousReleaseId));
      if (!previousSnapshot.exists) {
        throw new Error(`Active release record does not exist: ${previousReleaseId}`);
      }
      previousRelease = parseImmutablePublicationRelease(previousSnapshot.data());
      if (previousRelease.status !== 'active') {
        throw new Error('Current active pointer references a non-active release');
      }
    } else if (input.mode === 'rollback') {
      throw new Error('Rollback requires a current active release');
    }

    const pointer: ActivePublicReleasePointer = {
      releaseId: target.id,
      activatedAt: input.now,
      searchIndexVersion: target.searchIndexVersion,
      manifestHash: target.signedManifest.manifestHash.digest,
    };
    transaction.update(targetPath, {
      status: 'active',
      activatedAt: input.now,
    });
    if (previousRelease) {
      transaction.update(releasePath(previousRelease.id), {
        status: input.mode === 'rollback' ? 'rolled_back' : 'superseded',
        ...(input.mode === 'rollback' ? { rolledBackAt: input.now } : { supersededAt: input.now }),
      });
    }
    transaction.set(pointerPath, pointer);

    const marker: IdempotencyRecordDoc = {
      key: auditEvent.idempotencyKey,
      eventId: auditEvent.id,
      outboxMessageId: outboxMessage.id,
      correlationId: auditEvent.correlationId,
      createdAt: auditEvent.occurredAt,
    };
    transaction.create(`auditEvents/${auditEvent.id}`, auditEvent);
    transaction.create(`outboxMessages/${outboxMessage.id}`, outboxMessage);
    transaction.create(markerPath, marker);

    return {
      committed: true,
      replayed: false,
      releaseId: target.id,
      ...(previousRelease ? { previousReleaseId: previousRelease.id } : {}),
      searchIndexVersion: target.searchIndexVersion,
    };
  });
}
