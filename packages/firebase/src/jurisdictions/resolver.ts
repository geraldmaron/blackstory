/**
 * Firestore-backed jurisdiction lookups for the `jurisdictions` collection.
 *
 * `createFirestoreJurisdictionResolver`'s return value is structurally compatible with
 * `@repo/domain`'s `JurisdictionResolver` interface
 * (`packages/domain/src/geography/jurisdiction-refs.ts` `{ exists(id): Promise<boolean> }`)
 * by shape. Once `jurisdiction-refs.ts` is exported from the domain barrel, this resolver
 * can be passed directly to `assertJurisdictionReferencesResolve` — the shape already matches.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import { jurisdictionSchema, type JurisdictionDoc } from './schema.js';

export type FirestoreJurisdictionResolver = {
  exists(jurisdictionId: string): Promise<boolean>;
  get(jurisdictionId: string): Promise<JurisdictionDoc | undefined>;
};

export function createFirestoreJurisdictionResolver(
  firestore: Firestore,
): FirestoreJurisdictionResolver {
  const collection = firestore.collection(FIRESTORE_ROOT.jurisdictions);
  return {
    async exists(jurisdictionId: string) {
      const snapshot = await collection.doc(jurisdictionId).get();
      return snapshot.exists;
    },
    async get(jurisdictionId: string) {
      const snapshot = await collection.doc(jurisdictionId).get();
      if (!snapshot.exists) return undefined;
      return jurisdictionSchema.parse(snapshot.data());
    },
  };
}

/** Read-only in-memory resolver for tests and offline validation (no Firestore dependency). */
export function createInMemoryJurisdictionDocResolver(
  docs: readonly JurisdictionDoc[],
): FirestoreJurisdictionResolver {
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  return {
    async exists(jurisdictionId: string) {
      return byId.has(jurisdictionId);
    },
    async get(jurisdictionId: string) {
      return byId.get(jurisdictionId);
    },
  };
}
