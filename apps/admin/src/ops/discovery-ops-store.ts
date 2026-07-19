/**
 * Firestore Admin reads for private discovery campaign run records.
 */
import { createServerFirebaseApp, FIRESTORE_ROOT } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';

export type DiscoveryCampaignRunListItem = {
  readonly id: string;
  readonly jobId: string;
  readonly jobRunId: string;
  readonly status: string;
  readonly mode: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly itemsExpected: number;
  readonly itemsProcessed: number;
  readonly survivors?: number;
  readonly accepted?: number;
  readonly kind?: string;
  readonly errorMessage?: string;
};

function getDb() {
  const { app } = createServerFirebaseApp(process.env);
  return getFirestore(app);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toListItem(
  docId: string,
  data: Record<string, unknown>,
): DiscoveryCampaignRunListItem | null {
  const jobId = readString(data.jobId);
  const jobRunId = readString(data.jobRunId);
  const status = readString(data.status);
  const mode = readString(data.mode);
  const startedAt = readString(data.startedAt);
  const completedAt = readString(data.completedAt);
  const itemsExpected = readNumber(data.itemsExpected);
  const itemsProcessed = readNumber(data.itemsProcessed);
  if (
    !jobId ||
    !jobRunId ||
    !status ||
    !mode ||
    !startedAt ||
    !completedAt ||
    itemsExpected === undefined ||
    itemsProcessed === undefined
  ) {
    return null;
  }

  const survivors = readNumber(data.survivors);
  const accepted = readNumber(data.accepted);
  const kind = readString(data.kind);
  const errorMessage = readString(data.errorMessage);

  return {
    id: readString(data.id) ?? docId,
    jobId,
    jobRunId,
    status,
    mode,
    startedAt,
    completedAt,
    itemsExpected,
    itemsProcessed,
    ...(survivors !== undefined ? { survivors } : {}),
    ...(accepted !== undefined ? { accepted } : {}),
    ...(kind ? { kind } : {}),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

export async function listDiscoveryCampaignRuns(
  limit = 50,
): Promise<readonly DiscoveryCampaignRunListItem[]> {
  const db = getDb();
  const cappedLimit = Math.min(100, Math.max(1, limit));

  let snap;
  try {
    snap = await db
      .collection(FIRESTORE_ROOT.discoveryCampaignRuns)
      .orderBy('completedAt', 'desc')
      .limit(cappedLimit)
      .get();
  } catch (error) {
    console.error(
      'admin discoveryCampaignRuns orderBy failed; falling back to plain limit',
      error,
    );
    snap = await db.collection(FIRESTORE_ROOT.discoveryCampaignRuns).limit(cappedLimit).get();
  }

  const items: DiscoveryCampaignRunListItem[] = [];
  for (const doc of snap.docs) {
    const parsed = toListItem(doc.id, doc.data() as Record<string, unknown>);
    if (parsed) items.push(parsed);
  }

  return [...items].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export async function tryListDiscoveryCampaignRuns(
  limit?: number,
): Promise<readonly DiscoveryCampaignRunListItem[] | null> {
  try {
    return await listDiscoveryCampaignRuns(limit);
  } catch (error) {
    console.error('admin discoveryCampaignRuns list failed', error);
    return null;
  }
}
