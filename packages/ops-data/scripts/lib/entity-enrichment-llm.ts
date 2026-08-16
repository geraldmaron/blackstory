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
   * How `text` relates to the source document, when it is not the whole of it (repo-z57b). Says
   * whether the excerpt was selected for relevance or is a plain head slice, how much was left
   * out, and — the part a drafter must act on — whether the document mentions the lane's subject
   * matter anywhere at all. Absent when the source was handed over whole.
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
   * Floor v2 (repo-2t04.1): the only way a summary under SUMMARY_MIN_CHARS is ever accepted.
   * Requires bestEffortReason stating the evidence sweep was exhausted — never silent. Written
   * through to the ledger's notes.draft (entity-enrichment-apply.ts) so best-effort rows stay
   * queryable and re-sweepable once better evidence lands.
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

export const ENTITY_ENRICHMENT_SYSTEM_PROMPT =
  'You write short factual entries for a Black history catalog, using ONLY the evidence documents ' +
  'supplied in the user message. State only facts present in that evidence. Every sentence of fact ' +
  'in "summary" and "historicalContext" must be traceable to at least one citation whose quote is ' +
  "copied verbatim from a supplied evidence document's text. Never invent dates, names, events, or " +
  'quotes not present in the evidence. If the evidence does not support a historicalContext ' +
  'paragraph beyond the summary, return null for it and an empty citations array rather than padding ' +
  'with generic prose. What an entry is FOR is significance: who the subject mattered to, what ' +
  'happened there, which people, congregations, schools, businesses, or movements it served, and ' +
  'why it is recognized as Black heritage. It is NOT a description of physical fabric. National ' +
  'Register nominations spend most of their length on materials, plan, dimensions, and style; treat ' +
  'that as background and draw on it only where the fabric carries the significance itself — a ' +
  'building designed or built by Black architects or craftsmen, a form that records how the space ' +
  'was actually used. Open the summary on significance, never on construction description. If the ' +
  'supplied evidence establishes nothing about Black history beyond the bare fact of listing, write ' +
  'only what the evidence supports and return null for historicalContext: a short honest entry is ' +
  'correct, a padded architectural one is not. ' +
  'Privacy: never state a street address, house number, coordinate pair, or ' +
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
    errors.push(
      `${fieldLabel}: contains ${redactionCount} address-shaped token(s), must not publish`,
    );
  }
}

/**
 * repo-lm6h — refuse a draft that copies raw registry vocabulary into prose.
 *
 * Quote-verification cannot catch this and never will: "recognized under ethnic heritage (black)"
 * is a genuine substring of the NPS source document, so the citation anchors, the draft validates,
 * and the phrase publishes. `humanizeAreaCode` cannot catch it either — it guards the template
 * path, where a code is substituted into a generated sentence, and here no substitution ever
 * happened. The only place this is catchable is here, on the model's own output text, which is
 * also where `checkNoAddressTokens` sits for the same structural reason.
 *
 * Applied to every lane, not just nrhp-black-heritage: an entity drafted from an NPS nomination
 * carries the same vocabulary whatever lane routed it.
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
    // A session-drafted answer (Haiku subagent, human operator) commonly wraps its JSON in a
    // markdown fence out of habit; OpenRouter responses already get this treatment inside
    // extractMessageContent before reaching here. Normalizing at the validation boundary means
    // every raw-content source — API or session — is held to one parsing rule, not one per caller.
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
