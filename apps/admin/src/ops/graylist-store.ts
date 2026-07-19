/**
 * Firestore Admin reads for discovery graylist entries parked below the relevance bar.
 * Collection path is `discoveryGraylist` (not part of FIRESTORE_ROOT constants).
 */
import { createServerFirebaseApp } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';

const DISCOVERY_GRAYLIST_COLLECTION = 'discoveryGraylist';

export type GraylistListItem = {
  readonly id: string;
  readonly candidateId: string;
  readonly disposition: string;
  readonly status: string;
  readonly compositeScore: number;
  readonly parkedAt: string;
  readonly updatedAt: string;
  readonly reason: string;
  readonly adapterId?: string;
};

function getDb() {
  const { app } = createServerFirebaseApp(process.env);
  return getFirestore(app);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toListItem(docId: string, data: Record<string, unknown>): GraylistListItem | null {
  const candidateId = readString(data.candidateId);
  const disposition = readString(data.disposition);
  const status = readString(data.status);
  const parkedAt = readString(data.parkedAt);
  const updatedAt = readString(data.updatedAt);
  const reason = readString(data.reason);
  if (!candidateId || !disposition || !status || !parkedAt || !updatedAt || !reason) {
    return null;
  }
  if (typeof data.compositeScore !== 'number') return null;

  const adapterId = readString(data.adapterId);

  return {
    id: readString(data.id) ?? docId,
    candidateId,
    disposition,
    status,
    compositeScore: data.compositeScore,
    parkedAt,
    updatedAt,
    reason,
    ...(adapterId ? { adapterId } : {}),
  };
}

export async function listDiscoveryGraylist(
  limit = 100,
): Promise<readonly GraylistListItem[]> {
  const db = getDb();
  const cappedLimit = Math.min(200, Math.max(1, limit));

  let snap;
  try {
    snap = await db
      .collection(DISCOVERY_GRAYLIST_COLLECTION)
      .orderBy('parkedAt', 'desc')
      .limit(cappedLimit)
      .get();
  } catch (error) {
    console.error('admin discoveryGraylist orderBy failed; falling back to plain limit', error);
    snap = await db.collection(DISCOVERY_GRAYLIST_COLLECTION).limit(cappedLimit).get();
  }

  const items: GraylistListItem[] = [];
  for (const doc of snap.docs) {
    const parsed = toListItem(doc.id, doc.data() as Record<string, unknown>);
    if (parsed) items.push(parsed);
  }

  return [...items].sort((a, b) => b.parkedAt.localeCompare(a.parkedAt));
}

export async function tryListDiscoveryGraylist(
  limit?: number,
): Promise<readonly GraylistListItem[] | null> {
  try {
    return await listDiscoveryGraylist(limit);
  } catch (error) {
    console.error('admin discoveryGraylist list failed', error);
    return null;
  }
}
