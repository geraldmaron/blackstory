import { type JurisdictionDoc } from './schema.js';

export type JurisdictionDocResolver = {
  exists(jurisdictionId: string): Promise<boolean>;
  get(jurisdictionId: string): Promise<JurisdictionDoc | undefined>;
};

/** Read-only in-memory resolver for tests and offline validation (no database dependency). */
export function createInMemoryJurisdictionDocResolver(
  docs: readonly JurisdictionDoc[],
): JurisdictionDocResolver {
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
