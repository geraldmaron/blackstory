/**
 * Editorial judge runner: LLM drafts keep/reject + field prose with entity-link markup,
 * domain validates, optional vector-related suggestions. Prepare-only; never publishes.
 * Subjects are processed concurrently via a bounded worker pool; per-item failures become
 * needs_evidence packets so overnight batches do not abort on a single bad completion.
 */
import {
  TOPIC_REGISTRY,
  buildEditorialPacket,
  linkifyProseAgainstCatalog,
  suggestRelatedEntitiesFromVectors,
  validateEditorialDrafts,
  type CatalogLinkTarget,
  type EditorialClaimDraft,
  type EditorialDecision,
  type EditorialPacket,
  type EmbeddingVector,
} from '@repo/domain';
import { createLlmProvider, type LlmProvider } from './llm-provider.js';
import type { OperatorIdentity } from './identity.js';
import { mapPool } from './map-pool.js';

export type EditorialSubject = {
  readonly subjectId: string;
  readonly title: string;
  readonly kind?: string;
  readonly existingSummary?: string;
  readonly existingContext?: string;
  readonly sourceSnippets?: readonly string[];
};

export type EditorialCatalogEntity = CatalogLinkTarget & {
  readonly vector?: EmbeddingVector;
};

export type EditorialProgressEvent = {
  readonly index: number;
  readonly total: number;
  readonly completed: number;
  readonly subjectId: string;
  readonly title: string;
  readonly decision: EditorialDecision;
  readonly error?: string;
  readonly servedBy?: string;
  readonly modelId?: string;
};

export type EditorialRunInput = {
  readonly subjects: readonly EditorialSubject[];
  readonly catalog: readonly EditorialCatalogEntity[];
  readonly identity: OperatorIdentity;
  readonly nowIso: string;
  readonly provider?: LlmProvider;
  readonly model?: string;
  /** Bounded parallel subject workers (default 1 = sequential). */
  readonly concurrency?: number;
  readonly targetVectorBySubjectId?: ReadonlyMap<string, EmbeddingVector>;
  /** Fired after each subject finishes so long batches can stream progress. */
  readonly onProgress?: (event: EditorialProgressEvent) => void;
};

export type EditorialRunItem = {
  readonly packet: EditorialPacket;
  readonly rawModelContent?: string;
  readonly relatedSuggestions: readonly {
    readonly entityId: string;
    readonly similarity: number;
    readonly displayName?: string;
  }[];
  /** Hybrid lane that answered, when applicable. */
  readonly servedBy?: string;
  readonly error?: string;
};

export type EditorialRunResult = {
  readonly kind: 'editorial.run.v1';
  readonly items: readonly EditorialRunItem[];
  readonly keepCount: number;
  readonly rejectCount: number;
  readonly needsEvidenceCount: number;
  readonly errorCount: number;
  readonly completedAt: string;
  readonly concurrency: number;
};

type ModelClaimJson = {
  readonly predicate?: string;
  readonly object?: string;
  readonly confidenceLevel?: string;
  readonly citationSource?: string;
  readonly citationHref?: string;
  readonly citationLabel?: string;
};

type ModelJson = {
  readonly decision?: string;
  readonly rationale?: string;
  readonly confidence?: number;
  readonly drafts?: {
    readonly publicSummary?: string;
    readonly historicalContext?: string;
    readonly identityLabel?: string;
    readonly relevanceNote?: string;
    readonly relatedEntityIds?: readonly string[];
    readonly proposedRelationshipNotes?: string;
    readonly claims?: readonly ModelClaimJson[];
    readonly topicIds?: readonly string[];
    readonly eraBuckets?: readonly string[];
    readonly keywords?: readonly string[];
  };
};

const TOPIC_ID_LIST = TOPIC_REGISTRY.map((topic) => topic.id).join(', ');

const EDITORIAL_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'rationale', 'confidence', 'drafts'],
  properties: {
    decision: { enum: ['keep', 'reject', 'needs_evidence'] },
    rationale: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    drafts: {
      type: 'object',
      additionalProperties: false,
      required: [
        'publicSummary',
        'historicalContext',
        'relatedEntityIds',
        'proposedRelationshipNotes',
        'claims',
        'topicIds',
        'eraBuckets',
        'keywords',
      ],
      properties: {
        publicSummary: { type: 'string' },
        historicalContext: { type: 'string' },
        identityLabel: { type: 'string' },
        relevanceNote: { type: 'string' },
        relatedEntityIds: { type: 'array', items: { type: 'string' } },
        proposedRelationshipNotes: { type: 'string' },
        claims: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'predicate',
              'object',
              'confidenceLevel',
              'citationSource',
              'citationHref',
              'citationLabel',
            ],
            properties: {
              predicate: { type: 'string' },
              object: { type: 'string' },
              confidenceLevel: { enum: ['high', 'medium', 'low'] },
              citationSource: { type: 'string' },
              citationHref: { type: 'string' },
              citationLabel: { type: 'string' },
            },
          },
        },
        topicIds: {
          type: 'array',
          items: { enum: TOPIC_REGISTRY.map((topic) => topic.id) },
        },
        eraBuckets: { type: 'array', items: { type: 'string' } },
        keywords: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are an editorial judge for BlackStory (History, pinned to place).
Return ONLY JSON with keys: decision (keep|reject|needs_evidence), rationale, confidence (0-1),
drafts: { publicSummary, historicalContext, identityLabel?, relevanceNote?, relatedEntityIds?,
proposedRelationshipNotes?, claims?, topicIds?, eraBuckets?, keywords? }.
Rules:
- publicSummary 120-400 chars, specific evidence-led prose, no sensational framing, no completeness claims.
- historicalContext: 1-3 sentences of teaching context — why this record matters, how it connects to
  the laws, institutions, and structural forces around it (e.g. segregation statutes, migration,
  land ownership). Only context supported by the provided material or uncontroversial consensus history.
- claims: 1-6 atomic factual claims that the provided sourceSnippets explicitly support. Each claim is
  {predicate, object, confidenceLevel: high|medium|low, citationSource: hostname, citationHref, citationLabel}.
  citationHref MUST be one of the URLs provided in sourceSnippets — never invent or modify a URL.
  If the snippets support no verifiable claim, return an empty claims array and decision needs_evidence.
- topicIds: 2-5 ids chosen ONLY from this registry: ${TOPIC_ID_LIST}.
- eraBuckets: decade strings like "1910s", only when the era is evidenced in the material.
- keywords: 2-5 short search phrases from the material.
- proposedRelationshipNotes: propose typed edges to catalog entities (located_at, part_of, governed_by,
  influenced, caused, commemorates, attended, member_of) with a one-line evidence note each; mark any
  caused/enabled proposal as requiring consensus review.
- When mentioning other catalog entities, use markup [[entityId|Display Name]] for known ids only.
- Do not invent citations or claim legal procedural status.
- reject spam/commerce/off-topic; needs_evidence when thin; keep when learnable with place context.
- relatedEntityIds must be existing catalog ids only.`;

/**
 * Free-model JSON output is not guaranteed to match the declared shape at runtime
 * (a field the type says is `string` can arrive as a number, null, nested object, or
 * be missing entirely). Coerce defensively so a malformed field degrades to an empty
 * string caught by domain validation, instead of throwing deep inside `.trim()` calls
 * and turning the whole subject into an opaque `needs_evidence` error.
 */
function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toSafeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseDecision(raw: string | undefined): EditorialDecision {
  if (raw === 'reject' || raw === 'needs_evidence' || raw === 'keep') return raw;
  return 'needs_evidence';
}

function extractJsonObject(content: string): ModelJson {
  const trimmed = content.trim();
  const candidates = [trimmed];
  const braceMatch = /\{[\s\S]*\}/u.exec(trimmed);
  if (braceMatch) candidates.push(braceMatch[0]);
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as ModelJson;
      }
    } catch {
      // Try the next candidate (GLM/Qwen sometimes wrap JSON in prose).
    }
  }
  throw new Error('Model response did not contain a JSON object');
}

function ensureLinkedSummary(
  summary: string | undefined,
  catalog: readonly CatalogLinkTarget[],
  subjectId: string,
): string | undefined {
  if (!summary?.trim()) return undefined;
  if (summary.includes('[[')) return summary;
  return linkifyProseAgainstCatalog(summary, catalog, { skipEntityIds: [subjectId] }).text;
}

async function judgeOneSubject(input: {
  readonly subject: EditorialSubject;
  readonly provider: LlmProvider;
  readonly model: string;
  readonly catalogTargets: readonly CatalogLinkTarget[];
  readonly vectorCorpus: readonly {
    readonly id: string;
    readonly vector: EmbeddingVector;
    readonly displayName?: string;
  }[];
  readonly catalog: readonly EditorialCatalogEntity[];
  readonly identity: OperatorIdentity;
  readonly nowIso: string;
  readonly targetVectorBySubjectId?: ReadonlyMap<string, EmbeddingVector>;
}): Promise<EditorialRunItem> {
  const { subject, provider, catalogTargets, vectorCorpus } = input;
  try {
    const userPayload = {
      subjectId: subject.subjectId,
      title: subject.title,
      kind: subject.kind ?? null,
      existingSummary: subject.existingSummary ?? null,
      existingContext: subject.existingContext ?? null,
      sourceSnippets: subject.sourceSnippets ?? [],
      catalogSample: catalogTargets.slice(0, 40).map((entry) => ({
        id: entry.id,
        displayName: entry.displayName,
      })),
    };
    const completion = await provider.complete({
      model: input.model,
      maxTokens: 2400,
      responseSchema: { name: 'editorial_judgment', schema: EDITORIAL_RESPONSE_SCHEMA },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    });
    const parsed = extractJsonObject(completion.content);
    const draftsIn = parsed.drafts ?? {};
    const linkedSummary = ensureLinkedSummary(
      draftsIn.publicSummary ?? subject.existingSummary,
      catalogTargets,
      subject.subjectId,
    );
    const drafts = {
      ...(linkedSummary !== undefined ? { publicSummary: linkedSummary } : {}),
      ...(draftsIn.historicalContext !== undefined
        ? { historicalContext: draftsIn.historicalContext }
        : subject.existingContext !== undefined
          ? { historicalContext: subject.existingContext }
          : {}),
      ...(draftsIn.identityLabel !== undefined ? { identityLabel: draftsIn.identityLabel } : {}),
      ...(draftsIn.relevanceNote !== undefined ? { relevanceNote: draftsIn.relevanceNote } : {}),
      ...(draftsIn.relatedEntityIds !== undefined
        ? { relatedEntityIds: draftsIn.relatedEntityIds }
        : {}),
      ...(draftsIn.proposedRelationshipNotes !== undefined
        ? { proposedRelationshipNotes: draftsIn.proposedRelationshipNotes }
        : {}),
      ...(draftsIn.claims !== undefined
        ? {
            claims: (Array.isArray(draftsIn.claims) ? draftsIn.claims : []).map(
              (claim): EditorialClaimDraft => ({
                predicate: toSafeString(claim?.predicate),
                object: toSafeString(claim?.object),
                confidenceLevel:
                  claim?.confidenceLevel === 'high' ||
                  claim?.confidenceLevel === 'medium' ||
                  claim?.confidenceLevel === 'low'
                    ? claim.confidenceLevel
                    : 'low',
                citationSource: toSafeString(claim?.citationSource),
                citationHref: toSafeString(claim?.citationHref),
                citationLabel: toSafeString(claim?.citationLabel),
              }),
            ),
          }
        : {}),
      ...(draftsIn.topicIds !== undefined
        ? { topicIds: toSafeStringArray(draftsIn.topicIds) }
        : {}),
      ...(draftsIn.eraBuckets !== undefined
        ? { eraBuckets: toSafeStringArray(draftsIn.eraBuckets) }
        : {}),
      ...(draftsIn.keywords !== undefined
        ? { keywords: toSafeStringArray(draftsIn.keywords) }
        : {}),
    };
    // Claims may cite only URLs the judge was actually shown — fabricated hrefs fail validation.
    const allowedCitationHrefs = (subject.sourceSnippets ?? []).flatMap(
      (snippet) => snippet.match(/https?:\/\/\S+/gu) ?? [],
    );
    const validation = validateEditorialDrafts(drafts, { allowedCitationHrefs });
    const targetVector =
      input.targetVectorBySubjectId?.get(subject.subjectId) ??
      input.catalog.find((entry) => entry.id === subject.subjectId)?.vector;
    const relatedSuggestions =
      targetVector && vectorCorpus.length > 0
        ? suggestRelatedEntitiesFromVectors({
            targetVector,
            corpus: vectorCorpus.filter((entry) => entry.id !== subject.subjectId),
            limit: 8,
            minSimilarity: 0.35,
          })
        : [];

    const relatedIds = [
      ...new Set([
        ...(drafts.relatedEntityIds ?? []),
        ...relatedSuggestions.map((item) => item.entityId),
      ]),
    ].filter((id) => id !== subject.subjectId);

    const packet = buildEditorialPacket({
      subjectId: subject.subjectId,
      subjectTitle: subject.title,
      decision: parseDecision(parsed.decision),
      rationale: parsed.rationale?.trim() || 'No rationale returned.',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.4,
      drafts: {
        ...drafts,
        ...(relatedIds.length > 0 ? { relatedEntityIds: relatedIds } : {}),
      },
      validationIssues: validation.issues,
      model: {
        provider: completion.servedBy ?? completion.provider,
        modelId: completion.modelId,
      },
      createdAt: input.nowIso,
      operatorId: input.identity.operatorId,
      sessionId: input.identity.sessionId,
    });

    return {
      packet,
      rawModelContent: completion.content,
      relatedSuggestions,
      ...(completion.servedBy !== undefined ? { servedBy: completion.servedBy } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const packet = buildEditorialPacket({
      subjectId: subject.subjectId,
      subjectTitle: subject.title,
      decision: 'needs_evidence',
      rationale: `LLM completion failed: ${message.slice(0, 300)}`,
      confidence: 0,
      drafts: {
        ...(subject.existingSummary !== undefined
          ? { publicSummary: subject.existingSummary }
          : {}),
      },
      validationIssues: [`completion_error: ${message.slice(0, 200)}`],
      model: { provider: provider.id, modelId: input.model },
      createdAt: input.nowIso,
      operatorId: input.identity.operatorId,
      sessionId: input.identity.sessionId,
    });
    return {
      packet,
      relatedSuggestions: [],
      error: message,
    };
  }
}

export async function runEditorialJudge(input: EditorialRunInput): Promise<EditorialRunResult> {
  const provider = input.provider ?? createLlmProvider({ provider: 'mock' });
  const concurrency = Math.max(1, Math.floor(input.concurrency ?? 1));
  const catalogTargets: CatalogLinkTarget[] = input.catalog.map((entry) => ({
    id: entry.id,
    displayName: entry.displayName,
    ...(entry.aliases !== undefined ? { aliases: entry.aliases } : {}),
  }));
  const vectorCorpus = input.catalog
    .filter((entry) => entry.vector !== undefined)
    .map((entry) => ({
      id: entry.id,
      vector: entry.vector!,
      ...(entry.displayName !== undefined ? { displayName: entry.displayName } : {}),
    }));

  let completed = 0;
  const items = await mapPool(
    input.subjects,
    (subject) =>
      judgeOneSubject({
        subject,
        provider,
        model: input.model ?? 'mock-editorial-v1',
        catalogTargets,
        vectorCorpus,
        catalog: input.catalog,
        identity: input.identity,
        nowIso: input.nowIso,
        ...(input.targetVectorBySubjectId !== undefined
          ? { targetVectorBySubjectId: input.targetVectorBySubjectId }
          : {}),
      }),
    {
      concurrency,
      onItemComplete: (item, index, total) => {
        completed += 1;
        input.onProgress?.({
          index,
          total,
          completed,
          subjectId: item.packet.subjectId,
          title: item.packet.subjectTitle ?? input.subjects[index]!.title,
          decision: item.packet.decision,
          ...(item.error !== undefined ? { error: item.error } : {}),
          ...(item.servedBy !== undefined ? { servedBy: item.servedBy } : {}),
          ...(item.packet.model?.modelId !== undefined
            ? { modelId: item.packet.model.modelId }
            : {}),
        });
      },
    },
  );

  return {
    kind: 'editorial.run.v1',
    items,
    keepCount: items.filter((item) => item.packet.decision === 'keep').length,
    rejectCount: items.filter((item) => item.packet.decision === 'reject').length,
    needsEvidenceCount: items.filter((item) => item.packet.decision === 'needs_evidence').length,
    errorCount: items.filter((item) => item.error !== undefined).length,
    completedAt: input.nowIso,
    concurrency,
  };
}
