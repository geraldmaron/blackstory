/**
 * FactRecord `subjects` as a graph-view edge source.
 *
 * `subjects` are typed edges from a fact to the CanonicalEntity ids it is about
 * (Place/Person/Event/Law/...). Without treating those as a graph input, an entity connected
 * to a fact only through `subjects` (e.g. a person who is the subject of the fact record of
 * their death, with no separate formal `EntityRelationship`) would be invisible to the
 * published browse graph.
 *
 * `FactSubjectRef` / `FactSubjectSource` below are a minimal structural port (dependency-injected,
 * same discipline as `../geography/jurisdiction-refs.ts`'s `JurisdictionResolver` and
 * `../map/map-source.ts`'s `MapRedactLocationFn`).
 *
 * Not wired live to a separate collection: callers supply `FactSubjectSource` values derived
 * from real `FactRecord` subjects at publish/mirror time.
 *
 * Mirroring choice: every unordered pair of distinct subjects on the same fact becomes one
 * `cites` edge (never `caused`/`enabled`/`influenced`/etc. — a fact merely documenting two
 * entities together asserts co-occurrence, not causation or participation weight; see
 * `../relationship.ts`'s `cites` semantics). The synthesized id is deterministic
 * (`fact-mirror:{factId}:{a}:{b}`, lexicographically ordered) so re-running the mirror step
 * during a rebuild is idempotent and the output never depends on subjects input order.
 */
import type { EntityRelationship, TemporalContext } from '../relationship.js';

export type FactSubjectRef = {
  readonly subjectEntityId: string;
  /** Structural placeholder for future typed subject role (e.g. victim, actor, location) —
   * not yet a closed vocabulary; carried through for provenance only, never interpreted by
   * the mirroring logic below. */
  readonly role?: string;
};

export type FactSubjectSource = {
  readonly factId: string;
  readonly subjects: readonly FactSubjectRef[];
  /** facts are citation-backed by construction; mirrored edges reuse the fact's own
   * evidence so `assertRelationshipHasEvidence` still holds on the synthesized edge. */
  readonly evidenceIds: readonly string[];
  readonly temporal?: TemporalContext;
};

export type MirroredFactSubjectRelationship = Pick<
  EntityRelationship,
  'id' | 'fromEntityId' | 'toEntityId' | 'type' | 'evidenceIds' | 'temporal' | 'notes'
> & {
  readonly type: 'cites';
  /** The fact id this edge was mirrored from lets a consumer trace the edge back to its
   * originating fact record rather than treating it as an operator-authored relationship. */
  readonly sourceFactId: string;
};

function sortedPairs(subjectIds: readonly string[]): readonly [string, string][] {
  const unique = [...new Set(subjectIds)].sort();
  const pairs: [string, string][] = [];
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      pairs.push([unique[i]!, unique[j]!]);
    }
  }
  return pairs;
}

/**
 * Mirrors every fact's `subjects` into synthetic `cites` relationships between every pair of
 * co-subjects, so a graph-view build can fold them into adjacency/decade/all-time views alongside
 * real `EntityRelationship` rows. A fact with 0 or 1 subjects mirrors to nothing (no pair exists);
 * a fact with N subjects mirrors to exactly N*(N-1)/2 edges, deterministically ordered.
 */
export function mirrorFactSubjectsIntoRelationships(
  facts: readonly FactSubjectSource[],
): readonly MirroredFactSubjectRelationship[] {
  const mirrored: MirroredFactSubjectRelationship[] = [];
  for (const fact of [...facts].sort((a, b) => a.factId.localeCompare(b.factId))) {
    const subjectIds = fact.subjects.map((s) => s.subjectEntityId);
    const evidenceIds = fact.evidenceIds.length > 0 ? fact.evidenceIds : [fact.factId];
    for (const [a, b] of sortedPairs(subjectIds)) {
      mirrored.push({
        id: `fact-mirror:${fact.factId}:${a}:${b}`,
        fromEntityId: a,
        toEntityId: b,
        type: 'cites',
        evidenceIds,
        ...(fact.temporal ? { temporal: fact.temporal } : {}),
        notes: `Mirrored from BB-086 FactRecord ${fact.factId} subjects[] (BB-092 acceptance criterion 8).`,
        sourceFactId: fact.factId,
      });
    }
  }
  return mirrored;
}
