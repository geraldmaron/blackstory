/**
 * Server-side Firestore readers for public release projections.
 * Lives under `lib/` (not `app/`) so Admin SDK stays off the public render path.
 * Accesses Firestore only through `@black-book/firebase` helpers (no direct firebase-admin import).
 * Docs are validated with Zod schemas rather than Admin converters to avoid
 * firebase-admin / web Firestore type skew on QueryDocumentSnapshot.
 */

import {
  firestorePaths,
  getServerFirestore,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  type PublicActiveReleaseDoc,
  type PublicEntityProjectionDoc,
} from '@black-book/firebase';
import { shouldUseLivePublicProjections } from './live-policy';

export { shouldUseLivePublicProjections };

export async function fetchActiveRelease(): Promise<PublicActiveReleaseDoc | undefined> {
  const snap = await getServerFirestore().doc(firestorePaths.publicActiveRelease()).get();
  if (!snap.exists) return undefined;
  return parseActiveRelease(snap.data());
}

export async function fetchPublicEntityProjection(
  releaseId: string,
  entityId: string,
): Promise<PublicEntityProjectionDoc | undefined> {
  const snap = await getServerFirestore()
    .doc(firestorePaths.publicEntity(releaseId, entityId))
    .get();
  if (!snap.exists) return undefined;
  return parseEntityProjection(snap.data());
}

export async function listPublicEntityProjections(
  releaseId: string,
): Promise<readonly PublicEntityProjectionDoc[]> {
  const query = await getServerFirestore().collection(`publicReleases/${releaseId}/entities`).get();
  const entities: PublicEntityProjectionDoc[] = [];
  for (const doc of query.docs) {
    const parsed = parseEntityProjection(doc.data());
    if (parsed) entities.push(parsed);
  }
  return entities;
}

/** Validate raw docs without converter (used for diagnostics soft-fail).  */
export function parseActiveRelease(data: unknown): PublicActiveReleaseDoc | undefined {
  const parsed = publicActiveReleaseSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export function parseEntityProjection(data: unknown): PublicEntityProjectionDoc | undefined {
  const parsed = publicEntityProjectionSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}
