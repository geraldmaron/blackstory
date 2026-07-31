/**
 * Black Press newspaper archive discovery adapter (fixture-first, leads only).
 *
 * Digitized Black newspapers (Chicago Defender, Pittsburgh Courier, Baltimore
 * Afro-American, New York Amsterdam News, Atlanta Daily World) documented
 * neighborhood-level Black history at a granularity federal sources miss.
 *
 * Doctrine (research-kernel `black-history.v1` sourceFitness):
 * - sourceClass `news-index-summary-or-search-result` → fitness `leadOnly`.
 *   Every mention this adapter yields is a LEAD routed to relevance review —
 *   never an independently promotable fact. "Capture and assess the underlying
 *   evidence before acceptance."
 * - Discovery cannot publish (ADR-009). Nothing here touches public
 *   projections, release tables, or any bb_public/bb_canonical write path.
 * - OCR issue text is EPHEMERAL input: only capped snippets (evidence-pointer
 *   limits) and outbound link hints survive onto candidate payloads. Full
 *   article bodies are never stored (rights: many runs remain under copyright).
 * - This domain package performs no network I/O. Live `BlackPressAdapter`
 *   implementations MUST fetch exclusively through `@repo/security` safe-fetch.
 */
import type { RightsPolicy } from '../../provenance/rights.js';
import type { EvidenceSource } from '../../provenance/source.js';
import {
  MAX_EVIDENCE_SNIPPET_CHARACTERS,
  MAX_EVIDENCE_SNIPPET_WORDS,
} from '../../rights/evidence-pointer.js';
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import { registerSource, type SourceRegistryStore } from '../registry.js';
import type {
  AdapterCandidateProvenance,
  AdapterCandidateRecord,
  SourceAdapterContract,
  SourceRegistryEntry,
} from '../types.js';
import { trimTrailingChars } from '../../strings/trim-chars.js';

export const BLACK_PRESS_ADAPTER_ID = 'black-press-v1' as const;
export const BLACK_PRESS_PARSER_VERSION = 'black-press-parser-1.0.0' as const;
export const BLACK_PRESS_STABLE_ID_SCHEME = 'black-press-outlet-issue-mention' as const;
export const BLACK_PRESS_PAYLOAD_SCHEMA_VERSION = 'black-press-payload.v1' as const;

/**
 * Constitution `sourceClassifications` token. `news_reportage` is a
 * LOW_AUTHORITY_SOURCE_TIER (../../relevance/gates.ts), so black-press leads can
 * never independently reach `include` and remain eligible for authority harvest.
 */
export const BLACK_PRESS_DEFAULT_CLASSIFICATION = 'news_reportage' as const;

/** Research-kernel `black-history.v1` sourceFitness sourceClass for this adapter. */
export const BLACK_PRESS_SOURCE_CLASS = 'news-index-summary-or-search-result' as const;

/** Research-kernel fitness for BLACK_PRESS_SOURCE_CLASS: leads only, never facts. */
export const BLACK_PRESS_SOURCE_FITNESS = 'leadOnly' as const;

/** Every black-press lead routes to relevance review before any further use. */
export const BLACK_PRESS_LEAD_ROUTE = 'relevance_review' as const;

export const BLACK_PRESS_SOURCE_ID = 'src_black_press' as const;
export const BLACK_PRESS_ORG_ID = 'org_black_press' as const;
export const BLACK_PRESS_KILL_SWITCH_ID = 'adapter:black-press' as const;

/** Cap on outbound link hints kept per mention (mirrors authority-harvest scale). */
export const BLACK_PRESS_MAX_LINK_HINTS = 10 as const;

export const BLACK_PRESS_ARCHIVE_KINDS = [
  'google-news-archive',
  'chronicling-america',
  'proquest-black-newspapers',
  'institutional',
] as const;

export type BlackPressArchiveKind = (typeof BLACK_PRESS_ARCHIVE_KINDS)[number];

export type BlackPressArchiveRef = {
  readonly kind: BlackPressArchiveKind;
  /** Real archive URL (verified collection/index pages only — never fabricated). */
  readonly url: string;
  readonly access: 'open' | 'subscription' | 'onsite';
  readonly notes?: string;
};

/** A digitized Black newspaper title seeded from `fixtures/black-press-outlets.v1.json`. */
export type BlackPressOutlet = {
  readonly id: string;
  readonly title: string;
  /** Publication place, e.g. "Chicago, IL". */
  readonly place: string;
  readonly foundedYear?: number;
  readonly archives: readonly BlackPressArchiveRef[];
};

export type BlackPressDateRange = {
  /** Inclusive ISO date (YYYY-MM-DD). */
  readonly from: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  readonly to: string;
};

export type BlackPressIssueRef = {
  readonly outletId: string;
  /** ISO date (YYYY-MM-DD) of the issue. */
  readonly issueDate: string;
  readonly issueUrl?: string;
  readonly pageCount?: number;
};

export type BlackPressOcrPage = {
  readonly page: number;
  /** Ephemeral OCR text for this page — never persisted on candidates. */
  readonly text: string;
};

/** Ephemeral OCR bundle for one digitized issue (input only; never stored). */
export type BlackPressIssueOcr = {
  readonly outletId: string;
  readonly issueDate: string;
  readonly issueUrl?: string;
  readonly pages: readonly BlackPressOcrPage[];
};

/** One neighborhood-level mention extracted from issue OCR — a lead, not a fact. */
export type BlackPressOcrMention = {
  readonly outletId: string;
  readonly issueDate: string;
  readonly page: number;
  readonly headline: string;
  /** Capped to evidence-pointer snippet limits by the normalizer. */
  readonly snippet: string;
  readonly issueUrl?: string;
  /** HTTPS URLs cited in the article body (primary-source follow-up hints). */
  readonly citedUrls?: readonly string[];
};

/**
 * Port for Black-press archive access. Implementations that touch the network
 * MUST use `@repo/security` safe-fetch (SSRF-safe, allowlisted). The fixture
 * adapter below is the only implementation shipped in `@repo/domain`.
 */
export type BlackPressAdapter = {
  listIssues(
    outlet: BlackPressOutlet,
    dateRange: BlackPressDateRange,
  ): Promise<readonly BlackPressIssueRef[]> | readonly BlackPressIssueRef[];
  extractMentions(
    issueOcr: BlackPressIssueOcr,
  ): Promise<readonly BlackPressOcrMention[]> | readonly BlackPressOcrMention[];
};

/** Rights default: digitization/copyright status varies per run — resolve per item. */
export const BLACK_PRESS_RIGHTS: RightsPolicy = {
  defaultStatus: 'unknown',
  publicationPermissions: ['cite', 'short_excerpt'],
  prohibitedUses: ['full_text_republication', 'commercial_reuse'],
};

/**
 * Adapter contract. `snapshotMode: 'none'` — this adapter indexes mentions only;
 * it never captures issue scans or full OCR bodies.
 */
export function createBlackPressAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: BLACK_PRESS_ADAPTER_ID,
    parserVersion: BLACK_PRESS_PARSER_VERSION,
    displayName: 'Black Press Newspaper Archives (leads only)',
    classification: BLACK_PRESS_DEFAULT_CLASSIFICATION,
    stableIdScheme: BLACK_PRESS_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'none',
      rights: BLACK_PRESS_RIGHTS,
      notes:
        `sourceClass=${BLACK_PRESS_SOURCE_CLASS}; fitness=${BLACK_PRESS_SOURCE_FITNESS}; ` +
        `every mention routes to ${BLACK_PRESS_LEAD_ROUTE}. Leads only — never facts.`,
    },
    rights: BLACK_PRESS_RIGHTS,
    /** Leads only: the single permitted "claim" class marks discovery leads, not facts. */
    permittedClaimClasses: ['discovery_lead'],
    rateLimits: { requestsPerMinute: 10, burst: 2 },
    volume: { expectedRecordsPerRun: 50, countToleranceFraction: 0.5 },
    geographicCoverage: {
      countries: ['US'],
      notes: 'Historic Black press: national editions with neighborhood-level city coverage.',
    },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    ...overrides,
  };
}

export type RegisterBlackPressSourceInput = {
  readonly id?: string;
  readonly sourceId?: string;
  readonly organizationId?: string;
  readonly createdAt: string;
};

/**
 * Disabled-by-default registration (mirrors chronicling-america). The durable
 * registry entry ships `registryState: 'disabled'` and `adapterEnabled: false`;
 * a human policy approval is required before any live run.
 */
export function registerBlackPressSource(
  store: SourceRegistryStore,
  input: RegisterBlackPressSourceInput,
): SourceRegistryEntry {
  const contract = createBlackPressAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: input.sourceId ?? BLACK_PRESS_SOURCE_ID,
    organizationId: input.organizationId ?? BLACK_PRESS_ORG_ID,
    displayName: contract.displayName,
    classification: contract.classification,
    adapterId: contract.adapterId,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: false,
    killSwitchId: BLACK_PRESS_KILL_SWITCH_ID,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  return registerSource(store, {
    id: input.id ?? 'reg_black_press',
    contract,
    evidenceSource,
    registryState: 'disabled',
    createdAt: input.createdAt,
  });
}

/** Cap ephemeral OCR prose to evidence-pointer snippet limits (chars and words). */
export function capBlackPressSnippet(text: string): string {
  const collapsed = text.replace(/\s+/gu, ' ').trim();
  const words = collapsed.split(' ').filter(Boolean);
  const wordCapped =
    words.length > MAX_EVIDENCE_SNIPPET_WORDS
      ? words.slice(0, MAX_EVIDENCE_SNIPPET_WORDS).join(' ')
      : collapsed;
  if (wordCapped.length <= MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    return wordCapped;
  }
  return `${wordCapped.slice(0, MAX_EVIDENCE_SNIPPET_CHARACTERS - 1).trimEnd()}…`;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  );
}

/** Deterministic stable identifier: outlet + issue date + page + headline slug. */
export function buildBlackPressStableIdentifier(
  mention: Pick<BlackPressOcrMention, 'outletId' | 'issueDate' | 'page' | 'headline'>,
): string {
  return `black-press:${mention.outletId}:${mention.issueDate}:p${mention.page}:${slugify(mention.headline)}`;
}

const HTTPS_URL_RE = /https:\/\/[^\s<>"')\]]+/g;

function httpsOnlyLinkHints(urls: readonly string[] | undefined): readonly string[] {
  if (!urls) return [];
  const seen = new Set<string>();
  const hints: string[] = [];
  for (const raw of urls) {
    if (hints.length >= BLACK_PRESS_MAX_LINK_HINTS) break;
    const trimmed = trimTrailingChars(raw.trim(), '.,;:');
    if (!/^https:\/\//i.test(trimmed)) continue;
    try {
      const normalized = new URL(trimmed).toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      hints.push(normalized);
    } catch {
      // unusable URL — drop silently; leads never fail a batch over a link hint
    }
  }
  return hints;
}

export type BlackPressCandidatePayload = {
  readonly schemaVersion: typeof BLACK_PRESS_PAYLOAD_SCHEMA_VERSION;
  readonly outletId: string;
  readonly outletTitle?: string;
  readonly issueDate: string;
  readonly page: number;
  /** Capped snippet (evidence-pointer limits) — never full OCR text. */
  readonly summary: string;
  /** HTTPS URLs cited by the article (authority-harvest input). */
  readonly outboundLinkHints?: readonly string[];
  readonly sourceClass: typeof BLACK_PRESS_SOURCE_CLASS;
  readonly sourceFitness: typeof BLACK_PRESS_SOURCE_FITNESS;
  readonly leadRoute: typeof BLACK_PRESS_LEAD_ROUTE;
};

export type BlackPressCandidateRecord = AdapterCandidateRecord & {
  readonly payload: BlackPressCandidatePayload;
};

export type NormalizeBlackPressMentionInput = {
  readonly mention: BlackPressOcrMention;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly outlet?: BlackPressOutlet;
};

/** Normalize one OCR mention into a private adapter candidate record (lead only). */
export function normalizeBlackPressMention(
  input: NormalizeBlackPressMentionInput,
): BlackPressCandidateRecord {
  const { mention, registryEntry, outlet } = input;
  const stableIdentifier = buildBlackPressStableIdentifier(mention);
  const linkHints = httpsOnlyLinkHints(mention.citedUrls);
  const canonicalUrl = mention.issueUrl ?? outlet?.archives[0]?.url;

  const provenance: AdapterCandidateProvenance = {
    sourceId: registryEntry.evidenceSource.id,
    adapterId: registryEntry.contract.adapterId,
    parserVersion: registryEntry.contract.parserVersion,
    registryEntryId: registryEntry.id,
    runId: input.runId,
    capturedAt: input.capturedAt,
    sourceItemId: stableIdentifier,
    schemaVersion: registryEntry.contract.expectedSchemaVersion,
  };

  const payload: BlackPressCandidatePayload = {
    schemaVersion: BLACK_PRESS_PAYLOAD_SCHEMA_VERSION,
    outletId: mention.outletId,
    ...(outlet !== undefined ? { outletTitle: outlet.title } : {}),
    issueDate: mention.issueDate,
    page: mention.page,
    summary: capBlackPressSnippet(mention.snippet),
    ...(linkHints.length > 0 ? { outboundLinkHints: linkHints } : {}),
    sourceClass: BLACK_PRESS_SOURCE_CLASS,
    sourceFitness: BLACK_PRESS_SOURCE_FITNESS,
    leadRoute: BLACK_PRESS_LEAD_ROUTE,
  };

  return {
    stableIdentifier,
    title: capBlackPressSnippet(mention.headline),
    ...(canonicalUrl !== undefined ? { canonicalUrl } : {}),
    classification: BLACK_PRESS_DEFAULT_CLASSIFICATION,
    payload,
    provenance,
  };
}

export type NormalizeBlackPressMentionsInput = {
  readonly mentions: readonly BlackPressOcrMention[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly outletsById?: ReadonlyMap<string, BlackPressOutlet>;
};

/** Normalize a mention batch, deduplicating by stable identifier (first wins). */
export function normalizeBlackPressMentions(
  input: NormalizeBlackPressMentionsInput,
): readonly BlackPressCandidateRecord[] {
  const seen = new Set<string>();
  const records: BlackPressCandidateRecord[] = [];
  for (const mention of input.mentions) {
    const stableIdentifier = buildBlackPressStableIdentifier(mention);
    if (seen.has(stableIdentifier)) continue;
    seen.add(stableIdentifier);
    const outlet = input.outletsById?.get(mention.outletId);
    records.push(
      normalizeBlackPressMention({
        mention,
        registryEntry: input.registryEntry,
        runId: input.runId,
        capturedAt: input.capturedAt,
        ...(outlet !== undefined ? { outlet } : {}),
      }),
    );
  }
  return records;
}

/**
 * Deterministic OCR mention extraction (fixture path — no model, no network).
 * Paragraphs are split on blank lines; the first line is treated as the
 * headline and the remainder as the capped snippet. HTTPS URLs found in the
 * paragraph become cited-URL hints for authority harvest.
 */
export function extractMentionsFromIssueOcr(
  issueOcr: BlackPressIssueOcr,
): readonly BlackPressOcrMention[] {
  const mentions: BlackPressOcrMention[] = [];
  for (const page of issueOcr.pages) {
    const paragraphs = page.text
      .split(/\n\s*\n/u)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);
    for (const paragraph of paragraphs) {
      const lines = paragraph.split('\n').map((line) => line.trim());
      const headline = lines[0] ?? '';
      if (headline.length < 8) continue;
      const body = lines.slice(1).join(' ').trim();
      const citedUrls = paragraph.match(HTTPS_URL_RE) ?? [];
      mentions.push({
        outletId: issueOcr.outletId,
        issueDate: issueOcr.issueDate,
        page: page.page,
        headline,
        snippet: capBlackPressSnippet(body.length > 0 ? body : headline),
        ...(issueOcr.issueUrl !== undefined ? { issueUrl: issueOcr.issueUrl } : {}),
        ...(citedUrls.length > 0
          ? { citedUrls: citedUrls.map((url) => trimTrailingChars(url, '.,;:')) }
          : {}),
      });
    }
  }
  return mentions;
}

/**
 * Fixture-first adapter: issues and OCR are supplied up front (downloaded out of
 * band or from test fixtures). No network access, ever.
 */
export function createFixtureBlackPressAdapter(input: {
  readonly issues?: readonly BlackPressIssueRef[];
}): BlackPressAdapter {
  const issues = input.issues ?? [];
  return {
    listIssues(outlet, dateRange) {
      return issues.filter(
        (issue) =>
          issue.outletId === outlet.id &&
          issue.issueDate >= dateRange.from &&
          issue.issueDate <= dateRange.to,
      );
    },
    extractMentions(issueOcr) {
      return extractMentionsFromIssueOcr(issueOcr);
    },
  };
}
