/**
 * Maps a release story projection (`@repo/schemas` `PublicStoryProjectionDoc`) onto the
 * `/v1/stories` wire contract (`@repo/public-contracts/v1/story`).
 *
 * Inline markup is parsed here, once, with the same grammar the site renders and the publish
 * gates check (`parseStoryInline`), and flattened into runs. Blocks the site draws from its own
 * hydrated packets (charts, stats, document excerpts, timelines) and videos become `webOnly`
 * placeholders; a map inset becomes a `record` link. Nothing internal crosses: `anchors`,
 * `replicationVerified`, packet ids, `objectPath` and `rightsStatus` are not copied.
 */
import type {
  PublicStoryListItemDoc,
  PublicStoryProjectionDoc,
  StoryBodyBlockDoc,
  StoryImageDoc,
} from '@repo/schemas';
import { parseStoryInline, type StoryInlineNode } from '@repo/schemas/story-inline';
import { storyPath } from '@repo/public-contracts/destinations';
import type {
  StoryBlockV1,
  StoryImageV1,
  StoryListItemV1,
  StoryRunV1,
  StoryV1,
} from '@repo/public-contracts/v1/story';

type Marks = { readonly strong?: true; readonly em?: true; readonly href?: string };

/** Flattens inline nodes into runs. `citeNumber` maps a ref id to its 1-based source number. */
export function toRuns(text: string, citeNumber: ReadonlyMap<string, number>): StoryRunV1[] {
  const out: StoryRunV1[] = [];
  const walk = (nodes: readonly StoryInlineNode[], marks: Marks) => {
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          if (node.text.length > 0) out.push({ t: 'text', text: node.text, ...marks });
          break;
        case 'break':
          out.push({ t: 'break' });
          break;
        case 'cite': {
          const n = citeNumber.get(node.refId);
          // A marker with no matching source is dropped rather than shown as a dead number.
          if (n !== undefined) out.push({ t: 'cite', n, refId: node.refId });
          break;
        }
        case 'entity':
          out.push({ t: 'text', text: node.label, ...marks, entityId: node.entityId });
          break;
        case 'link':
          walk(node.children, { ...marks, href: node.href });
          break;
        case 'strong':
          walk(node.children, { ...marks, strong: true });
          break;
        case 'em':
          walk(node.children, { ...marks, em: true });
          break;
      }
    }
  };
  walk(parseStoryInline(text), {});
  return out;
}

function toImage(image: StoryImageDoc): StoryImageV1 {
  return {
    url: image.url,
    alt: image.alt,
    credit: image.credit,
    ...(image.width !== undefined ? { width: image.width } : {}),
    ...(image.height !== undefined ? { height: image.height } : {}),
  };
}

function toBlock(block: StoryBodyBlockDoc, citeNumber: ReadonlyMap<string, number>): StoryBlockV1 {
  const runs = (text: string) => toRuns(text, citeNumber);
  switch (block.type) {
    case 'heading':
      return { type: 'heading', level: block.level, text: block.text };
    case 'paragraph':
      return { type: 'paragraph', runs: runs(block.text) };
    case 'list':
      return { type: 'list', style: block.style, items: block.items.map(runs) };
    case 'pullquote':
      return {
        type: 'quote',
        runs: runs(block.text),
        ...(block.attribution ? { attribution: block.attribution } : {}),
      };
    case 'dispute':
      return {
        type: 'dispute',
        label: block.label,
        sides: [block.sideA, block.sideB].map((side) => ({
          sourceLabel: side.sourceLabel,
          claim: side.claim,
        })),
      };
    case 'image':
      return {
        type: 'image',
        image: toImage(block.image),
        ...(block.caption ? { caption: block.caption } : {}),
      };
    case 'table':
      return {
        type: 'table',
        caption: block.caption,
        header: block.header,
        rows: block.rows.map((row) => row.map(runs)),
      };
    case 'mapInset':
      return { type: 'record', entityId: block.entityId, label: block.label ?? 'Open the record' };
    case 'figure':
      return { type: 'webOnly', kind: 'figure', caption: block.caption };
    case 'stat':
      return {
        type: 'webOnly',
        kind: 'stat',
        ...(block.caption ? { caption: block.caption } : {}),
      };
    case 'primaryDocument':
      return { type: 'webOnly', kind: 'document' };
    case 'timeline':
      return { type: 'webOnly', kind: 'timeline' };
    case 'video':
      return { type: 'webOnly', kind: 'video', caption: block.title };
    case 'divider':
      return { type: 'divider' };
  }
}

export function toStoryListItemV1(doc: PublicStoryListItemDoc): StoryListItemV1 {
  return {
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    format: doc.format,
    eraLabel: doc.eraLabel,
    placeLabel: doc.placeLabel,
    publishedAt: doc.publishedAt,
    ...(doc.updatedAt ? { updatedAt: doc.updatedAt } : {}),
    ...(doc.collection
      ? {
          collection: {
            id: doc.collection.id,
            label: doc.collection.label,
            position: doc.collection.position,
            ...(doc.collection.positionLabel
              ? { positionLabel: doc.collection.positionLabel }
              : {}),
          },
        }
      : {}),
    ...(doc.heroImage ? { heroImage: toImage(doc.heroImage) } : {}),
    webPath: storyPath(doc.slug, doc.collection?.id),
  };
}

export function toStoryV1(doc: PublicStoryProjectionDoc): StoryV1 {
  const citeNumber = new Map(doc.references.map((ref, index) => [ref.id, index + 1]));
  return {
    ...toStoryListItemV1(doc),
    releaseId: doc.releaseId,
    body: doc.body.map((block) => toBlock(block, citeNumber)),
    references: doc.references.map((ref) => ({
      id: ref.id,
      label: ref.label,
      url: ref.url,
      ...(ref.locator ? { locator: ref.locator } : {}),
    })),
    contributors: doc.contributors.map((contributor) => ({
      name: contributor.name,
      kind: contributor.kind,
      roles: contributor.roles,
    })),
  };
}
