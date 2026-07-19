/**
 * Firestore Admin reads for operational kill switches in the management portal.
 */
import { createServerFirebaseApp, FIRESTORE_ROOT } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';

export type KillSwitchListItem = {
  readonly id: string;
  readonly enabled: boolean;
  readonly reason?: string;
  readonly updatedAt: string;
};

function getDb() {
  const { app } = createServerFirebaseApp(process.env);
  return getFirestore(app);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toListItem(docId: string, data: Record<string, unknown>): KillSwitchListItem | null {
  const updatedAt = readString(data.updatedAt);
  if (!updatedAt) return null;
  if (typeof data.enabled !== 'boolean') return null;

  const reason = readString(data.reason);

  return {
    id: readString(data.id) ?? docId,
    enabled: data.enabled,
    updatedAt,
    ...(reason ? { reason } : {}),
  };
}

export async function listKillSwitches(limit = 100): Promise<readonly KillSwitchListItem[]> {
  const db = getDb();
  const cappedLimit = Math.min(200, Math.max(1, limit));
  const snap = await db.collection(FIRESTORE_ROOT.killSwitches).limit(cappedLimit).get();

  const items: KillSwitchListItem[] = [];
  for (const doc of snap.docs) {
    const parsed = toListItem(doc.id, doc.data() as Record<string, unknown>);
    if (parsed) items.push(parsed);
  }

  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

export async function tryListKillSwitches(
  limit?: number,
): Promise<readonly KillSwitchListItem[] | null> {
  try {
    return await listKillSwitches(limit);
  } catch (error) {
    console.error('admin killSwitches list failed', error);
    return null;
  }
}
