/**
 * Firestore access for staged story_packet submissions and review decisions.
 * Admin SDK only — never trusts the browser for authorization.
 *
 * Listing queries `payload.proposalKind == 'story_packet'` so leads flooding
 * `submissionInbox` cannot push older packets out of a newest-N scan.
 */
import { storyPacketToSeedRecord, type StoryResearchPacket } from '@repo/domain';
import { createServerFirebaseApp, FIRESTORE_ROOT } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';

export const STORY_PACKET_REVIEW_COLLECTION = 'adminStoryPacketReviews';

export type StoryPacketReviewDecision = 'approved' | 'rejected' | 'needs_evidence';

export type StoryPacketListItem = {
  readonly submissionId: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly title: string;
  readonly decision: string;
  readonly topicId: string;
  readonly validationIssueCount: number;
  readonly review?: {
    readonly decision: StoryPacketReviewDecision;
    readonly reviewedAt: string;
    readonly reviewedByEmail: string;
  };
  readonly packet: StoryResearchPacket;
};

function getDb() {
  const { app } = createServerFirebaseApp(process.env);
  return getFirestore(app);
}

function extractPacket(payload: Record<string, unknown> | undefined): StoryResearchPacket | null {
  if (!payload) return null;
  const proposalKind = payload.proposalKind;
  if (proposalKind !== undefined && proposalKind !== 'story_packet') return null;

  const nested = payload.storyPacket;
  if (
    nested &&
    typeof nested === 'object' &&
    (nested as { kind?: string }).kind === 'story.research.packet.v1'
  ) {
    return nested as StoryResearchPacket;
  }

  // Legacy: packet embedded in statement as packetJson=...
  const statement = typeof payload.statement === 'string' ? payload.statement : '';
  const marker = 'packetJson=';
  const idx = statement.indexOf(marker);
  if (idx >= 0) {
    const raw = statement.slice(idx + marker.length);
    try {
      const parsed = JSON.parse(raw) as StoryResearchPacket;
      if (parsed?.kind === 'story.research.packet.v1') return parsed;
    } catch {
      // fall through
    }
  }

  return null;
}

export async function listStoryPackets(limit = 200): Promise<readonly StoryPacketListItem[]> {
  const db = getDb();
  const capped = Math.min(200, Math.max(1, limit));

  // Prefer an indexed filter so lead floods cannot hide older story packets.
  let snap;
  try {
    snap = await db
      .collection(FIRESTORE_ROOT.submissionInbox)
      .where('payload.proposalKind', '==', 'story_packet')
      .orderBy('createdAt', 'desc')
      .limit(capped)
      .get();
  } catch {
    // Composite index may be missing in a fresh project — fall back to a wider scan
    // and filter client-side (still prefer proposalKind match over newest-N-only).
    const wide = await db
      .collection(FIRESTORE_ROOT.submissionInbox)
      .orderBy('createdAt', 'desc')
      .limit(Math.max(capped * 20, 500))
      .get();
    snap = {
      docs: wide.docs.filter((doc) => {
        const payload = (doc.data() as { payload?: Record<string, unknown> }).payload;
        return payload?.proposalKind === 'story_packet' || extractPacket(payload) !== null;
      }),
    };
  }

  const reviewsSnap = await db.collection(STORY_PACKET_REVIEW_COLLECTION).get();
  const reviewsById = new Map<
    string,
    {
      decision: StoryPacketReviewDecision;
      reviewedAt: string;
      reviewedByEmail: string;
    }
  >();
  for (const doc of reviewsSnap.docs) {
    const data = doc.data() as {
      decision?: StoryPacketReviewDecision;
      reviewedAt?: string;
      reviewedByEmail?: string;
    };
    if (data.decision && data.reviewedAt && data.reviewedByEmail) {
      reviewsById.set(doc.id, {
        decision: data.decision,
        reviewedAt: data.reviewedAt,
        reviewedByEmail: data.reviewedByEmail,
      });
    }
  }

  const items: StoryPacketListItem[] = [];
  for (const doc of snap.docs.slice(0, capped)) {
    const data = doc.data() as {
      createdAt?: string;
      createdBy?: string;
      payload?: Record<string, unknown>;
    };
    const packet = extractPacket(data.payload);
    if (!packet) continue;
    const review = reviewsById.get(doc.id);
    items.push({
      submissionId: doc.id,
      createdAt: data.createdAt ?? '',
      createdBy: data.createdBy ?? '',
      title: packet.draft.title,
      decision: packet.decision,
      topicId: packet.topicId,
      validationIssueCount: packet.validationIssues.length,
      ...(review ? { review } : {}),
      packet,
    });
  }
  return Object.freeze(items);
}

export async function getStoryPacket(submissionId: string): Promise<StoryPacketListItem | null> {
  const db = getDb();
  const doc = await db.collection(FIRESTORE_ROOT.submissionInbox).doc(submissionId).get();
  if (!doc.exists) return null;
  const data = doc.data() as {
    createdAt?: string;
    createdBy?: string;
    payload?: Record<string, unknown>;
  };
  const packet = extractPacket(data.payload);
  if (!packet) return null;

  const reviewDoc = await db.collection(STORY_PACKET_REVIEW_COLLECTION).doc(submissionId).get();
  let review:
    | {
        decision: StoryPacketReviewDecision;
        reviewedAt: string;
        reviewedByEmail: string;
      }
    | undefined;
  if (reviewDoc.exists) {
    const rd = reviewDoc.data() as {
      decision?: StoryPacketReviewDecision;
      reviewedAt?: string;
      reviewedByEmail?: string;
    };
    if (rd.decision && rd.reviewedAt && rd.reviewedByEmail) {
      review = {
        decision: rd.decision,
        reviewedAt: rd.reviewedAt,
        reviewedByEmail: rd.reviewedByEmail,
      };
    }
  }

  return {
    submissionId: doc.id,
    createdAt: data.createdAt ?? '',
    createdBy: data.createdBy ?? '',
    title: packet.draft.title,
    decision: packet.decision,
    topicId: packet.topicId,
    validationIssueCount: packet.validationIssues.length,
    ...(review ? { review } : {}),
    packet,
  };
}

export async function recordStoryPacketReview(input: {
  readonly submissionId: string;
  readonly decision: StoryPacketReviewDecision;
  readonly reviewedByEmail: string;
  readonly reviewedByUid: string;
  readonly note?: string;
}): Promise<{
  readonly review: {
    readonly decision: StoryPacketReviewDecision;
    readonly reviewedAt: string;
    readonly reviewedByEmail: string;
  };
  readonly seedHandoff?: ReturnType<typeof storyPacketToSeedRecord>;
}> {
  const item = await getStoryPacket(input.submissionId);
  if (!item) {
    throw new Error(`Story packet submission not found: ${input.submissionId}`);
  }

  const reviewedAt = new Date().toISOString();
  const db = getDb();
  await db
    .collection(STORY_PACKET_REVIEW_COLLECTION)
    .doc(input.submissionId)
    .set(
      {
        submissionId: input.submissionId,
        decision: input.decision,
        reviewedAt,
        reviewedByEmail: input.reviewedByEmail,
        reviewedByUid: input.reviewedByUid,
        topicId: item.topicId,
        packetKind: item.packet.kind,
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      { merge: true },
    );

  const review = {
    decision: input.decision,
    reviewedAt,
    reviewedByEmail: input.reviewedByEmail,
  };

  if (input.decision === 'approved') {
    return {
      review,
      seedHandoff: storyPacketToSeedRecord(item.packet, reviewedAt.slice(0, 10)),
    };
  }
  return { review };
}

export async function recordStoryPacketReviewsBulk(input: {
  readonly submissionIds: readonly string[];
  readonly decision: StoryPacketReviewDecision;
  readonly reviewedByEmail: string;
  readonly reviewedByUid: string;
  readonly note?: string;
}): Promise<{
  readonly results: readonly {
    readonly submissionId: string;
    readonly ok: boolean;
    readonly error?: string;
    readonly review?: {
      readonly decision: StoryPacketReviewDecision;
      readonly reviewedAt: string;
      readonly reviewedByEmail: string;
    };
    readonly seedHandoff?: ReturnType<typeof storyPacketToSeedRecord>;
  }[];
}> {
  const results = [];
  for (const submissionId of input.submissionIds) {
    try {
      const recorded = await recordStoryPacketReview({
        submissionId,
        decision: input.decision,
        reviewedByEmail: input.reviewedByEmail,
        reviewedByUid: input.reviewedByUid,
        ...(input.note !== undefined ? { note: input.note } : {}),
      });
      results.push({
        submissionId,
        ok: true,
        review: recorded.review,
        ...(recorded.seedHandoff ? { seedHandoff: recorded.seedHandoff } : {}),
      });
    } catch (error) {
      results.push({
        submissionId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { results: Object.freeze(results) };
}
