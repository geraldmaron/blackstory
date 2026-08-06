/**
 * repo-n7p6.4 (WS4) — cheap-model entity enrichment: prompt, schema, response validation.
 *
 * Same discipline as claim-date-llm-extraction.ts (Stage 2 date extraction): the model states
 * only facts present in supplied evidence, every factual field carries a citation (evidence id +
 * verbatim quote), and a deterministic validator — not the model's own claim — decides whether a
 * response is trustworthy enough to store. A response that fails validation is quarantined, never
 * written to the public projection; WS5 (separately gated) is the only path from ledger to
 * bb_public.
 */
import { treatAsLiving } from '@repo/domain';
import { decadeStartYearFromLabel, isDecadeAtOrBeforeCurrent } from '@repo/domain';
import { isValidTopicId } from '@repo/domain';
import { redactStreetAddresses } from './evidence-collectors/redact-address.ts';
import {
  stripMarkdownCodeFence,
  type LlmCompletionRequest,
  type LlmProvider,
} from '../../../operator-cli/src/llm-provider.ts';

export const ENTITY_ENRICHMENT_SCHEMA_ID = 'entity_enrichment_draft.v1' as const;
export const ENTITY_ENRICHMENT_SCHEMA_VERSION = '1' as const;

/** Public-projection bounds this draft must satisfy (packages/schemas/src/public-projections.ts). */
export const SUMMARY_MIN_CHARS = 120;
export const SUMMARY_MAX_CHARS = 400;

export type EnrichmentEvidenceInput = {
  readonly id: string;
  readonly sourceTier: 'tier1' | 'tier2';
  readonly title: string | null;
  /** Possibly truncated by the caller to bound prompt size; truncation never hides a citation's source. */
  readonly text: string;
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
    quote: { type: 'string', description: 'Exact substring copied from that evidence id\'s text.' },
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
        description: `${SUMMARY_MIN_CHARS}-${SUMMARY_MAX_CHARS} characters, facts only from supplied evidence.`,
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

export const ENTITY_ENRICHMENT_SYSTEM_PROMPT =
  'You write short factual entries for a Black history catalog, using ONLY the evidence documents ' +
  'supplied in the user message. State only facts present in that evidence. Every sentence of fact ' +
  'in "summary" and "historicalContext" must be traceable to at least one citation whose quote is ' +
  'copied verbatim from a supplied evidence document\'s text. Never invent dates, names, events, or ' +
  'quotes not present in the evidence. If the evidence does not support a historicalContext ' +
  'paragraph beyond the summary, return null for it and an empty citations array rather than padding ' +
  'with generic prose. Privacy: never state a street address, house number, coordinate pair, or ' +
  'other parcel-precise location in any output field — for people (living or possibly living) and ' +
  'address-restricted places this is a hard safety rule, and neighborhood- or city-level wording is ' +
  'always sufficient. Return JSON only.';

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
        text: item.text,
      })),
      rules: [
        `summary must be ${SUMMARY_MIN_CHARS}-${SUMMARY_MAX_CHARS} characters`,
        'every citation.evidenceId must be one of the ids in the evidence array above',
        'every citation.quote must be an exact verbatim substring of that evidence id\'s text',
        'topicIds must only use ids from allowedTopicIds; omit if none clearly apply',
        'eraBuckets must be decade labels ("1950s") grounded in a year present in the evidence',
        'if evidence is too thin for historicalContext, set it to null and historicalContextCitations to []',
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
    // Reasoning models on the default paid roster (deepseek-r1-0528) write their chain-of-thought
    // directly into the response body ahead of the final JSON — OpenRouter's `reasoning` field
    // separation isn't honored by every router. 1400 tokens was measured truncating mid-reasoning
    // on 17/20 real dc-sites entities (2026-08-06 live run), never reaching the JSON at all. 6000
    // leaves headroom for a multi-paragraph reasoning chain plus the (short) final answer.
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
      const displayName = typeof subject.displayName === 'string' ? subject.displayName : 'This entity';
      const firstEvidence = Array.isArray(subject.evidence)
        ? (subject.evidence[0] as { id?: unknown; text?: unknown } | undefined)
        : undefined;
      const evidenceId = typeof firstEvidence?.id === 'string' ? firstEvidence.id : 'ev_mock';
      const evidenceText = typeof firstEvidence?.text === 'string' ? firstEvidence.text : '';
      const quote = evidenceText.slice(0, 60).trim();
      const filler =
        `${displayName} is documented in the supplied evidence. `.repeat(6).slice(0, SUMMARY_MAX_CHARS - 1);
      const summary = quote.length > 0 ? `${quote} ${filler}`.slice(0, SUMMARY_MAX_CHARS) : filler;
      const paddedSummary =
        summary.length < SUMMARY_MIN_CHARS ? summary.padEnd(SUMMARY_MIN_CHARS, '.') : summary;
      const payload = {
        summary: paddedSummary,
        summaryCitations: quote.length > 0 ? [{ evidenceId, quote }] : [{ evidenceId, quote: filler.slice(0, 20) }],
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
 * Quote must appear verbatim, or after whitespace + typographic-punctuation normalization —
 * never fuzzy-matched, never word-overlap scored. The second pass exists because source
 * evidence routinely carries curly quotes/apostrophes and em/en dashes (Wikipedia, NPS OCR),
 * and a model "copying verbatim" overwhelmingly straightens that punctuation as a side effect
 * of tokenization — measured directly against a live 21-entity batch (2026-08-06): of 47
 * citations that failed a raw substring check, 33 were this exact case (curly "'"/'"' vs
 * straight) and matched cleanly once normalized. That is not the model inventing a quote; it is
 * the validator being stricter than the actual anchoring guarantee needs. Straight-vs-curly
 * carries zero factual risk either direction, unlike whitespace collapsing (already handled)
 * or actual paraphrase (still caught: this only folds a fixed, small character set).
 */
function quoteAppearsIn(quote: string, text: string): boolean {
  if (quote.length === 0) return false;
  if (text.includes(quote)) return true;
  const normalize = (value: string) =>
    value
      .replace(/[‘’ʼ]/gu, "'")
      .replace(/[“”]/gu, '"')
      .replace(/[–—]/gu, '-')
      .replace(/\s+/gu, ' ')
      .trim();
  return normalize(text).includes(normalize(quote));
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
    errors.push(`${fieldLabel}: contains ${redactionCount} address-shaped token(s), must not publish`);
  }
}

export function validateEnrichmentResponse(
  subject: EnrichmentSubject,
  allowedTopicIds: readonly string[],
  rawContent: string,
): EnrichmentAttempt {
  let payload: RawDraft;
  try {
    // A session-drafted answer (Haiku subagent, human operator) commonly wraps its JSON in a
    // markdown fence out of habit; OpenRouter responses already get this treatment inside
    // extractMessageContent before reaching here. Normalizing at the validation boundary means
    // every raw-content source — API or session — is held to one parsing rule, not one per caller.
    payload = JSON.parse(stripMarkdownCodeFence(rawContent)) as RawDraft;
  } catch {
    return { subject, rawContent, validation: { ok: false, errors: ['response is not valid JSON'] } };
  }

  const errors: string[] = [];
  const summary = typeof payload.summary === 'string' ? payload.summary : '';
  if (typeof payload.summary !== 'string') errors.push('summary is missing or not a string');
  if (summary.length < SUMMARY_MIN_CHARS || summary.length > SUMMARY_MAX_CHARS) {
    errors.push(`summary length ${summary.length} outside [${SUMMARY_MIN_CHARS}, ${SUMMARY_MAX_CHARS}]`);
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
  if (typeof historicalContext === 'string' && historicalContext.length > 0 && historicalContextCitations.length === 0) {
    errors.push('historicalContext has prose but no citations');
  }

  const evidenceById = new Map(subject.evidence.map((item) => [item.id, item]));
  validateCitationsAnchor(summaryCitations, evidenceById, 'summaryCitations', errors);
  validateCitationsAnchor(historicalContextCitations, evidenceById, 'historicalContextCitations', errors);

  const rawTopicIds = parseStringArray(payload.topicIds, errors, 'topicIds');
  const topicIds = rawTopicIds.filter((id) => isValidTopicId(id));
  const invalidTopicIds = rawTopicIds.filter((id) => !isValidTopicId(id));
  if (invalidTopicIds.length > 0) {
    errors.push(`topicIds contains ids outside the controlled vocabulary: ${invalidTopicIds.join(', ')}`);
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
    errors.push(`eraBuckets contains invalid or future decade labels: ${invalidEraBuckets.join(', ')}`);
  }

  const keywords = parseStringArray(payload.keywords, errors, 'keywords');

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
      },
    },
  };
}
