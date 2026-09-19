import { getOpsPostgresPool } from '@repo/data-access';
import {
  createPostgresCanonicalEntitySource,
  createPostgresExistingHashLookup,
} from './backfill-sources-postgres.js';
import { EMBEDDING_DIMS } from './constants.js';
import { createGeminiEmbeddingProvider } from './gemini-provider.js';
import {
  embedEntity,
  estimateEmbeddingCostUsd,
  sha256Hex,
  type EntityEmbeddingInput,
  type EntityEmbeddingResult,
} from './pipeline.js';
import type { EmbeddingProvider } from './provider.js';
import { buildEntityEmbeddingText } from './text.js';
import { createPostgresVectorIndexStore } from './postgres-vector-store.js';
import { type VectorIndexStore } from './vector-store.js';

export type CanonicalEntitySourcePage = {
  readonly items: readonly EntityEmbeddingInput[];
  readonly nextCursor?: string;
};

export type CanonicalEntitySource = {
  listPage(cursor?: string): Promise<CanonicalEntitySourcePage>;
};

export type ExistingEmbeddingHashLookup = {
  /** Returns the stored sourceTextHash for an entity, or undefined if it has never been embedded. */
  get(entityId: string): Promise<string | undefined>;
};

export type BackfillOptions = {
  readonly source: CanonicalEntitySource;
  readonly provider: EmbeddingProvider;
  readonly store: VectorIndexStore;
  readonly existingHashes?: ExistingEmbeddingHashLookup;
  readonly maxItems?: number;
  readonly maxEstimatedCostUsd?: number;
  readonly force?: boolean;
  readonly dims?: number;
  readonly now?: () => string;
};

export type BackfillSummary = {
  readonly processed: number;
  readonly embedded: number;
  readonly skippedUnchanged: number;
  readonly skippedErrors: readonly { readonly entityId: string; readonly reason: string }[];
  readonly stoppedForBudget: boolean;
  readonly stoppedForMaxItems: boolean;
};

/**
 * Iterates the entity source page by page, embedding entities whose source text changed since
 * the last run (unless `force`), stopping early on the item cap or cost budget.
 */
export async function runBackfill(options: BackfillOptions): Promise<BackfillSummary> {
  validateBackfillBounds(options.maxItems, options.maxEstimatedCostUsd);
  const dims = options.dims ?? EMBEDDING_DIMS;
  const now = options.now ?? (() => new Date().toISOString());

  let processed = 0;
  let embedded = 0;
  let skippedUnchanged = 0;
  const skippedErrors: { readonly entityId: string; readonly reason: string }[] = [];
  let stoppedForBudget = false;
  let stoppedForMaxItems = false;
  let cumulativeCostUsd = 0;

  let cursor: string | undefined;
  let stopped = false;

  while (!stopped) {
    const page = await options.source.listPage(cursor);
    if (page.items.length === 0) break;

    for (const input of page.items) {
      if (stopped) break;

      if (options.maxItems !== undefined && processed >= options.maxItems) {
        stoppedForMaxItems = true;
        stopped = true;
        break;
      }

      const text = buildEntityEmbeddingText(input.entity, input.location);
      const textHash = sha256Hex(text);

      if (!options.force && options.existingHashes) {
        const existingHash = await options.existingHashes.get(input.entityId);
        if (existingHash === textHash) {
          skippedUnchanged += 1;
          processed += 1;
          continue;
        }
      }

      const projectedCost = estimateEmbeddingCostUsd(text.length);
      if (
        options.maxEstimatedCostUsd !== undefined &&
        cumulativeCostUsd + projectedCost > options.maxEstimatedCostUsd
      ) {
        stoppedForBudget = true;
        stopped = true;
        break;
      }

      processed += 1;
      // Failed or interrupted calls can still be billed; retain their estimated reservation.
      cumulativeCostUsd += projectedCost;
      try {
        const result: EntityEmbeddingResult = await embedEntity(options.provider, input, {
          dims,
          now,
        });
        await options.store.writeEmbedding({
          entityId: result.entityId,
          kind: result.filters.kind,
          ...(result.filters.state ? { state: result.filters.state } : {}),
          ...(result.filters.eraBucket ? { eraBucket: result.filters.eraBucket } : {}),
          vector: result.vector,
          dims: result.dims,
          model: result.model,
          sourceTextHash: result.sourceTextHash,
          updatedAt: result.computedAt,
        });
        embedded += 1;
      } catch (error) {
        skippedErrors.push({
          entityId: input.entityId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (stopped || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return {
    processed,
    embedded,
    skippedUnchanged,
    skippedErrors,
    stoppedForBudget,
    stoppedForMaxItems,
  };
}

function validateBackfillBounds(maxItems?: number, maxCostUsd?: number): void {
  if (maxItems !== undefined && (!Number.isSafeInteger(maxItems) || maxItems < 1))
    throw new Error('maxItems must be a positive safe integer');
  if (maxCostUsd !== undefined && (!Number.isFinite(maxCostUsd) || maxCostUsd < 0))
    throw new Error('maxCostUsd must be finite and nonnegative');
}

export function parseBackfillArgs(argv: readonly string[]): {
  maxItems?: number;
  maxCostUsd?: number;
  force: boolean;
} {
  const result: { maxItems?: number; maxCostUsd?: number; force: boolean } = { force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') result.force = true;
    else if (arg === '--max-items' || arg === '--max-cost-usd') {
      const value = argv[++index];
      if (!value?.trim()) throw new Error(`${arg} requires a value`);
      if (arg === '--max-items') result.maxItems = Number(value);
      else result.maxCostUsd = Number(value);
    } else throw new Error(`Unknown backfill argument: ${arg}`);
  }
  validateBackfillBounds(result.maxItems, result.maxCostUsd);
  if (result.maxItems === undefined || result.maxCostUsd === undefined)
    throw new Error('Backfill requires both --max-items and --max-cost-usd');
  return result;
}

async function mainCli(argv: string[]): Promise<void> {
  const args = parseBackfillArgs(argv);
  const pool = getOpsPostgresPool(process.env);
  const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<readonly T[]> => {
    const result = await pool.query<T>(sql, [...params]);
    return result.rows;
  };

  try {
    const summary = await runBackfill({
      source: createPostgresCanonicalEntitySource(query),
      provider: createGeminiEmbeddingProvider({ environment: process.env }),
      store: createPostgresVectorIndexStore(query),
      existingHashes: createPostgresExistingHashLookup(query),
      ...(args.maxItems !== undefined ? { maxItems: args.maxItems } : {}),
      ...(args.maxCostUsd !== undefined ? { maxEstimatedCostUsd: args.maxCostUsd } : {}),
      force: args.force,
    });

    console.log(
      JSON.stringify(
        {
          source: 'published.release_entities',
          ...summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void mainCli(process.argv.slice(2));
}
