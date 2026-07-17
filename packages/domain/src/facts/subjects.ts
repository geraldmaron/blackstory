/**
 * `FactRecord.subjects` as a graph-view input.
 *
 * Concrete FactRecord-shaped counterpart to `../graph/fact-subjects.ts`'s dependency-injected
 * `FactSubjectSource` / `FactSubjectRef` structural port. `toFactSubjectSource` adapts a real
 * `FactRecord` into that shape so `mirrorFactSubjectsIntoRelationships` can fold a fact's
 * subjects into the published browse graph at publish time. A fact linked to an entity only
 * through `subjects` is therefore never invisible to the graph.
 *
 * Every `subjects` edge must resolve to a real `CanonicalEntity` id with a matching kind —
 * `assertFactSubjectsResolve` is the fail-closed check against an injected resolver
 * (dependency-injected, matching `../geography/jurisdiction-refs.ts`'s `JurisdictionResolver`
 * convention), so a fact can never reference an entity that does not exist or was resolved under
 * the wrong kind.
 */
import { mirrorFactSubjectsIntoRelationships, type FactSubjectSource } from '../graph/fact-subjects.js';
import type { EntityKind } from '../entity-kinds.js';
import type { TemporalContext } from '../relationship.js';
import type { FactRecord } from './record.js';

/** Dependency-injected resolver from entity id -> its kind, or `undefined` when the id does not
 * resolve to a real `CanonicalEntity`. Mirrors `JurisdictionResolver`'s injection style. */
export type FactSubjectEntityResolver = (entityId: string) => EntityKind | undefined;

export type DanglingFactSubjectReference = {
  readonly factId: string;
  readonly entityId: string;
  readonly reason: 'entity_not_found' | 'kind_mismatch';
  readonly expectedKind: EntityKind;
  readonly resolvedKind?: EntityKind;
};

/**
 * Evaluates every subject edge on a fact against the injected resolver. Aggregates ALL failures
 * (never stops at the first) so one call surfaces the complete dangling-reference list same
 * posture as `../geography/jurisdiction-refs.ts`'s `evaluateJurisdictionReferences`.
 */
export function evaluateFactSubjectReferences(
  fact: Pick<FactRecord, 'id' | 'subjects'>,
  resolve: FactSubjectEntityResolver,
): readonly DanglingFactSubjectReference[] {
  const dangling: DanglingFactSubjectReference[] = [];
  for (const subject of fact.subjects) {
    const resolvedKind = resolve(subject.entityId);
    if (resolvedKind === undefined) {
      dangling.push({
        factId: fact.id,
        entityId: subject.entityId,
        reason: 'entity_not_found',
        expectedKind: subject.kind,
      });
      continue;
    }
    if (resolvedKind !== subject.kind) {
      dangling.push({
        factId: fact.id,
        entityId: subject.entityId,
        reason: 'kind_mismatch',
        expectedKind: subject.kind,
        resolvedKind,
      });
    }
  }
  return dangling;
}

/** Fail-closed: throws when any `subjects` edge is dangling or kind-mismatched. */
export function assertFactSubjectsResolve(
  fact: Pick<FactRecord, 'id' | 'subjects'>,
  resolve: FactSubjectEntityResolver,
): void {
  const dangling = evaluateFactSubjectReferences(fact, resolve);
  if (dangling.length > 0) {
    const detail = dangling
      .map((d) =>
        d.reason === 'entity_not_found'
          ? `${d.entityId} (not found, expected kind ${d.expectedKind})`
          : `${d.entityId} (expected kind ${d.expectedKind}, resolved as ${d.resolvedKind})`,
      )
      .join(', ');
    throw new Error(`Fact ${fact.id} has dangling/kind-mismatched subjects[] references: ${detail}`);
  }
}

/**
 * Adapts a `FactRecord` into `../graph/fact-subjects.ts`'s `FactSubjectSource` shape so
 * `mirrorFactSubjectsIntoRelationships` can fold it into the published browse graph. A
 * fact's own citations double as the mirrored edge's evidence (facts are citation-backed by
 * construction), matching that module's own documented convention.
 */
export function toFactSubjectSource(
  fact: Pick<FactRecord, 'id' | 'subjects' | 'citations' | 'when'>,
): FactSubjectSource {
  const temporal: TemporalContext | undefined = fact.when
    ? { validFrom: fact.when.validFrom, ...(fact.when.validTo !== undefined ? { validTo: fact.when.validTo } : {}) }
    : undefined;
  return {
    factId: fact.id,
    subjects: fact.subjects.map((subject) => ({
      subjectEntityId: subject.entityId,
      ...(subject.role ? { role: subject.role } : {}),
    })),
    evidenceIds: fact.citations.map((citation) => citation.csl.id),
    ...(temporal ? { temporal } : {}),
  };
}

/** Convenience batch adapter + mirror in one call, for a publish-time graph-build step. */
export function mirrorFactsIntoRelationships(
  facts: readonly Pick<FactRecord, 'id' | 'subjects' | 'citations' | 'when'>[],
) {
  return mirrorFactSubjectsIntoRelationships(facts.map(toFactSubjectSource));
}
