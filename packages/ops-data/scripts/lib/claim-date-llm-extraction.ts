/**
 * Stage 2 claim-date LLM extraction helpers: prompt, schema, mock provider, response parsing.
 */
import {
  parseLlmClaimDateExtractionPayload,
  validateLlmClaimDateExtraction,
  type LlmClaimDateExtraction,
  type LlmClaimDateValidationResult,
} from '../../../domain/src/temporal/claim-date-llm-validation.ts';
import { inferTemporalProperty } from '../../../domain/src/temporal/predicate-temporal-hints.ts';
import type { LlmProvider, LlmCompletionRequest } from '../../../operator-cli/src/llm-provider.ts';

export const CLAIM_DATE_EXTRACTION_SCHEMA_ID = 'claim_date_extraction.v1' as const;
export const CLAIM_DATE_EXTRACTION_SCHEMA_VERSION = '1' as const;

export type ClaimDateExtractionSubject = {
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly entityId: string;
  readonly predicate: string;
  readonly object: string;
};

export type ClaimDateExtractionAttempt = {
  readonly subject: ClaimDateExtractionSubject;
  readonly rawContent: string;
  readonly validation: LlmClaimDateValidationResult;
};

export const CLAIM_DATE_EXTRACTION_RESPONSE_SCHEMA = {
  name: 'claim_date_extraction',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['edtf', 'property', 'verbatim_quote', 'char_offsets'],
    properties: {
      edtf: {
        type: 'string',
        description: 'EDTF Level 1 string grounded in the quote; never invent years.',
      },
      property: {
        type: 'string',
        enum: ['point_in_time', 'start', 'end'],
        description: 'Temporal role of the extracted date within the claim.',
      },
      verbatim_quote: {
        type: 'string',
        description: 'Exact substring copied from the claim object that supports the EDTF.',
      },
      char_offsets: {
        type: 'object',
        additionalProperties: false,
        required: ['start', 'end'],
        properties: {
          start: { type: 'integer', minimum: 0 },
          end: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT =
  'You extract one historical date from a claim object that already passed evidence review. ' +
  'Return JSON only. Copy verbatim_quote exactly from the claim object. Never invent years, ' +
  'entity ids, or dates not present in the quote. Prefer EDTF Level 1 (year, ISO date, circa ~, ' +
  'decade X, open interval [..YYYY]). Map property to start (birth/founded), end (death/closed), ' +
  'or point_in_time when unclear.';

export function buildClaimDateExtractionUserPrompt(subject: ClaimDateExtractionSubject): string {
  return JSON.stringify(
    {
      task: 'extract_claim_date',
      schema: CLAIM_DATE_EXTRACTION_SCHEMA_ID,
      claimId: subject.claimId,
      claimVersionId: subject.claimVersionId,
      entityId: subject.entityId,
      predicate: subject.predicate,
      object: subject.object,
      hintProperty: inferTemporalProperty(subject.predicate),
      rules: [
        'verbatim_quote must be an exact substring of object',
        'char_offsets.start/end must match that substring',
        'edtf must use only years present in verbatim_quote',
        'return exactly one best-supported date',
      ],
    },
    null,
    2,
  );
}

export function buildClaimDateExtractionRequest(subject: ClaimDateExtractionSubject): LlmCompletionRequest {
  const model =
    process.env.OPENROUTER_MODEL?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    process.env.EXTRACT_CLAIM_DATE_LLM_MODEL?.trim() ||
    'openai/gpt-4o-mini';
  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildClaimDateExtractionUserPrompt(subject) },
    ],
    model,
    temperature: 0,
    maxTokens: 512,
    responseSchema: CLAIM_DATE_EXTRACTION_RESPONSE_SCHEMA,
  };
}

/** Deterministic mock: anchors the first 4-digit year in prose for tests and dry-runs. */
export function mockExtractClaimDateFromProse(subject: ClaimDateExtractionSubject): LlmClaimDateExtraction | null {
  const match = /\b(1[0-9]{3}|20[0-9]{2})\b/u.exec(subject.object);
  if (!match?.[0] || match.index === undefined) return null;
  const year = match[0];
  const start = match.index;
  const end = start + year.length;
  if (subject.object.slice(start, end) !== year) return null;
  return {
    edtf: year,
    property: inferTemporalProperty(subject.predicate),
    verbatimQuote: year,
    charOffsets: { start, end },
  };
}

export function createMockClaimDateExtractionProvider(modelId = 'mock-claim-date-extraction-v1'): LlmProvider {
  return {
    id: 'mock',
    async complete(request) {
      const user = request.messages.find((message) => message.role === 'user')?.content ?? '';
      let subject: ClaimDateExtractionSubject | null = null;
      try {
        const parsed = JSON.parse(user) as Record<string, unknown>;
        if (typeof parsed.claimId === 'string' && typeof parsed.object === 'string') {
          subject = {
            claimId: parsed.claimId,
            claimVersionId: typeof parsed.claimVersionId === 'string' ? parsed.claimVersionId : 'cv_mock',
            entityId: typeof parsed.entityId === 'string' ? parsed.entityId : 'ent_mock',
            predicate: typeof parsed.predicate === 'string' ? parsed.predicate : '',
            object: parsed.object,
          };
        }
      } catch {
        subject = null;
      }
      const extraction = subject ? mockExtractClaimDateFromProse(subject) : null;
      const payload = extraction
        ? {
            edtf: extraction.edtf,
            property: extraction.property,
            verbatim_quote: extraction.verbatimQuote,
            char_offsets: extraction.charOffsets,
          }
        : { edtf: '', property: 'point_in_time', verbatim_quote: '', char_offsets: { start: 0, end: 0 } };
      return {
        content: JSON.stringify(payload),
        provider: 'mock',
        modelId: request.model || modelId,
      };
    },
  };
}

export function validateClaimDateExtractionResponse(
  subject: ClaimDateExtractionSubject,
  rawContent: string,
): ClaimDateExtractionAttempt {
  let payload: unknown;
  try {
    payload = JSON.parse(rawContent);
  } catch {
    return {
      subject,
      rawContent,
      validation: { ok: false, errors: ['response is not valid JSON'] },
    };
  }
  const extraction = parseLlmClaimDateExtractionPayload(payload, subject.predicate);
  if (!extraction) {
    return {
      subject,
      rawContent,
      validation: { ok: false, errors: ['response missing required extraction fields'] },
    };
  }
  return {
    subject,
    rawContent,
    validation: validateLlmClaimDateExtraction(subject.object, extraction),
  };
}
