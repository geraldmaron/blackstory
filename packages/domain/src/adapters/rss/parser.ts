/**
 * Minimal, dependency-free RSS 2.0 Atom 1.0 parser.
 *
 * Deliberately narrow: it extracts exactly the fields the curated feed registry needs
 * (title, link, guid/id, summary, published date) from a small set of vetted publisher feeds,
 * not a general-purpose XML parser for arbitrary/adversarial input. No new npm dependency was
 * added for this `packages/domain` has no XML library as a direct dependency, and adding one
 * for a handful of well-known feed shapes was judged not worth the new supply-chain surface.
 * Fixture-driven tests exercise real (trimmed) RSS and Atom samples; see fixtures/.
 */
import type { ParsedFeed, ParsedFeedFormat, ParsedFeedItem } from './types.js';

const ENTITY_MAP: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
      if (entity in ENTITY_MAP) {
        return ENTITY_MAP[entity]!;
      }
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        const code = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (entity.startsWith('#')) {
        const code = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return match;
    })
    .trim();
}

function stripTagsAndCollapseWhitespace(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const withoutCdataMarkers = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const decoded = decodeEntities(stripTagsAndCollapseWhitespace(withoutCdataMarkers));
  return decoded || undefined;
}

/** Extracts the raw inner text of the first `<tag>...</tag>` (non-greedy, case-sensitive) in a block. */
function extractElementText(block: string, tag: string): string | undefined {
  const withCdata = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(withCdata);
  if (!match) return undefined;
  return match[1];
}

/** Extracts an attribute value from the first self-closing or opening tag matching `tag`. */
function extractElementAttr(block: string, tag: string, attr: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']*)["'][^>]*/?>`, 'i');
  const match = block.match(re);
  return match ? decodeEntities(match[1] ?? '') : undefined;
}

function toIsoDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function extractBlocks(xml: string, tag: string): readonly string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

function parseRssItem(block: string): ParsedFeedItem {
  const title = cleanText(extractElementText(block, 'title'));
  const link = cleanText(extractElementText(block, 'link'));
  const guid = cleanText(extractElementText(block, 'guid'));
  const summary = cleanText(
    extractElementText(block, 'description') ?? extractElementText(block, 'summary'),
  );
  const publishedAt = toIsoDate(cleanText(extractElementText(block, 'pubDate')));
  return {
    ...(title !== undefined ? { title } : {}),
    ...(link !== undefined ? { link } : {}),
    ...(guid !== undefined ? { guid } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(publishedAt !== undefined ? { publishedAt } : {}),
  };
}

function parseAtomEntry(block: string): ParsedFeedItem {
  const title = cleanText(extractElementText(block, 'title'));
  const id = cleanText(extractElementText(block, 'id'));
  const linkHref = extractElementAttr(block, 'link', 'href');
  const summary = cleanText(
    extractElementText(block, 'summary') ?? extractElementText(block, 'content'),
  );
  const publishedAt = toIsoDate(
    cleanText(extractElementText(block, 'updated') ?? extractElementText(block, 'published')),
  );
  return {
    ...(title !== undefined ? { title } : {}),
    ...(linkHref !== undefined ? { link: linkHref } : {}),
    ...(id !== undefined ? { guid: id } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(publishedAt !== undefined ? { publishedAt } : {}),
  };
}

function detectFormat(xml: string): ParsedFeedFormat {
  const withoutProlog = xml.replace(/<\?xml[\s\S]*?\?>/, '').trimStart();
  if (/<feed[\s>]/i.test(withoutProlog.slice(0, 200)) || /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml)) {
    return 'atom';
  }
  if (/<rss[\s>]/i.test(xml) || /<channel[\s>]/i.test(xml)) {
    return 'rss';
  }
  throw new Error('Unrecognized feed format: expected an RSS <rss>/<channel> or Atom <feed> document');
}

/** Parses a raw RSS/Atom XML string into a normalized, format-agnostic shape. Throws on unrecognized input. */
export function parseRssOrAtomFeed(xml: string): ParsedFeed {
  const format = detectFormat(xml);
  if (format === 'atom') {
    const channelTitle = cleanText(extractElementText(xml, 'title'));
    const entries = extractBlocks(xml, 'entry').map(parseAtomEntry);
    return {
      format,
      ...(channelTitle !== undefined ? { channelTitle } : {}),
      items: entries,
    };
  }
  const channelBlock = extractElementText(xml, 'channel') ?? xml;
  const channelTitle = cleanText(extractElementText(channelBlock, 'title'));
  const items = extractBlocks(xml, 'item').map(parseRssItem);
  return {
    format,
    ...(channelTitle !== undefined ? { channelTitle } : {}),
    items,
  };
}
