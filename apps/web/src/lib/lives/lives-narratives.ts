/**
 * Era narratives for Lives. A column's prose is an ordinary article SERIES in the existing article
 * pipeline (`reference.articles`, `kind: 'article'`), so it is drafted, reviewed and gated exactly
 * like a chapter: citation integrity, source tiers, the standalone-prose gate, the Neo ship loop.
 * Nothing about storage or publishing is new.
 *
 *   series.id        `lives-<question key>`, e.g. `lives-home`
 *   series.position  1-based index into LIVES_ERAS: 1 is the 1870s-1890s, 6 is the 2010s-2020s
 *
 * Position is the join key on purpose. A title or an era label can be reworded by an editor; a
 * position cannot drift into pointing at a different era without the mismatch being reported.
 */
import type { HydratedArticle } from '../articles/hydrate';
import { LIVES_ERAS, type LivesMilestoneKey } from './lives-milestones';

export const LIVES_NARRATIVE_TAG = 'Lives';

export function livesNarrativeSeriesId(key: LivesMilestoneKey): string {
  return `lives-${key}`;
}

/**
 * The panel supplies the era's heading and the figure, so a narrative carries prose and evidence
 * only. Packet-backed blocks (figure, stat, timeline, primaryDocument) are out because their
 * provenance numbers are assigned at hydration and cannot be renumbered across eras.
 */
export const LIVES_NARRATIVE_BLOCK_TYPES = ['paragraph', 'pullquote', 'image', 'list'] as const;

export type LivesNarrativeMapping = {
  readonly byEraId: ReadonlyMap<string, HydratedArticle>;
  /** Anything that would make a panel lie about which era its prose belongs to. */
  readonly problems: readonly string[];
};

export function mapLivesNarrativesToEras(
  articles: readonly HydratedArticle[],
): LivesNarrativeMapping {
  const byEraId = new Map<string, HydratedArticle>();
  const problems: string[] = [];
  for (const article of articles) {
    const { doc } = article;
    const position = doc.series?.position;
    const era = position === undefined ? undefined : LIVES_ERAS[position - 1];
    if (!era) {
      problems.push(
        `${doc.slug}: series position ${position} is not an era (1 to ${LIVES_ERAS.length})`,
      );
      continue;
    }
    if (byEraId.has(era.id)) {
      problems.push(`${doc.slug}: a second narrative claims era ${era.id}; the first one is kept`);
      continue;
    }
    if (doc.eraLabel !== era.label) {
      problems.push(`${doc.slug}: eraLabel "${doc.eraLabel}" does not match era "${era.label}"`);
    }
    for (const block of doc.body) {
      if (!(LIVES_NARRATIVE_BLOCK_TYPES as readonly string[]).includes(block.type)) {
        problems.push(`${doc.slug}: a Lives narrative cannot carry a "${block.type}" block`);
      }
    }
    byEraId.set(era.id, article);
  }
  return { byEraId, problems };
}

/**
 * Several narratives share one page, and each numbers its references from 1, so their `#ref-<n>`
 * anchors would collide. This numbers them continuously in era order: the second era's first
 * reference follows the first era's last.
 */
export function renumberLivesNarrativeReferences(
  byEraId: ReadonlyMap<string, HydratedArticle>,
): ReadonlyMap<string, HydratedArticle> {
  const out = new Map<string, HydratedArticle>();
  let offset = 0;
  for (const era of LIVES_ERAS) {
    const article = byEraId.get(era.id);
    if (!article) continue;
    const shift = offset;
    out.set(era.id, {
      ...article,
      references: article.references.map((ref) => ({ ...ref, number: ref.number + shift })),
      refNumberById: new Map(
        [...article.refNumberById].map(([id, number]) => [id, number + shift] as const),
      ),
    });
    offset += article.references.length;
  }
  return out;
}
