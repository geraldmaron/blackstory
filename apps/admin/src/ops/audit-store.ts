/**
 * Firestore Admin reads for recent append-only audit events in the management portal.
 */
import { createServerFirebaseApp, FIRESTORE_ROOT } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';

export type AuditEventListItem = {
  readonly id: string;
  readonly action: string;
  readonly category: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly actorType: string;
  readonly actorDisplayName?: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly reason: string;
  readonly entityId?: string;
  readonly releaseId?: string;
};

function getDb() {
  const { app } = createServerFirebaseApp(process.env);
  return getFirestore(app);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toListItem(docId: string, data: Record<string, unknown>): AuditEventListItem | null {
  const action = readString(data.action);
  const category = readString(data.category);
  const occurredAt = readString(data.occurredAt);
  const reason = readString(data.reason);
  if (!action || !category || !occurredAt || !reason) return null;

  const actor = data.actor;
  if (!actor || typeof actor !== 'object') return null;
  const actorRecord = actor as { id?: unknown; type?: unknown; displayName?: unknown };
  const actorId = readString(actorRecord.id);
  const actorType = readString(actorRecord.type);
  if (!actorId || !actorType) return null;

  const subject = data.subject;
  if (!subject || typeof subject !== 'object') return null;
  const subjectRecord = subject as { id?: unknown; type?: unknown };
  const subjectId = readString(subjectRecord.id);
  const subjectType = readString(subjectRecord.type);
  if (!subjectId || !subjectType) return null;

  const entityId = readString(data.entityId);
  const releaseId = readString(data.releaseId);
  const actorDisplayName = readString(actorRecord.displayName);

  return {
    id: docId,
    action,
    category,
    occurredAt,
    actorId,
    actorType,
    subjectType,
    subjectId,
    reason,
    ...(actorDisplayName ? { actorDisplayName } : {}),
    ...(entityId ? { entityId } : {}),
    ...(releaseId ? { releaseId } : {}),
  };
}

export async function listRecentAuditEvents(
  limit = 100,
): Promise<readonly AuditEventListItem[]> {
  const db = getDb();
  const cappedLimit = Math.min(100, Math.max(1, limit));
  const collection = db.collection(FIRESTORE_ROOT.auditEvents);

  let snap;
  try {
    snap = await collection.orderBy('occurredAt', 'desc').limit(cappedLimit).get();
  } catch (error) {
    console.error('admin auditEvents orderBy failed; falling back to plain limit', error);
    snap = await collection.limit(cappedLimit).get();
  }

  const items: AuditEventListItem[] = [];
  for (const doc of snap.docs) {
    const parsed = toListItem(doc.id, doc.data() as Record<string, unknown>);
    if (parsed) items.push(parsed);
  }

  return [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function tryListRecentAuditEvents(
  limit?: number,
): Promise<readonly AuditEventListItem[] | null> {
  try {
    return await listRecentAuditEvents(limit);
  } catch (error) {
    console.error('admin auditEvents list failed', error);
    return null;
  }
}
