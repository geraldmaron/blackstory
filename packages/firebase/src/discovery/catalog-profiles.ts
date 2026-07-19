/**
 * Soft catalog profiles for discovery: map publicSearchIndex docs to ResolutionProfiles.
 *
 * Best practice is propose/review match (attachCatalogMatch), NOT hard exclusion of known
 * entities — new evidence about existing people/places is research-worthy. Load is capped
 * and opt-in via DISCOVERY_CATALOG_FROM=firestore.
 */
import { isEntityKind, type CanonicalEntity, type EntityKind, type ResolutionProfile } from '@repo/domain';
import type { Firestore } from 'firebase-admin/firestore';

export const DISCOVERY_CATALOG_PROFILE_DEFAULT_MAX = 500 as const;

/** Minimal leaf used for resolution only — not a full publicSearchIndex projection. */
export type DiscoveryCatalogLeaf = {
  readonly id: string;
  readonly kind: EntityKind;
  readonly displayName: string;
  readonly aliases: readonly string[];
};

export type DiscoveryCatalogPage = {
  readonly docs: readonly DiscoveryCatalogLeaf[];
  readonly nextCursor?: string;
};

export type DiscoveryCatalogPager = {
  page(input: {
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<DiscoveryCatalogPage>;
};

type LooseSearchIndexRow = {
  readonly id: string;
  readonly data: () => Record<string, unknown>;
};

/** Build a resolution-only CanonicalEntity from a catalog leaf. */
export function resolutionProfileFromCatalogLeaf(
  leaf: DiscoveryCatalogLeaf,
  nowIso: string,
): ResolutionProfile {
  const aliases =
    leaf.aliases.length > 0
      ? leaf.aliases.map((value) => ({ value, kind: 'aka' as const }))
      : undefined;
  const entity: CanonicalEntity = {
    id: leaf.id,
    kind: leaf.kind,
    displayName: leaf.displayName,
    ...(aliases !== undefined ? { aliases } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { entity };
}

/** @deprecated Prefer resolutionProfileFromCatalogLeaf — kept for call-site stability. */
export function resolutionProfileFromPublicSearchIndex(
  leaf: DiscoveryCatalogLeaf,
  nowIso: string,
): ResolutionProfile {
  return resolutionProfileFromCatalogLeaf(leaf, nowIso);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Normalize a Firestore (or test double) row into a catalog leaf when possible. */
export function publicSearchIndexDocFromRow(
  row: LooseSearchIndexRow,
): DiscoveryCatalogLeaf | undefined {
  const data = row.data();
  if (typeof data['displayName'] !== 'string' || typeof data['kind'] !== 'string') {
    return undefined;
  }
  if (!isEntityKind(data['kind'])) {
    return undefined;
  }
  const displayName = data['displayName'].trim();
  if (displayName.length === 0) {
    return undefined;
  }
  return {
    id: row.id,
    kind: data['kind'],
    displayName,
    aliases: stringArray(data['aliases']),
  };
}

/**
 * Page a catalog pager until maxProfiles is reached. Empty catalog → empty profiles
 * (campaigns proceed without match enrichment — never hard-exclude).
 */
export async function loadDiscoveryCatalogProfiles(input: {
  readonly pager: DiscoveryCatalogPager;
  readonly maxProfiles?: number;
  readonly nowIso?: string;
}): Promise<{
  readonly profiles: readonly ResolutionProfile[];
  readonly catalogTitles: readonly string[];
  readonly truncated: boolean;
}> {
  const maxProfiles = input.maxProfiles ?? DISCOVERY_CATALOG_PROFILE_DEFAULT_MAX;
  if (maxProfiles < 1) {
    throw new Error('maxProfiles must be at least 1');
  }
  const nowIso = input.nowIso ?? new Date().toISOString();
  const profiles: ResolutionProfile[] = [];
  let cursor: string | undefined;
  let truncated = false;

  while (profiles.length < maxProfiles) {
    const remaining = maxProfiles - profiles.length;
    const page = await input.pager.page({
      limit: Math.min(100, remaining),
      ...(cursor !== undefined ? { cursor } : {}),
    });

    for (const doc of page.docs) {
      if (profiles.length >= maxProfiles) {
        truncated = true;
        break;
      }
      profiles.push(resolutionProfileFromCatalogLeaf(doc, nowIso));
    }

    if (profiles.length >= maxProfiles) {
      // Cap hit: truncated if this page had leftover docs or another page exists.
      truncated =
        page.docs.length > remaining ||
        page.nextCursor !== undefined ||
        truncated;
      break;
    }
    if (page.nextCursor === undefined || page.docs.length === 0) {
      break;
    }
    cursor = page.nextCursor;
  }

  return {
    profiles,
    catalogTitles: profiles.map((profile) => profile.entity.displayName),
    truncated,
  };
}

/**
 * Admin Firestore pager over `publicSearchIndex` ordered by document id.
 * Accepts a narrow query surface so unit tests can inject doubles without firebase-admin.
 */
export function createPublicSearchIndexCatalogPager(query: {
  page(input: {
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<{ readonly docs: readonly LooseSearchIndexRow[] }>;
}): DiscoveryCatalogPager {
  return {
    async page(input) {
      const snap = await query.page(input);
      const docs: DiscoveryCatalogLeaf[] = [];
      for (const row of snap.docs) {
        const parsed = publicSearchIndexDocFromRow(row);
        if (parsed !== undefined) {
          docs.push(parsed);
        }
      }
      const last = snap.docs[snap.docs.length - 1];
      return {
        docs,
        ...(last !== undefined && snap.docs.length >= input.limit
          ? { nextCursor: last.id }
          : {}),
      };
    },
  };
}

/**
 * Live Admin SDK pager for scheduled Functions / Jobs.
 * Soft match only — callers must not filter candidates out solely because a match exists.
 */
export function createFirestorePublicSearchIndexCatalogPager(
  firestore: Pick<Firestore, 'collection'>,
): DiscoveryCatalogPager {
  return createPublicSearchIndexCatalogPager({
    async page(input) {
      let query = firestore
        .collection('publicSearchIndex')
        .orderBy('__name__')
        .limit(input.limit);
      if (input.cursor !== undefined && input.cursor.length > 0) {
        query = query.startAfter(input.cursor);
      }
      const snapshot = await query.get();
      return {
        docs: snapshot.docs.map((doc) => ({
          id: doc.id,
          data: () => doc.data() as Record<string, unknown>,
        })),
      };
    },
  });
}
