/**
 * Firestore Admin reads for registered source organizations in the management portal.
 */
import { createServerFirebaseApp, FIRESTORE_ROOT } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';

export type SourceOrganizationListItem = {
  readonly id: string;
  readonly name: string;
  readonly homepageUrl?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function getDb() {
  const { app } = createServerFirebaseApp(process.env);
  return getFirestore(app);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toListItem(docId: string, data: Record<string, unknown>): SourceOrganizationListItem | null {
  const name = readString(data.name);
  const createdAt = readString(data.createdAt);
  const updatedAt = readString(data.updatedAt);
  if (!name || !createdAt || !updatedAt) return null;

  const homepageUrl = readString(data.homepageUrl);
  const notes = readString(data.notes);

  return {
    id: docId,
    name,
    createdAt,
    updatedAt,
    ...(homepageUrl ? { homepageUrl } : {}),
    ...(notes ? { notes } : {}),
  };
}

export async function listSourceOrganizations(
  limit = 100,
): Promise<readonly SourceOrganizationListItem[]> {
  const db = getDb();
  const cappedLimit = Math.min(200, Math.max(1, limit));
  const snap = await db
    .collection(FIRESTORE_ROOT.sourceOrganizations)
    .orderBy('updatedAt', 'desc')
    .limit(cappedLimit)
    .get();

  const items: SourceOrganizationListItem[] = [];
  for (const doc of snap.docs) {
    const parsed = toListItem(doc.id, doc.data() as Record<string, unknown>);
    if (parsed) items.push(parsed);
  }
  return items;
}

export async function tryListSourceOrganizations(
  limit?: number,
): Promise<readonly SourceOrganizationListItem[] | null> {
  try {
    return await listSourceOrganizations(limit);
  } catch (error) {
    console.error('admin sourceOrganizations list failed', error);
    return null;
  }
}
