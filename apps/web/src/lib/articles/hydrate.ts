/**
 * Article hydration: bind a `PublicArticleProjectionDoc` to the theme-impact
 * packets and entities its data blocks reference, and build the single numbered
 * reference list that both inline `[ref:<id>]` prose markers and data-block
 * provenance resolve into.
 *
 * The article doc is the narrative spine; packets remain the evidence store.
 * A block whose packet/ref/entity is missing is dropped (logged) rather than
 * throwing — the rest of the article still renders. This mirrors the moment
 * hydration in lib/theme-impact/source.ts, generalized to typed body blocks.
 */
import type {
  ArticleBodyBlockDoc,
  ArticleImageDoc,
  ArticleReferenceDoc,
  PublicArticleProjectionDoc,
} from '@repo/schemas';
import type {
  ThemeImpactMethodStance,
  ThemeImpactObservationView,
  ThemeImpactPacketView,
  ThemeImpactProvenanceView,
} from '@repo/domain';
import type { PublicEntityView } from '../../data/public-seed';

/** One numbered entry in the article's references section. */
export type ArticleReferenceEntry = {
  readonly number: number;
  /** Stable dedupe key: the authored ref id or the provenance URL. */
  readonly key: string;
  readonly label: string;
  readonly url: string;
  readonly locator?: string;
};

export type HydratedArticleParagraph = {
  readonly type: 'paragraph';
  readonly text: string;
};

/** Call-out list. Items keep their inline citation markers for per-item rendering. */
export type HydratedArticleList = {
  readonly type: 'list';
  readonly style: 'bullet' | 'number';
  readonly items: readonly string[];
};

export type HydratedArticlePullQuote = {
  readonly type: 'pullquote';
  readonly text: string;
  readonly attribution?: string;
};

export type HydratedArticleHeading = {
  readonly type: 'heading';
  readonly level: 2 | 3;
  readonly text: string;
};

export type HydratedArticleFigure = {
  readonly type: 'figure';
  readonly caption: string;
  readonly observations: readonly ThemeImpactObservationView[];
  readonly sourceNumbers: readonly number[];
};

export type HydratedArticleStat = {
  readonly type: 'stat';
  readonly figure: string;
  readonly claim: string;
  readonly caption?: string;
  readonly provenance: ThemeImpactProvenanceView;
  readonly methodStance: ThemeImpactMethodStance;
  readonly sourceNumbers: readonly number[];
};

export type HydratedArticlePrimaryDocument = {
  readonly type: 'primaryDocument';
  readonly title: string;
  readonly summary: string;
  readonly quote?: string;
  readonly dateLabel?: string;
  readonly provenance?: ThemeImpactProvenanceView;
  readonly sourceNumbers: readonly number[];
};

export type HydratedArticleTimelineEvent = { readonly label: string; readonly date: string };

export type HydratedArticleTimeline = {
  readonly type: 'timeline';
  readonly events: readonly HydratedArticleTimelineEvent[];
  readonly policyEras: ThemeImpactPacketView['policyEras'];
};

export type HydratedArticleMapInset = {
  readonly type: 'mapInset';
  readonly entityId: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: PublicEntityView['locationPrecision'];
};

export type HydratedArticleDispute = {
  readonly type: 'dispute';
  readonly label: string;
  readonly sideA: { readonly sourceLabel: string; readonly claim: string };
  readonly sideB: { readonly sourceLabel: string; readonly claim: string };
};

export type HydratedArticleImage = {
  readonly type: 'image';
  readonly image: ArticleImageDoc;
  readonly caption?: string;
};

export type HydratedArticleBlock =
  | HydratedArticleHeading
  | HydratedArticleParagraph
  | HydratedArticleList
  | HydratedArticlePullQuote
  | HydratedArticleFigure
  | HydratedArticleStat
  | HydratedArticlePrimaryDocument
  | HydratedArticleTimeline
  | HydratedArticleMapInset
  | HydratedArticleDispute
  | HydratedArticleImage;

export type HydratedArticle = {
  readonly doc: PublicArticleProjectionDoc;
  readonly blocks: readonly HydratedArticleBlock[];
  readonly references: readonly ArticleReferenceEntry[];
  /** Maps an inline `[ref:<id>]` id to its reference number, for prose rendering. */
  readonly refNumberById: ReadonlyMap<string, number>;
};

const INLINE_CITATION_PATTERN = /\[ref:([a-z0-9]+(?:-[a-z0-9]+)*)\]/g;

function warn(message: string): void {
  console.warn(`[articles] ${message}`);
}

/** Provenance rows a data block cites, in reading order. */
function blockProvenance(
  block: ArticleBodyBlockDoc,
  packet: ThemeImpactPacketView | undefined,
): readonly ThemeImpactProvenanceView[] {
  if (!packet) return [];
  switch (block.type) {
    case 'stat': {
      const row =
        block.kind === 'observation'
          ? packet.observations.find((o) => o.id === block.refId)
          : packet.derived.find((d) => d.id === block.refId);
      return row ? [row.provenance] : [];
    }
    case 'primaryDocument': {
      const artifact = packet.artifacts.find((a) => a.id === block.refId);
      return artifact?.provenance ? [artifact.provenance] : [];
    }
    case 'figure': {
      const rows = block.metricIds
        ? packet.observations.filter((o) => o.metricId && block.metricIds!.includes(o.metricId))
        : packet.observations;
      const seen = new Set<string>();
      const out: ThemeImpactProvenanceView[] = [];
      for (const row of rows) {
        if (seen.has(row.provenance.source_url)) continue;
        seen.add(row.provenance.source_url);
        out.push(row.provenance);
      }
      return out;
    }
    case 'timeline': {
      const seen = new Set<string>();
      const out: ThemeImpactProvenanceView[] = [];
      for (const artifact of packet.artifacts) {
        if (!artifact.dateLabel || !artifact.provenance) continue;
        if (seen.has(artifact.provenance.source_url)) continue;
        seen.add(artifact.provenance.source_url);
        out.push(artifact.provenance);
      }
      return out;
    }
    default:
      return [];
  }
}

/**
 * Build the single numbered reference list by walking the body in reading
 * order. Inline `[ref:<id>]` markers resolve against the authored references;
 * data blocks contribute their packet provenance. Entries dedupe by authored
 * ref id or provenance URL, and are numbered by first appearance.
 */
export function buildArticleReferences(
  doc: PublicArticleProjectionDoc,
  packetsById: ReadonlyMap<string, ThemeImpactPacketView>,
): {
  readonly references: readonly ArticleReferenceEntry[];
  readonly refNumberById: Map<string, number>;
} {
  const referenceById = new Map<string, ArticleReferenceDoc>(
    doc.references.map((ref) => [ref.id, ref]),
  );
  // Authored references index by URL so a narrative citation and a data-block's
  // packet provenance pointing at the same source collapse into one entry.
  const authoredByUrl = new Map<string, ArticleReferenceDoc>(
    doc.references.map((ref) => [ref.url, ref]),
  );
  const entries: ArticleReferenceEntry[] = [];
  const numberByUrl = new Map<string, number>();
  const refNumberById = new Map<string, number>();

  const ensure = (label: string, url: string, locator?: string): number => {
    const existing = numberByUrl.get(url);
    if (existing !== undefined) return existing;
    const number = entries.length + 1;
    numberByUrl.set(url, number);
    entries.push(
      locator ? { number, key: url, label, url, locator } : { number, key: url, label, url },
    );
    return number;
  };

  for (const block of doc.body) {
    // Every block carrying author prose contributes citation numbers, list items
    // included — a call-out's reference has to land in the numbered list like any other.
    const proseTexts =
      block.type === 'paragraph' || block.type === 'pullquote'
        ? [block.text]
        : block.type === 'list'
          ? block.items
          : [];
    if (proseTexts.length > 0) {
      for (const text of proseTexts) {
        for (const match of text.matchAll(INLINE_CITATION_PATTERN)) {
          const id = match[1]!;
          const ref = referenceById.get(id);
          if (!ref) {
            warn(`inline [ref:${id}] has no matching reference in "${doc.slug}" — skipping marker`);
            continue;
          }
          refNumberById.set(id, ensure(ref.label, ref.url, ref.locator));
        }
      }
      continue;
    }
    const packet =
      'packetId' in block && block.packetId ? packetsById.get(block.packetId) : undefined;
    for (const prov of blockProvenance(block, packet)) {
      const authored = authoredByUrl.get(prov.source_url);
      ensure(
        authored?.label ?? prov.humanCitation ?? prov.source,
        prov.source_url,
        authored?.locator,
      );
    }
  }

  return { references: entries, refNumberById };
}

function sourceNumbersFor(
  block: ArticleBodyBlockDoc,
  packet: ThemeImpactPacketView | undefined,
  numberByUrl: ReadonlyMap<string, number>,
): number[] {
  const numbers: number[] = [];
  for (const prov of blockProvenance(block, packet)) {
    const n = numberByUrl.get(prov.source_url);
    if (n !== undefined && !numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/** Hydrate every body block, dropping any whose evidence cannot be resolved. */
export function hydrateArticle(
  doc: PublicArticleProjectionDoc,
  packets: readonly ThemeImpactPacketView[],
  entities: readonly PublicEntityView[],
): HydratedArticle {
  const packetsById = new Map<string, ThemeImpactPacketView>(
    packets.filter((p) => p.packetId).map((p) => [p.packetId as string, p]),
  );
  const entitiesById = new Map<string, PublicEntityView>(entities.map((e) => [e.id, e]));

  const { references, refNumberById } = buildArticleReferences(doc, packetsById);
  const numberByUrl = new Map(references.map((ref) => [ref.url, ref.number]));

  const blocks: HydratedArticleBlock[] = [];
  for (const block of doc.body) {
    const hydrated = hydrateBlock(block, packetsById, entitiesById, numberByUrl, doc.slug);
    if (hydrated) blocks.push(hydrated);
  }

  return { doc, blocks, references, refNumberById };
}

function hydrateBlock(
  block: ArticleBodyBlockDoc,
  packetsById: ReadonlyMap<string, ThemeImpactPacketView>,
  entitiesById: ReadonlyMap<string, PublicEntityView>,
  numberByUrl: ReadonlyMap<string, number>,
  slug: string,
): HydratedArticleBlock | undefined {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
    case 'dispute':
      return block;
    case 'list':
      return { type: 'list', style: block.style ?? 'bullet', items: block.items };
    case 'pullquote':
      return {
        type: 'pullquote',
        text: block.text,
        ...(block.attribution ? { attribution: block.attribution } : {}),
      };
    case 'image':
      return {
        type: 'image',
        image: block.image,
        ...(block.caption ? { caption: block.caption } : {}),
      };
    case 'figure': {
      const packet = packetsById.get(block.packetId);
      if (!packet) {
        warn(`figure references unknown packet "${block.packetId}" in "${slug}" — dropping block`);
        return undefined;
      }
      const observations = block.metricIds
        ? packet.observations.filter((o) => o.metricId && block.metricIds!.includes(o.metricId))
        : packet.observations;
      if (observations.length === 0) {
        warn(`figure on packet "${block.packetId}" in "${slug}" has no observations — dropping`);
        return undefined;
      }
      return {
        type: 'figure',
        caption: block.caption,
        observations,
        sourceNumbers: sourceNumbersFor(block, packet, numberByUrl),
      };
    }
    case 'stat': {
      const packet = packetsById.get(block.packetId);
      const row =
        block.kind === 'observation'
          ? packet?.observations.find((o) => o.id === block.refId)
          : packet?.derived.find((d) => d.id === block.refId);
      if (!packet || !row) {
        warn(
          `stat references unknown ${block.kind} "${block.refId}" in "${slug}" — dropping block`,
        );
        return undefined;
      }
      return {
        type: 'stat',
        figure: row.value,
        claim: row.label,
        ...(block.caption ? { caption: block.caption } : {}),
        provenance: row.provenance,
        methodStance: packet.methodStance,
        sourceNumbers: sourceNumbersFor(block, packet, numberByUrl),
      };
    }
    case 'primaryDocument': {
      const packet = packetsById.get(block.packetId);
      const artifact = packet?.artifacts.find((a) => a.id === block.refId);
      if (!packet || !artifact) {
        warn(
          `primaryDocument references unknown artifact "${block.refId}" in "${slug}" — dropping`,
        );
        return undefined;
      }
      return {
        type: 'primaryDocument',
        title: artifact.title,
        summary: artifact.summary,
        ...(block.quote ? { quote: block.quote } : {}),
        ...(artifact.dateLabel ? { dateLabel: artifact.dateLabel } : {}),
        ...(artifact.provenance ? { provenance: artifact.provenance } : {}),
        sourceNumbers: sourceNumbersFor(block, packet, numberByUrl),
      };
    }
    case 'timeline': {
      const packet = packetsById.get(block.packetId);
      if (!packet) {
        warn(`timeline references unknown packet "${block.packetId}" in "${slug}" — dropping`);
        return undefined;
      }
      const events = packet.artifacts
        .filter((a): a is typeof a & { readonly dateLabel: string } => Boolean(a.dateLabel))
        .map((a) => ({ label: a.title, date: a.dateLabel }))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (events.length === 0) {
        warn(`timeline packet "${block.packetId}" in "${slug}" has no dated artifacts — dropping`);
        return undefined;
      }
      return { type: 'timeline', events, policyEras: packet.policyEras };
    }
    case 'mapInset': {
      const entity = entitiesById.get(block.entityId);
      if (!entity) {
        warn(`mapInset references unknown entity "${block.entityId}" in "${slug}" — dropping`);
        return undefined;
      }
      if (!entity.geoAnchor) {
        warn(`mapInset entity "${block.entityId}" in "${slug}" has no geo anchor — dropping`);
        return undefined;
      }
      return {
        type: 'mapInset',
        entityId: entity.id,
        label: block.label ?? entity.displayName,
        lat: entity.geoAnchor.lat,
        lng: entity.geoAnchor.lng,
        precision: entity.locationPrecision,
      };
    }
    default:
      return undefined;
  }
}

/** Entity ids referenced by the article's map-inset blocks (for a batched entity read). */
export function articleMapEntityIds(doc: PublicArticleProjectionDoc): readonly string[] {
  const ids = new Set<string>();
  for (const block of doc.body) {
    if (block.type === 'mapInset') ids.add(block.entityId);
  }
  return [...ids];
}

/** Packet ids referenced by the article's data blocks (for a batched packet read). */
export function articlePacketIds(doc: PublicArticleProjectionDoc): readonly string[] {
  const ids = new Set<string>();
  for (const block of doc.body) {
    if ('packetId' in block && block.packetId) ids.add(block.packetId);
  }
  return [...ids];
}
