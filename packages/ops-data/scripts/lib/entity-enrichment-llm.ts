/**
 * Builds evidence-bound enrichment prompts and validates structured responses and quotation
 * attachment. Invalid outputs are quarantined. Structural and quote validation do not prove
 * entailment; independent claim review precedes publication.
 */
import { treatAsLiving } from '@repo/domain';
import { decadeStartYearFromLabel, isDecadeAtOrBeforeCurrent } from '@repo/domain';
import { isValidTopicId } from '@repo/domain';
import { redactStreetAddresses } from './evidence-collectors/redact-address.ts';
import { findRawRegistryVocabulary } from './nrhp-area-labels.ts';
import {
  stripMarkdownCodeFence,
  type LlmCompletionRequest,
  type LlmProvider,
} from '../../../operator-cli/src/llm-provider.ts';

export const ENTITY_ENRICHMENT_SCHEMA_ID = 'entity_enrichment_draft.v1' as const;
export const ENTITY_ENRICHMENT_SCHEMA_VERSION = '1' as const;

/** Public-projection bounds this draft must satisfy (packages/schemas/src/public-projections.ts). */
export const SUMMARY_MIN_CHARS = 400;
export const SUMMARY_MAX_CHARS = 900;

export type EnrichmentEvidenceInput = {
  readonly id: string;
  readonly sourceTier: 'tier1' | 'tier2';
  readonly title: string | null;
  /** Possibly truncated by the caller to bound prompt size; truncation never hides a citation's source. */
  readonly text: string;
  /**
   * Describes excerpt selection, omitted content and subject-matter signals. Absent when the
   * complete source text is supplied.
   */
  readonly readNote?: string | null;
};

export type EnrichmentSubject = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: string | undefined;
  readonly lane: string;
  readonly restrictedAddress: boolean;
  readonly evidence: readonly EnrichmentEvidenceInput[];
};

export type Citation = {
  readonly evidenceId: string;
  readonly quote: string;
};

export type EnrichmentDraft = {
  readonly summary: string;
  readonly summaryCitations: readonly Citation[];
  readonly historicalContext: string | null;
  readonly historicalContextCitations: readonly Citation[];
  readonly topicIds: readonly string[];
  readonly eraBuckets: readonly string[];
  readonly keywords: readonly string[];
  /**
   * A summary below the normal floor requires bestEffortReason and remains identifiable in the
   * ledger for further acquisition and review. A drafter's assertion of exhaustion is not
   * independent proof of completeness.
   */
  readonly bestEffort?: boolean;
  readonly bestEffortReason?: string | null;
};

export type EnrichmentValidationResult =
  | { readonly ok: true; readonly draft: EnrichmentDraft }
  | { readonly ok: false; readonly errors: readonly string[] };

export type EnrichmentAttempt = {
  readonly subject: EnrichmentSubject;
  readonly rawContent: string;
  readonly validation: EnrichmentValidationResult;
};

const citationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['evidenceId', 'quote'],
  properties: {
    evidenceId: { type: 'string' },
    quote: { type: 'string', description: "Exact substring copied from that evidence id's text." },
  },
} as const;

export const ENTITY_ENRICHMENT_RESPONSE_SCHEMA = {
  name: 'entity_enrichment_draft',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'summaryCitations',
      'historicalContext',
      'historicalContextCitations',
      'topicIds',
      'eraBuckets',
      'keywords',
    ],
    properties: {
      summary: {
        type: 'string',
        description:
          `${SUMMARY_MIN_CHARS}-${SUMMARY_MAX_CHARS} characters, facts only from supplied evidence. ` +
          'A shorter summary is only accepted with bestEffort:true and a bestEffortReason stating ' +
          'the evidence sweep was exhausted — never omit the flag to sneak under the floor.',
      },
      bestEffort: {
        type: 'boolean',
        description:
          'true only when the full evidence sweep genuinely cannot support a ' +
          `${SUMMARY_MIN_CHARS}-char summary. Omit or false otherwise.`,
      },
      bestEffortReason: {
        type: ['string', 'null'],
        description: 'Required when bestEffort is true: what was searched and why it fell short.',
      },
      summaryCitations: { type: 'array', minItems: 1, items: citationSchema },
      historicalContext: {
        type: ['string', 'null'],
        description: 'null when evidence does not support a context paragraph beyond the summary.',
      },
      historicalContextCitations: { type: 'array', items: citationSchema },
      topicIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only ids from the supplied allowedTopicIds list.',
      },
      eraBuckets: {
        type: 'array',
        items: { type: 'string' },
        description: 'Decade labels like "1950s", grounded in a date present in the evidence.',
      },
      keywords: { type: 'array', items: { type: 'string' } },
    },
  },
} as const;

/**
 * The standing contract for the drafter: what to write from, what an entry is for, and what it
 * must never do. Subject-specific constraints live in the user prompt, next to the evidence.
 *
 * Written as labeled sections rather than one paragraph. It was a single ~350-word run-on
 * string in which the grounding rules, the editorial brief, the thin-evidence protocol and the
 * privacy rule ran together with no separation — the hardest constraints buried mid-sentence
 * between advice about architectural style. Sections do not change a single rule; they make each
 * one findable, and they let the trust-critical ones lead.
 */
export const ENTITY_ENRICHMENT_SYSTEM_PROMPT = [
  'You write short factual entries for a Black history catalog.',

  'GROUNDING. These are absolute.\n' +
    '1. Use ONLY the evidence documents supplied in the user message, and state only facts ' +
    'present in that evidence.\n' +
    '2. Every sentence of fact in "summary" and "historicalContext" must be traceable to at ' +
    "least one citation whose quote is copied verbatim from a supplied evidence document's " +
    'text.\n' +
    '3. Never invent dates, names, events, or quotes that are not present in the evidence.',

  'WHAT AN ENTRY IS FOR. Significance, not fabric.\n' +
    'An entry says who the subject mattered to, what happened there, which people, ' +
    'congregations, schools, businesses, or movements it served, and why it is recognized as ' +
    'Black heritage. It is NOT a description of physical fabric, and the summary opens on ' +
    'significance, never on construction description.\n' +
    'National Register nominations spend most of their length on materials, plan, dimensions ' +
    'and style. Treat that as background, and draw on it only where the fabric carries the ' +
    'significance itself — a building designed or built by Black architects or craftsmen, a ' +
    'form that records how the space was actually used.',

  'WHEN THE EVIDENCE IS THIN. Say less; never pad.\n' +
    'If the evidence does not support a historicalContext paragraph beyond the summary, return ' +
    'null for "historicalContext" and an empty "historicalContextCitations" array rather than ' +
    'padding with generic prose. If the supplied evidence establishes nothing about Black ' +
    'history beyond the bare fact of listing, write only what the evidence supports and return ' +
    'null for "historicalContext". A short honest entry is correct; a padded architectural one ' +
    'is not.',

  'PRIVACY. A hard safety rule.\n' +
    'Never state a street address, house number, coordinate pair, or other parcel-precise ' +
    'location in any output field. This binds for people (living or possibly living) and for ' +
    'address-restricted places. Neighborhood- or city-level wording is always sufficient.',

  'OUTPUT. Return JSON only.',
].join('\n\n');

export function buildEnrichmentUserPrompt(
  subject: EnrichmentSubject,
  allowedTopicIds: readonly string[],
): string {
  return JSON.stringify(
    {
      task: 'entity_enrichment_draft',
      schema: ENTITY_ENRICHMENT_SCHEMA_ID,
      entityId: subject.entityId,
      displayName: subject.displayName,
      kind: subject.kind ?? 'unknown',
      allowedTopicIds,
      evidence: subject.evidence.map((item) => ({
        id: item.id,
        tier: item.sourceTier,
        title: item.title,
        ...(item.readNote == null ? {} : { readNote: item.readNote }),
        text: item.text,
      })),
      rules: [
        `summary must be ${SUMMARY_MIN_CHARS}-${SUMMARY_MAX_CHARS} characters`,
        `if — after using all supplied evidence — the entity genuinely does not support a ` +
          `${SUMMARY_MIN_CHARS}-char summary, set bestEffort:true and bestEffortReason to what ` +
          'was searched and why it fell short; never write a shorter summary without the flag, ' +
          'and never set the flag to avoid the work of using the evidence fully',
        "the summary must open on the subject's significance to Black history, not on its " +
          'construction, materials, plan, or architectural style',
        'every citation.evidenceId must be one of the ids in the evidence array above',
        "every citation.quote must be an exact verbatim substring of that evidence id's text",
        'an evidence item carrying a readNote is an excerpt: "[…]" marks omitted text, and a ' +
          'quote must come from one side of it, never span it',
        'if a readNote says the document never mentions the subject matter, do not build an entry ' +
          'out of its criteria labels or theme lists — that describes the nomination form, not ' +
          'history, and it will pass every check while saying nothing',
        'never copy a registry classification field into prose — "ethnic heritage (black)", ' +
          '"ETHNIC HERITAGE-BLACK", "OTHER-ETHNIC", "HISTORIC - NON-ABORIGINAL", ' +
          '"ENTERTAINMENT/RECREATION" are NPS form vocabulary, not English. Say what the ' +
          'classification means in plain words ("recognized for its Black heritage") or leave it out',
        'topicIds must only use ids from allowedTopicIds; omit if none clearly apply',
        'eraBuckets must be decade labels ("1950s") grounded in a year present in the evidence',
        ...(addressGuardApplies(subject)
          ? [
              'PRIVACY (hard rule for this subject): never state a street address, house number, ' +
                'rural route, coordinate pair, lot/block, or distance-and-direction locator in ' +
                'summary, historicalContext, or keywords — even if the evidence states one. ' +
                'Neighborhood- or city-level wording is the maximum location precision allowed.',
            ]
          : []),
      ],
    },
    null,
    2,
  );
}

export function buildEnrichmentRequest(
  subject: EnrichmentSubject,
  allowedTopicIds: readonly string[],
  model: string,
): LlmCompletionRequest {
  return {
    messages: [
      { role: 'system', content: ENTITY_ENRICHMENT_SYSTEM_PROMPT },
      { role: 'user', content: buildEnrichmentUserPrompt(subject, allowedTopicIds) },
    ],
    model,
    temperature: 0.2,
    // Output budget includes provider reasoning overhead. Responses without complete valid JSON
    // must fail validation rather than be repaired into assertions.
    maxTokens: 6000,
    responseSchema: ENTITY_ENRICHMENT_RESPONSE_SCHEMA,
  };
}

/**
 * Deterministic mock: builds a valid, schema-conformant draft entirely from the subject's own
 * evidence text (a real quote copied verbatim, padded to the summary length floor with the
 * subject's own display name — never invents content). For dry-run wiring tests and CI, where
 * the generic `createMockLlmProvider` (tuned for the editorial-judge task's different schema)
 * would correctly but unhelpfully quarantine every response.
 */
export function createMockEnrichmentProvider(): LlmProvider {
  return {
    id: 'mock',
    async complete(request) {
      const user = request.messages.find((message) => message.role === 'user')?.content ?? '';
      let subject: { displayName?: unknown; evidence?: unknown } = {};
      try {
        subject = JSON.parse(user) as typeof subject;
      } catch {
        subject = {};
      }
      const displayName =
        typeof subject.displayName === 'string' ? subject.displayName : 'This entity';
      const firstEvidence = Array.isArray(subject.evidence)
        ? (subject.evidence[0] as { id?: unknown; text?: unknown } | undefined)
        : undefined;
      const evidenceId = typeof firstEvidence?.id === 'string' ? firstEvidence.id : 'ev_mock';
      const evidenceText = typeof firstEvidence?.text === 'string' ? firstEvidence.text : '';
      const quote = evidenceText.slice(0, 60).trim();
      const filler = `${displayName} is documented in the supplied evidence. `
        .repeat(20)
        .slice(0, SUMMARY_MAX_CHARS - 1);
      const summary = quote.length > 0 ? `${quote} ${filler}`.slice(0, SUMMARY_MAX_CHARS) : filler;
      const paddedSummary =
        summary.length < SUMMARY_MIN_CHARS ? summary.padEnd(SUMMARY_MIN_CHARS, '.') : summary;
      const payload = {
        summary: paddedSummary,
        summaryCitations:
          quote.length > 0 ? [{ evidenceId, quote }] : [{ evidenceId, quote: filler.slice(0, 20) }],
        historicalContext: null,
        historicalContextCitations: [],
        topicIds: [],
        eraBuckets: [],
        keywords: [],
      };
      return {
        content: JSON.stringify(payload),
        provider: 'mock',
        modelId: request.model || 'mock-entity-enrichment-v1',
      };
    },
  };
}

type RawCitation = { readonly evidenceId?: unknown; readonly quote?: unknown };
type RawDraft = {
  readonly summary?: unknown;
  readonly summaryCitations?: unknown;
  readonly historicalContext?: unknown;
  readonly historicalContextCitations?: unknown;
  readonly topicIds?: unknown;
  readonly eraBuckets?: unknown;
  readonly keywords?: unknown;
  readonly bestEffort?: unknown;
  readonly bestEffortReason?: unknown;
};

function parseCitations(raw: unknown, errors: string[], fieldLabel: string): Citation[] {
  if (!Array.isArray(raw)) {
    errors.push(`${fieldLabel} is not an array`);
    return [];
  }
  const citations: Citation[] = [];
  raw.forEach((entry: RawCitation, index) => {
    if (typeof entry.evidenceId !== 'string' || typeof entry.quote !== 'string') {
      errors.push(`${fieldLabel}[${index}] missing evidenceId or quote`);
      return;
    }
    citations.push({ evidenceId: entry.evidenceId, quote: entry.quote });
  });
  return citations;
}

function parseStringArray(raw: unknown, errors: string[], fieldLabel: string): string[] {
  if (!Array.isArray(raw)) {
    errors.push(`${fieldLabel} is not an array`);
    return [];
  }
  return raw.filter((item): item is string => typeof item === 'string');
}

/**
 * Matches quotations exactly or after the explicit whitespace and typographic-punctuation
 * normalization. Does not accept paraphrase, token overlap or fuzzy similarity. The recorded
 * normalization does not establish entailment.
 */
function normalizeQuoteText(value: string): string {
  return value
    .replace(/[‘’ʼ]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[–—]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim();
}

function quoteAppearsIn(quote: string, text: string): boolean {
  if (quote.length === 0) return false;
  if (text.includes(quote)) return true;
  return normalizeQuoteText(text).includes(normalizeQuoteText(quote));
}

/**
 * Reject quotations spanning an excerpt elision marker. A substring across omitted text cannot
 * establish a continuous passage in the original source.
 */
function quoteSpansGapMarker(quote: string, text: string): boolean {
  if (quote.length === 0) return false;
  const rawIndex = text.indexOf(quote);
  if (rawIndex !== -1) {
    return text.slice(rawIndex, rawIndex + quote.length).includes('…');
  }
  const normalizedText = normalizeQuoteText(text);
  const normalizedQuote = normalizeQuoteText(quote);
  const normalizedIndex = normalizedText.indexOf(normalizedQuote);
  if (normalizedIndex !== -1) {
    return normalizedText
      .slice(normalizedIndex, normalizedIndex + normalizedQuote.length)
      .includes('…');
  }
  return false;
}

function validateCitationsAnchor(
  citations: readonly Citation[],
  evidenceById: ReadonlyMap<string, EnrichmentEvidenceInput>,
  fieldLabel: string,
  errors: string[],
): void {
  for (const citation of citations) {
    const evidence = evidenceById.get(citation.evidenceId);
    if (evidence === undefined) {
      errors.push(`${fieldLabel}: citation references unknown evidenceId "${citation.evidenceId}"`);
      continue;
    }
    if (!quoteAppearsIn(citation.quote, evidence.text)) {
      errors.push(
        `${fieldLabel}: citation quote does not appear verbatim in evidence "${citation.evidenceId}"`,
      );
    } else if (quoteSpansGapMarker(citation.quote, evidence.text)) {
      errors.push(
        `${fieldLabel}: citation quote spans an elision marker ("[…]") in evidence ` +
          `"${citation.evidenceId}" — a quote must come from one side of an excerpt gap, never across it`,
      );
    }
  }
}

/**
 * Never publish a street address for a restricted-address property, or for a person entity
 * (living/unknown persons are protected by policy default — treatAsLiving('unknown') is true, so
 * an entity with no recorded status is treated as living and gets the same protection as a
 * confirmed-living one). This runs on the MODEL'S OUTPUT text, independent of whatever the source
 * evidence already redacted — a model can still paraphrase an address out of surrounding prose.
 */
function addressGuardApplies(subject: EnrichmentSubject): boolean {
  if (subject.restrictedAddress) return true;
  return subject.kind === 'person' && treatAsLiving('unknown');
}

function checkNoAddressTokens(text: string | null, errors: string[], fieldLabel: string): void {
  if (text === null || text.length === 0) return;
  const { redactionCount } = redactStreetAddresses(text);
  if (redactionCount > 0) {
    errors.push(
      `${fieldLabel}: contains ${redactionCount} address-shaped token(s), must not publish`,
    );
  }
}

/**
 * Rejects raw registry vocabulary copied into narrative across all lanes. Quote attachment can
 * succeed on such text, so prose validation is a separate check.
 */
function checkNoRawRegistryVocabulary(
  text: string | null,
  errors: string[],
  fieldLabel: string,
): void {
  const hits = findRawRegistryVocabulary(text);
  if (hits.length > 0) {
    errors.push(
      `${fieldLabel}: contains raw NPS registry vocabulary (${hits.join(', ')}) — write the ` +
        `significance in plain prose (e.g. "Black heritage") rather than copying the registry field`,
    );
  }
}

export function validateEnrichmentResponse(
  subject: EnrichmentSubject,
  allowedTopicIds: readonly string[],
  rawContent: string,
): EnrichmentAttempt {
  let payload: RawDraft;
  try {
    // Applies the same fenced-JSON normalization to all externally supplied content at this
    // draft validation boundary.
    payload = JSON.parse(stripMarkdownCodeFence(rawContent)) as RawDraft;
  } catch {
    return {
      subject,
      rawContent,
      validation: { ok: false, errors: ['response is not valid JSON'] },
    };
  }

  const errors: string[] = [];
  const summary = typeof payload.summary === 'string' ? payload.summary : '';
  if (typeof payload.summary !== 'string') errors.push('summary is missing or not a string');

  const bestEffort = payload.bestEffort === true;
  const bestEffortReason =
    typeof payload.bestEffortReason === 'string' ? payload.bestEffortReason.trim() : '';
  if (bestEffort && bestEffortReason.length === 0) {
    errors.push('bestEffort is true but bestEffortReason is missing or empty');
  }

  if (summary.length > SUMMARY_MAX_CHARS) {
    errors.push(`summary length ${summary.length} exceeds max ${SUMMARY_MAX_CHARS}`);
  } else if (summary.length < SUMMARY_MIN_CHARS) {
    if (!bestEffort || bestEffortReason.length === 0) {
      errors.push(
        `summary length ${summary.length} below min ${SUMMARY_MIN_CHARS} without a valid ` +
          'bestEffort:true + bestEffortReason exception',
      );
    }
  }

  const summaryCitations = parseCitations(payload.summaryCitations, errors, 'summaryCitations');
  if (summaryCitations.length === 0) errors.push('summary has no citations');

  const historicalContext =
    payload.historicalContext === null
      ? null
      : typeof payload.historicalContext === 'string'
        ? payload.historicalContext
        : undefined;
  if (historicalContext === undefined) errors.push('historicalContext must be a string or null');
  const historicalContextCitations = parseCitations(
    payload.historicalContextCitations,
    errors,
    'historicalContextCitations',
  );
  if (
    typeof historicalContext === 'string' &&
    historicalContext.length > 0 &&
    historicalContextCitations.length === 0
  ) {
    errors.push('historicalContext has prose but no citations');
  }

  const evidenceById = new Map(subject.evidence.map((item) => [item.id, item]));
  validateCitationsAnchor(summaryCitations, evidenceById, 'summaryCitations', errors);
  validateCitationsAnchor(
    historicalContextCitations,
    evidenceById,
    'historicalContextCitations',
    errors,
  );

  const rawTopicIds = parseStringArray(payload.topicIds, errors, 'topicIds');
  const topicIds = rawTopicIds.filter((id) => isValidTopicId(id));
  const invalidTopicIds = rawTopicIds.filter((id) => !isValidTopicId(id));
  if (invalidTopicIds.length > 0) {
    errors.push(
      `topicIds contains ids outside the controlled vocabulary: ${invalidTopicIds.join(', ')}`,
    );
  }
  for (const id of topicIds) {
    if (!allowedTopicIds.includes(id)) {
      errors.push(`topicId "${id}" was not in the allowedTopicIds offered to the model`);
    }
  }

  const rawEraBuckets = parseStringArray(payload.eraBuckets, errors, 'eraBuckets');
  const eraBuckets = rawEraBuckets.filter(
    (label) => decadeStartYearFromLabel(label) !== undefined && isDecadeAtOrBeforeCurrent(label),
  );
  const invalidEraBuckets = rawEraBuckets.filter((label) => !eraBuckets.includes(label));
  if (invalidEraBuckets.length > 0) {
    errors.push(
      `eraBuckets contains invalid or future decade labels: ${invalidEraBuckets.join(', ')}`,
    );
  }

  const keywords = parseStringArray(payload.keywords, errors, 'keywords');

  checkNoRawRegistryVocabulary(summary, errors, 'summary');
  checkNoRawRegistryVocabulary(historicalContext ?? null, errors, 'historicalContext');
  checkNoRawRegistryVocabulary(keywords.join('; '), errors, 'keywords');

  if (addressGuardApplies(subject)) {
    checkNoAddressTokens(summary, errors, 'summary');
    checkNoAddressTokens(historicalContext ?? null, errors, 'historicalContext');
    checkNoAddressTokens(keywords.join('; '), errors, 'keywords');
  }

  if (errors.length > 0) {
    return { subject, rawContent, validation: { ok: false, errors } };
  }

  return {
    subject,
    rawContent,
    validation: {
      ok: true,
      draft: {
        summary,
        summaryCitations,
        historicalContext: historicalContext === '' ? null : (historicalContext as string | null),
        historicalContextCitations,
        topicIds,
        eraBuckets,
        keywords,
        ...(bestEffort ? { bestEffort: true, bestEffortReason } : {}),
      },
    },
  };
}
