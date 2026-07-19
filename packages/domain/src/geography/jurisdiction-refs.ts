/**
 * Fail-closed jurisdiction-reference gate for projection build.
 *
 * `LawFields.jurisdictionId` (`packages/domain/src/specialized.ts`) and
 * `EntityLocation.jurisdictionIds` / `PlaceFields.jurisdictionIds`
 * (`packages/domain/src/geography/location.ts`) are plain string references today — nothing
 * validates that the id they point at actually resolves to a `jurisdictions/{id}` document.
 * This module is the gate that closes that hole: it does not decide *when* projection build
 * runs, only whether a given set of jurisdiction references is safe to publish.
 *
 * Not wired live: call `assertJurisdictionReferencesResolve` with every `jurisdictionId` /
 * `jurisdictionIds` entry collected off the claims/entities/locations slated for a projection
 * build, and a `JurisdictionResolver` backed by the real `jurisdictions` Firestore collection
 * (see `packages/firebase/src/jurisdictions/resolver.ts`,
 * `createFirestoreJurisdictionResolver`), immediately before the release manifest is built
 * (`buildReleaseManifest` in `packages/domain/src/publication/index.ts`, or its Python
 * equivalent in `workers/publication/` per ADR-007). Do not proceed to build/activate the
 * release if it throws. The gate fails closed (throws rather than returning a boolean), so
 * wiring is a single guarded call.
 */

/** Minimal read port a projection build supplies; a real implementation is Firestore-backed. */
export type JurisdictionResolver = {
  /** Returns true when `jurisdictionId` resolves to a real `jurisdictions/{id}` document. */
  exists(jurisdictionId: string): Promise<boolean> | boolean;
};

/** Synchronous variant for callers that have already loaded every candidate id in bulk. */
export type JurisdictionIdSet = ReadonlySet<string> | ReadonlyArray<string>;

export function createInMemoryJurisdictionResolver(knownIds: JurisdictionIdSet): JurisdictionResolver {
  const ids = knownIds instanceof Set ? knownIds : new Set(knownIds);
  return {
    exists(jurisdictionId: string) {
      return ids.has(jurisdictionId);
    },
  };
}

export type JurisdictionReferenceSubject = {
  /** Stable identifier of the record carrying the reference (claim id, entity id, location id). */
  readonly subjectId: string;
  /** `LawFields.jurisdictionId` is a single id; `EntityLocation.jurisdictionIds` is an array. */
  readonly jurisdictionIds: readonly string[];
};

export type DanglingJurisdictionReference = {
  readonly subjectId: string;
  readonly jurisdictionId: string;
};

export type JurisdictionReferenceCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly dangling: readonly DanglingJurisdictionReference[] };

/**
 * Evaluates every jurisdiction reference across a batch of subjects against a resolver.
 * Aggregates all failures (rather than throwing on the first) so a single build attempt
 * surfaces every dangling reference at once mirrors
 * `evaluateProjectionCitationCompleteness`'s aggregate-then-report shape.
 */
export async function evaluateJurisdictionReferences(
  subjects: readonly JurisdictionReferenceSubject[],
  resolver: JurisdictionResolver,
): Promise<JurisdictionReferenceCheckResult> {
  const dangling: DanglingJurisdictionReference[] = [];

  for (const subject of subjects) {
    for (const jurisdictionId of subject.jurisdictionIds) {
      const trimmed = jurisdictionId.trim();
      if (!trimmed) {
        dangling.push({ subjectId: subject.subjectId, jurisdictionId });
        continue;
      }
      const resolved = await resolver.exists(trimmed);
      if (!resolved) {
        dangling.push({ subjectId: subject.subjectId, jurisdictionId: trimmed });
      }
    }
  }

  if (dangling.length > 0) {
    return { ok: false, dangling };
  }
  return { ok: true };
}

/**
 * Fail-closed assertion for projection build: throws when any subject references a
 * jurisdiction id that does not resolve to a real `jurisdictions/{id}` document. A missing
 * jurisdiction reference must block the build, not silently publish an unresolved pointer.
 */
export async function assertJurisdictionReferencesResolve(
  subjects: readonly JurisdictionReferenceSubject[],
  resolver: JurisdictionResolver,
): Promise<void> {
  const result = await evaluateJurisdictionReferences(subjects, resolver);
  if (!result.ok) {
    const detail = result.dangling
      .map((d) => `${d.subjectId} -> "${d.jurisdictionId}"`)
      .join(', ');
    throw new Error(
      `Projection build blocked: dangling jurisdiction reference(s) [${detail}]. ` +
        'Every jurisdictionId must resolve to a jurisdictions/{id} document (fail-closed).',
    );
  }
}

/** Helper: collect `{subjectId, jurisdictionIds}` rows from a law's single jurisdictionId. */
export function jurisdictionReferenceFromLaw(
  subjectId: string,
  jurisdictionId: string | undefined,
): JurisdictionReferenceSubject | undefined {
  if (!jurisdictionId) return undefined;
  return { subjectId, jurisdictionIds: [jurisdictionId] };
}

/** Helper: collect `{subjectId, jurisdictionIds}` rows from an EntityLocation's array field. */
export function jurisdictionReferenceFromLocation(
  subjectId: string,
  jurisdictionIds: readonly string[] | undefined,
): JurisdictionReferenceSubject | undefined {
  if (!jurisdictionIds || jurisdictionIds.length === 0) return undefined;
  return { subjectId, jurisdictionIds };
}
