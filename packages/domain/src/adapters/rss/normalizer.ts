/**
 * Normalize parsed RSS/Atom feed items into BB-037 AdapterCandidateRecord output (BB-073).
 */
import { hashUtf8 } from '../../provenance/hashes.js';
import { MAX_EVIDENCE_SNIPPET_CHARACTERS, MAX_EVIDENCE_SNIPPET_WORDS } from '../../rights/evidence-pointer.js';
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import type { FeedRegistryEntry } from './feed-registry.js';
import { parseRssOrAtomFeed } from './parser.js';
import { RSS_ADAPTER_ID, RSS_PAYLOAD_SCHEMA_VERSION } from './types.js';
import type { ParsedFeedItem, RssCandidatePayload, RssCandidateRecord } from './types.js';

/**
 * Caps a syndicated summary to the BB-077 evidence-pointer snippet limits even though this
 * payload field is not itself an EvidencePointer — publishers already deliver a short summary
 * for RSS syndication, but a defensive cap keeps every stored value inside the doctrine's bound
 * regardless of what an individual feed happens to put in `<description>`.
 */
export function capSyndicatedSummary(summary: string | undefined): string | undefined {
  if (!summary) return undefined;
  let capped = summary;
  if (capped.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    capped = capped.slice(0, MAX_EVIDENCE_SNIPPET_CHARACTERS).trim();
  }
  const words = capped.split(/\s+/u).filter(Boolean);
  if (words.length > MAX_EVIDENCE_SNIPPET_WORDS) {
    capped = words.slice(0, MAX_EVIDENCE_SNIPPET_WORDS).join(' ');
  }
  return capped || undefined;
}

function buildStableIdentifier(feedId: string, item: ParsedFeedItem): string {
  const material = item.guid ?? item.link ?? item.title ?? '';
  if (!material.trim()) {
    throw new Error('RSS/Atom item requires a guid, link, or title to derive a stable identifier');
  }
  const digest = hashUtf8(material.trim()).digest.slice(0, 24);
  return `rss:${feedId}:${digest}`;
}

export type NormalizeFeedItemInput = {
  readonly feed: FeedRegistryEntry;
  readonly item: ParsedFeedItem;
  readonly feedFormat: 'rss' | 'atom';
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
};

export function normalizeFeedItem(input: NormalizeFeedItemInput): RssCandidateRecord {
  const summary = capSyndicatedSummary(input.item.summary);
  const payload: RssCandidatePayload = {
    schemaVersion: RSS_PAYLOAD_SCHEMA_VERSION,
    feedId: input.feed.id,
    feedUrl: input.feed.feedUrl,
    feedFormat: input.feedFormat,
    classification: input.feed.classification,
    ...(input.item.guid !== undefined ? { itemGuid: input.item.guid } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(input.item.publishedAt !== undefined ? { publishedAt: input.item.publishedAt } : {}),
  };

  const candidate = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier: buildStableIdentifier(input.feed.id, input.item),
    ...(input.item.title !== undefined ? { title: input.item.title } : {}),
    ...(input.item.link !== undefined ? { canonicalUrl: input.item.link } : {}),
    classification: input.feed.classification,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  assertRssCandidate(candidate as RssCandidateRecord);
  return candidate as RssCandidateRecord;
}

/** Parses raw feed XML and normalizes every item in one pass. */
export function normalizeFeedXml(input: {
  readonly feed: FeedRegistryEntry;
  readonly xml: string;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
}): readonly RssCandidateRecord[] {
  const parsed = parseRssOrAtomFeed(input.xml);
  return parsed.items
    .filter((item) => item.link !== undefined || item.guid !== undefined)
    .map((item) =>
      normalizeFeedItem({
        feed: input.feed,
        item,
        feedFormat: parsed.format,
        registryEntry: input.registryEntry,
        runId: input.runId,
        capturedAt: input.capturedAt,
      }),
    );
}

export function assertRssCandidate(candidate: RssCandidateRecord): void {
  if (candidate.provenance.adapterId !== RSS_ADAPTER_ID) {
    throw new Error(`Expected adapterId ${RSS_ADAPTER_ID}`);
  }
  const payload = candidate.payload;
  if (payload.schemaVersion !== RSS_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unexpected payload schema version: ${payload.schemaVersion}`);
  }
  if (payload.summary && payload.summary.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    throw new Error('RSS candidate summary exceeds the evidence-pointer snippet cap');
  }
}
