/**
 * Firestore Admin reads for publication releases and the active public release pointer.
 */
import { createServerFirebaseApp, FIRESTORE_ROOT, firestorePaths } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';

export type PublicationReleaseListItem = {
  readonly id: string;
  readonly status: string;
  readonly searchIndexVersion: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly activatedAt?: string;
};

export type ActiveReleasePointer = {
  readonly releaseId: string;
  readonly activatedAt: string;
  readonly searchIndexVersion: string;
  readonly manifestHash: string;
};

export type ReleasesListResult = {
  readonly items: readonly PublicationReleaseListItem[];
  readonly activeRelease: ActiveReleasePointer | null;
};

function getDb() {
  const { app } = createServerFirebaseApp(process.env);
  return getFirestore(app);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toListItem(docId: string, data: Record<string, unknown>): PublicationReleaseListItem | null {
  const status = readString(data.status);
  const searchIndexVersion = readString(data.searchIndexVersion);
  const createdAt = readString(data.createdAt);
  const createdBy = readString(data.createdBy);
  if (!status || !searchIndexVersion || !createdAt || !createdBy) return null;

  const activatedAt = readString(data.activatedAt);

  return {
    id: docId,
    status,
    searchIndexVersion,
    createdAt,
    createdBy,
    ...(activatedAt ? { activatedAt } : {}),
  };
}

function parseActiveRelease(data: Record<string, unknown>): ActiveReleasePointer | null {
  const releaseId = readString(data.releaseId);
  const activatedAt = readString(data.activatedAt);
  const searchIndexVersion = readString(data.searchIndexVersion);
  const manifestHash = readString(data.manifestHash);
  if (!releaseId || !activatedAt || !searchIndexVersion || !manifestHash) return null;
  return { releaseId, activatedAt, searchIndexVersion, manifestHash };
}

export async function listPublicationReleases(
  limit = 50,
): Promise<ReleasesListResult> {
  const db = getDb();
  const cappedLimit = Math.min(100, Math.max(1, limit));

  const [releasesSnap, activeSnap] = await Promise.all([
    db
      .collection(FIRESTORE_ROOT.publicationReleases)
      .orderBy('createdAt', 'desc')
      .limit(cappedLimit)
      .get(),
    db.doc(firestorePaths.publicActiveRelease()).get(),
  ]);

  const items: PublicationReleaseListItem[] = [];
  for (const doc of releasesSnap.docs) {
    const parsed = toListItem(doc.id, doc.data() as Record<string, unknown>);
    if (parsed) items.push(parsed);
  }

  const activeRelease = activeSnap.exists
    ? parseActiveRelease(activeSnap.data() as Record<string, unknown>)
    : null;

  return { items, activeRelease };
}

export async function tryListPublicationReleases(
  limit?: number,
): Promise<ReleasesListResult | null> {
  try {
    return await listPublicationReleases(limit);
  } catch (error) {
    console.error('admin publicationReleases list failed', error);
    return null;
  }
}
