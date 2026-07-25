/**
 * Embedding pipeline orchestration: text -> provider -> truncate/normalize -> record.
 *
 * This module has no Firestore dependency — it takes an injected EmbeddingProvider and returns
 * plain data. `vector-store.ts` is the thin layer that actually writes/queries Firestore.
 *
 * Integration point (documented, not yet wired): the on-write trigger belongs in the
 * publication/projection build step in `workers/publication/`. After a canonical entity's
 * title/summary/place/era-relevant fields change (or an entity is (re)promoted into a release),
 * that worker should call `embedEntity` with the entity's resolved location/state and pass the
 * result to `createAdminVectorIndexStore(firestore).writeEmbedding(...)`. That worker is not
 * a concrete Cloud Run Job yet. The backfill CLI (`backfill-cli.ts`) exercises the identical
 * `embedEntity` codepath today.
 */
import { createHash } from 'node:crypto';
import { APPROX_TOKENS_PER_CHAR, APPROX_USD_PER_1K_TOKENS, EMBEDDING_DIMS } from './constants.js';
import type { EmbeddingProvider } from './provider.js';
import {
  truncateAndNormalize,
  assertValidEmbeddingVector,
  type EmbeddingVector,
} from './vector-math.js';
import {
  buildEntityEmbeddingText,
  deriveEntityFilters,
  type EntityEmbeddingSource,
  type EntityLocationContext,
  type EntityVectorFilters,
} from './text.js';

export type EntityEmbeddingInput = {
  readonly entityId: string;
  readonly entity: EntityEmbeddingSource;
  readonly location?: EntityLocationContext;
};

export type EntityEmbeddingResult = {
  readonly entityId: string;
  readonly vector: EmbeddingVector;
  readonly dims: number;
  readonly model: string;
  readonly unitNorm: true;
  readonly filters: EntityVectorFilters;
  readonly sourceText: string;
  readonly sourceTextHash: string;
  readonly computedAt: string;
};

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export type EmbedEntityOptions = {
  readonly dims?: number;
  readonly now?: () => string;
};

/** Embeds a single entity: builds text, calls the provider, truncates+normalizes the result. */
export async function embedEntity(
  provider: EmbeddingProvider,
  input: EntityEmbeddingInput,
  options: EmbedEntityOptions = {},
): Promise<EntityEmbeddingResult> {
  const dims = options.dims ?? EMBEDDING_DIMS;
  const now = options.now ?? (() => new Date().toISOString());
  const sourceText = buildEntityEmbeddingText(input.entity, input.location);
  if (!sourceText.trim()) {
    throw new Error(`Entity ${input.entityId} produced empty embedding text`);
  }

  const [rawVector] = await provider.embed([sourceText]);
  if (!rawVector) {
    throw new Error(`Embedding provider returned no vector for entity ${input.entityId}`);
  }

  const vector = truncateAndNormalize(rawVector, dims);
  assertValidEmbeddingVector(vector, dims);

  return {
    entityId: input.entityId,
    vector,
    dims,
    model: provider.model,
    unitNorm: true,
    filters: deriveEntityFilters(input.entity, input.location),
    sourceText,
    sourceTextHash: sha256Hex(sourceText),
    computedAt: now(),
  };
}

export type BatchEmbedOptions = EmbedEntityOptions & {
  /** Caps how many entities are embedded in one call a simple budget/concurrency guard. */
  readonly maxItems?: number;
  /** Stops the batch once cumulative estimated cost would exceed this (see cost.ts). */
  readonly maxEstimatedCostUsd?: number;
  readonly onItem?: (result: EntityEmbeddingResult) => void;
  readonly onSkip?: (input: EntityEmbeddingInput, reason: string) => void;
};

export type BatchEmbedResult = {
  readonly results: readonly EntityEmbeddingResult[];
  readonly skipped: readonly { readonly entityId: string; readonly reason: string }[];
  readonly stoppedForBudget: boolean;
};

/**
 * Embeds a list of entities sequentially, honoring a soft item cap and a cost budget. Sequential
 * (not concurrent) on purpose: this keeps retry/backoff behavior simple and the call pattern
 * gentle on rate limits for what is, per the, an infrequent bulk operation.
 */
export async function embedEntitiesBatch(
  provider: EmbeddingProvider,
  inputs: readonly EntityEmbeddingInput[],
  options: BatchEmbedOptions = {},
): Promise<BatchEmbedResult> {
  const results: EntityEmbeddingResult[] = [];
  const skipped: { readonly entityId: string; readonly reason: string }[] = [];
  let cumulativeCostUsd = 0;
  let stoppedForBudget = false;

  for (const input of inputs) {
    if (options.maxItems !== undefined && results.length >= options.maxItems) {
      break;
    }

    const text = buildEntityEmbeddingText(input.entity, input.location);
    const projectedCost = estimateEmbeddingCostUsd(text.length);
    if (
      options.maxEstimatedCostUsd !== undefined &&
      cumulativeCostUsd + projectedCost > options.maxEstimatedCostUsd
    ) {
      stoppedForBudget = true;
      break;
    }

    try {
      const result = await embedEntity(provider, input, options);
      cumulativeCostUsd += projectedCost;
      results.push(result);
      options.onItem?.(result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push({ entityId: input.entityId, reason });
      options.onSkip?.(input, reason);
    }
  }

  return { results, skipped, stoppedForBudget };
}

/**
 * Rough cost estimate from the brief anchor (~$7.50 100k docs of ~500 tokens). This is a
 * planning heuristic for backfill budgeting, not a billing-accurate calculation.
 */
export function estimateEmbeddingCostUsd(charCount: number): number {
  const tokens = charCount * APPROX_TOKENS_PER_CHAR;
  return (tokens / 1000) * APPROX_USD_PER_1K_TOKENS;
}
