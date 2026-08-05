/**
 * The chapter-cites-record edge.
 *
 * The thesis of v9 is that every record links back to the writing about it. The record side of
 * that link had no implementation: an entity could be pinned on the Atlas, opened, and read in
 * full without ever learning which chapter put it there. This module derives that edge from the
 * article projection the release already publishes, so it costs one pass over documents the
 * server is loading anyway rather than a new pipeline stage.
 *
 * Two signals, and they are not equivalent:
 *
 *   `mapInset` blocks name an entity id explicitly and pin it on a map inside the prose. The
 *   chapter is looking straight at the record. Relation: "mapped in".
 *
 *   `relatedEntityIds` is the projection's editorial association list. Weaker — the chapter
 *   touches the record without necessarily drawing it. Relation: "referenced in".
 *
 * When both fire for the same (entity, chapter) pair the stronger one wins, because the reader
 * is being told what kind of attention the chapter actually paid to this record and "referenced"
 * would understate a chapter that maps it.
 *
 * Deliberately NOT derived from `[ref:<id>]` inline markers or from packet ids. Those resolve to
 * a bibliography reference and a theme-impact packet respectively; neither carries an entity id,
 * so walking them would mean inferring the record from a source label. An edge the archive shows
 * a reader has to be one the data actually states.
 */
import type { PublicArticleProjectionDoc } from '@repo/schemas';

/** How a chapter attends to a record. Ordered weakest to strongest; the order is load-bearing. */
export const CITES_RELATIONS = ['referenced in', 'mapped in'] as const;

export type CitesRelation = (typeof CITES_RELATIONS)[number];

/** One chapter that cites a record, as the record's own surfaces render it. */
export type ChapterCitation = {
  readonly slug: string;
  readonly title: string;
  /** Stated in words, not a slug: "mapped in", "referenced in". */
  readonly relation: CitesRelation;
  readonly href: string;
};

/** entity id -> the chapters that cite it. Absent key means no chapter cites that record. */
export type CitesEdgeIndex = Readonly<Record<string, readonly ChapterCitation[]>>;

function strength(relation: CitesRelation): number {
  return CITES_RELATIONS.indexOf(relation);
}

/** Entity ids a single article cites, each with the strongest relation that article supports. */
export function articleCitedEntities(
  doc: PublicArticleProjectionDoc,
): ReadonlyMap<string, CitesRelation> {
  const cited = new Map<string, CitesRelation>();
  const claim = (entityId: string, relation: CitesRelation): void => {
    const id = entityId.trim();
    if (id === '') return;
    const held = cited.get(id);
    if (held === undefined || strength(relation) > strength(held)) cited.set(id, relation);
  };

  for (const entityId of doc.relatedEntityIds) claim(entityId, 'referenced in');
  for (const block of doc.body) {
    if (block.type === 'mapInset') claim(block.entityId, 'mapped in');
  }
  return cited;
}

/**
 * Inverts the article set into the record-side index.
 *
 * Sorted by title within each record so the list a reader sees is stable across releases —
 * publish order would reshuffle a record's chapter list every time an unrelated chapter shipped.
 */
export function buildCitesEdge(docs: readonly PublicArticleProjectionDoc[]): CitesEdgeIndex {
  const byEntity = new Map<string, ChapterCitation[]>();

  for (const doc of docs) {
    for (const [entityId, relation] of articleCitedEntities(doc)) {
      const citations = byEntity.get(entityId) ?? [];
      citations.push({
        slug: doc.slug,
        title: doc.title,
        relation,
        href: `/chapters/${doc.slug}`,
      });
      byEntity.set(entityId, citations);
    }
  }

  const index: Record<string, readonly ChapterCitation[]> = {};
  for (const [entityId, citations] of byEntity) {
    index[entityId] = [...citations].sort(
      (a, b) => a.title.localeCompare(b.title) || a.slug.localeCompare(b.slug),
    );
  }
  return index;
}

/** The chapters citing one record, empty when none do. */
export function chaptersCiting(
  index: CitesEdgeIndex,
  entityId: string | undefined,
): readonly ChapterCitation[] {
  if (!entityId) return [];
  return index[entityId] ?? [];
}
