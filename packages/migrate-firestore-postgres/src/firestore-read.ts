/**
 * Firestore Admin SDK helpers for census and paged document reads.
 */
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export async function countCollection(db: Firestore, name: string): Promise<number> {
  const agg = await db.collection(name).count().get();
  return agg.data().count;
}

export async function* iterateCollection(
  db: Firestore,
  name: string,
  pageSize = 200,
): AsyncGenerator<{ readonly id: string; readonly data: Record<string, unknown> }> {
  let last: QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db.collection(name).orderBy('__name__').limit(pageSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) return;
    for (const doc of snap.docs) {
      yield { id: doc.id, data: doc.data() as Record<string, unknown> };
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) return;
  }
}

export async function* iterateSubcollection(
  db: Firestore,
  parentCollection: string,
  parentId: string,
  subcollection: string,
  pageSize = 200,
): AsyncGenerator<{ readonly id: string; readonly data: Record<string, unknown> }> {
  let last: QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db
      .collection(parentCollection)
      .doc(parentId)
      .collection(subcollection)
      .orderBy('__name__')
      .limit(pageSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) return;
    for (const doc of snap.docs) {
      yield { id: doc.id, data: doc.data() as Record<string, unknown> };
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) return;
  }
}
