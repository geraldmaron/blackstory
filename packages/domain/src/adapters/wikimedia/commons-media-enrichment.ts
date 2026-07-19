/**
 * Orchestrates efficient Commons media enrichment over a set of entities.
 * Resolve QIDs in title batches → fetch claims in QID batches → Commons metadata batches.
 */
import {
  enwikiTitleFromDisplayName,
  evaluateCommonsMediaPropose,
  extractP18Candidates,
  isExactLabelMatch,
  summarizeCommonsMediaProposes,
  type CommonsMediaPropose,
  type EntityMediaEnrichmentInput,
} from './commons-media.js';
import type { CommonsMediaClient } from './commons-media-client.js';

export type RunCommonsMediaEnrichmentInput = {
  readonly entities: readonly EntityMediaEnrichmentInput[];
  readonly client: CommonsMediaClient;
  /** Called after each major phase for progress logging. */
  readonly onProgress?: (message: string) => void;
};

export type RunCommonsMediaEnrichmentResult = {
  readonly proposes: readonly CommonsMediaPropose[];
  readonly counts: ReturnType<typeof summarizeCommonsMediaProposes>;
  readonly apiBatches: {
    readonly titleResolve: number;
    readonly entityClaims: number;
    readonly commonsImageinfo: number;
  };
};

/**
 * Dry-run / propose-only enrichment. Does not upload bytes or write Firestore.
 */
export async function runCommonsMediaEnrichment(
  input: RunCommonsMediaEnrichmentInput,
): Promise<RunCommonsMediaEnrichmentResult> {
  const { entities, client, onProgress } = input;
  const batchSize = client.batchSize;
  let titleResolveBatches = 0;

  // Phase 0: entities that already have images
  const already: CommonsMediaPropose[] = [];
  const work: EntityMediaEnrichmentInput[] = [];
  for (const entity of entities) {
    if (entity.hasPrimaryImage) {
      already.push(
        evaluateCommonsMediaPropose({
          entity,
          ...(entity.wikidataId !== undefined ? { wikidataId: entity.wikidataId } : {}),
        }),
      );
    } else {
      work.push(entity);
    }
  }

  // Phase 1: resolve QIDs (trusted first, else exact enwiki title)
  type Resolved = {
    readonly entity: EntityMediaEnrichmentInput;
    readonly wikidataId?: string;
    readonly qidMatchMethod?: CommonsMediaPropose['qidMatchMethod'];
    readonly qidAmbiguous?: boolean;
    readonly enwikiTitle?: string;
  };

  const needsTitleResolve: { entity: EntityMediaEnrichmentInput; title: string }[] = [];
  const resolved: Resolved[] = [];

  for (const entity of work) {
    if (entity.wikidataId && /^Q\d+$/i.test(entity.wikidataId)) {
      resolved.push({
        entity,
        wikidataId: entity.wikidataId.toUpperCase().replace(/^Q/, 'Q'),
        qidMatchMethod: 'trusted_identifier',
        enwikiTitle: enwikiTitleFromDisplayName(entity.displayName),
      });
    } else {
      needsTitleResolve.push({
        entity,
        title: enwikiTitleFromDisplayName(entity.displayName),
      });
    }
  }

  onProgress?.(
    `Resolving ${needsTitleResolve.length} titles via enwiki (batch=${batchSize}); ${resolved.length} trusted QIDs`,
  );

  if (needsTitleResolve.length > 0) {
    const titles = needsTitleResolve.map((n) => n.title);
    titleResolveBatches = Math.ceil(titles.length / batchSize);
    const titleResults = await client.resolveEnwikiTitles(titles);
    const byTitle = new Map(titleResults.map((r) => [r.title.toLowerCase(), r]));

    for (const item of needsTitleResolve) {
      const hit = byTitle.get(item.title.toLowerCase());
      if (!hit || hit.missing || !hit.wikidataId) {
        resolved.push({ entity: item.entity, enwikiTitle: item.title });
        continue;
      }
      // Exact label match required (or title equals display name after normalize).
      const labelOk =
        isExactLabelMatch(item.entity.displayName, hit.label) ||
        isExactLabelMatch(item.entity.displayName, hit.title.replace(/_/g, ' '));
      if (!labelOk) {
        resolved.push({ entity: item.entity, enwikiTitle: item.title });
        continue;
      }
      resolved.push({
        entity: item.entity,
        wikidataId: hit.wikidataId,
        qidMatchMethod: 'enwiki_exact_title',
        enwikiTitle: hit.title,
      });
    }
  }

  // Phase 2: batch-fetch claims for unique QIDs
  const qids = [
    ...new Set(resolved.map((r) => r.wikidataId).filter((q): q is string => Boolean(q))),
  ];
  onProgress?.(`Fetching claims for ${qids.length} unique QIDs`);
  const entityClaimsBatches = qids.length === 0 ? 0 : Math.ceil(qids.length / batchSize);
  const entitiesById = qids.length > 0 ? await client.fetchEntitiesById(qids) : new Map();

  // Phase 3: collect single-P18 file titles, batch Commons imageinfo
  const fileTitles: string[] = [];
  const p18ByEntity = new Map<string, ReturnType<typeof extractP18Candidates>>();
  for (const r of resolved) {
    if (!r.wikidataId) continue;
    const wd = entitiesById.get(r.wikidataId);
    const candidates = extractP18Candidates(wd);
    p18ByEntity.set(r.entity.entityId, candidates);
    if (candidates.length === 1) {
      fileTitles.push(candidates[0]!.fileTitle);
    }
  }

  const uniqueFiles = [...new Set(fileTitles)];
  onProgress?.(`Fetching Commons metadata for ${uniqueFiles.length} files`);
  const commonsImageinfoBatches =
    uniqueFiles.length === 0 ? 0 : Math.ceil(uniqueFiles.length / batchSize);
  const imageMeta =
    uniqueFiles.length > 0 ? await client.fetchCommonsImageMetadata(uniqueFiles) : new Map();

  // Phase 4: evaluate proposes
  const proposes: CommonsMediaPropose[] = [...already];
  for (const r of resolved) {
    const candidates = p18ByEntity.get(r.entity.entityId) ?? [];
    const single = candidates.length === 1 ? candidates[0]!.fileTitle : undefined;
    const image =
      single !== undefined
        ? imageMeta.get(single) ?? imageMeta.get(single.replace(/^File:/i, ''))
        : undefined;

    proposes.push(
      evaluateCommonsMediaPropose({
        entity: r.entity,
        ...(r.wikidataId !== undefined ? { wikidataId: r.wikidataId } : {}),
        ...(r.qidMatchMethod !== undefined ? { qidMatchMethod: r.qidMatchMethod } : {}),
        ...(r.qidAmbiguous !== undefined ? { qidAmbiguous: r.qidAmbiguous } : {}),
        ...(r.enwikiTitle !== undefined ? { enwikiTitle: r.enwikiTitle } : {}),
        p18Candidates: candidates,
        ...(image !== undefined ? { image } : {}),
      }),
    );
  }

  return {
    proposes,
    counts: summarizeCommonsMediaProposes(proposes),
    apiBatches: {
      titleResolve: titleResolveBatches,
      entityClaims: entityClaimsBatches,
      commonsImageinfo: commonsImageinfoBatches,
    },
  };
}
