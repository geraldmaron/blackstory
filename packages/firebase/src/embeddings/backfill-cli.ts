
/**
 * Budget-aware bulk (re)embedding CLI for entity corpora.
 *
 * Default live source is `publicSearchIndex` (prod often has searchable projections before
 * `canonicalEntities` is filled). Fixtures and canonical sources remain available via
 * `--source`. Run:
 * GEMINI_API_KEY=... node --conditions development --import tsx \
 * packages/firebase/src/embeddings/backfill-cli.ts --source=publicSearchIndex \
 * --max-items 500 --max-cost-usd 1
 *
 * Every dependency (entity source, provider, store) is injected so `runBackfill` itself is
 * fully unit-testable without Firestore or network access; only the `if (import.meta.url...)`
 * block at the bottom touches real infrastructure.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Firestore } from 'firebase-admin/firestore';
import { createServerFirebaseApp } from '../server.js';
import {
  createFirestorePublicSearchIndexEntitySource,
  createNationalCatalogFixtureEntitySource,
} from './backfill-sources.js';
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
import { buildEntityEmbeddingText, type EntityLocationContext } from './text.js';
import { createAdminVectorIndexStore, type VectorIndexStore } from './vector-store.js';

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
        cumulativeCostUsd += projectedCost;
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

const CANONICAL_ENTITIES_PAGE_SIZE = 200;


/**
 * Real Firestore-backed entity source. Location/state resolution is intentionally out of
 * scope here: entity documents don't carry a resolved state code directly, and joining the
 * `locations` subcollection + geocode cache per entity is a documented integration gap.
 * Backfilled vectors therefore get `kind`/`eraBucket` pre-filters but generally not `state`
 * until that join is wired in.
 */
export function createFirestoreCanonicalEntitySource(
  firestore: Firestore,
  resolveLocation?: (entityId: string) => Promise<EntityLocationContext | undefined>,
): CanonicalEntitySource {
  return {
    async listPage(cursor) {
      let query = firestore.collection('canonicalEntities').orderBy('__name__').limit(CANONICAL_ENTITIES_PAGE_SIZE);
      if (cursor) {
        query = query.startAfter(cursor);
      }
      const snapshot = await query.get();
      const items: EntityEmbeddingInput[] = [];
      for (const doc of snapshot.docs) {
        const data = doc.data() as Record<string, unknown>;
        const location = resolveLocation ? await resolveLocation(doc.id) : undefined;
        items.push({
          entityId: doc.id,
          entity: data as EntityEmbeddingInput['entity'],
          ...(location ? { location } : {}),
        });
      }
      const lastDoc = snapshot.docs.at(-1);
      return {
        items,
        ...(lastDoc && snapshot.docs.length === CANONICAL_ENTITIES_PAGE_SIZE
          ? { nextCursor: lastDoc.id }
          : {}),
      };
    },
  };
}

/** Reads existing embedding docs' sourceTextHash directly, one Firestore get per entity. */
export function createFirestoreExistingHashLookup(firestore: Firestore): ExistingEmbeddingHashLookup {
  return {
    async get(entityId) {
      const snapshot = await firestore.collection('entityEmbeddings').doc(entityId).get();
      if (!snapshot.exists) return undefined;
      const data = snapshot.data() as Record<string, unknown> | undefined;
      return typeof data?.sourceTextHash === 'string' ? data.sourceTextHash : undefined;
    },
  };
}

export type BackfillEntitySourceName = 'publicSearchIndex' | 'canonicalEntities' | 'fixtures';

const DEFAULT_FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/national-catalog',
);

function parseArgs(argv: readonly string[]): {
  maxItems?: number;
  maxCostUsd?: number;
  force: boolean;
  source: BackfillEntitySourceName;
  fixturesDir: string;
} {
  const result: {
    maxItems?: number;
    maxCostUsd?: number;
    force: boolean;
    source: BackfillEntitySourceName;
    fixturesDir: string;
  } = {
    force: false,
    source: 'publicSearchIndex',
    fixturesDir: DEFAULT_FIXTURES_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--max-items') result.maxItems = Number(argv[++index]);
    else if (arg === '--max-cost-usd') result.maxCostUsd = Number(argv[++index]);
    else if (arg === '--force') result.force = true;
    else if (arg === '--source') {
      const value = argv[++index] as BackfillEntitySourceName;
      if (value !== 'publicSearchIndex' && value !== 'canonicalEntities' && value !== 'fixtures') {
        throw new Error(
          `--source must be publicSearchIndex|canonicalEntities|fixtures (got ${String(value)})`,
        );
      }
      result.source = value;
    } else if (arg?.startsWith('--source=')) {
      const value = arg.slice('--source='.length) as BackfillEntitySourceName;
      if (value !== 'publicSearchIndex' && value !== 'canonicalEntities' && value !== 'fixtures') {
        throw new Error(
          `--source must be publicSearchIndex|canonicalEntities|fixtures (got ${String(value)})`,
        );
      }
      result.source = value;
    } else if (arg === '--fixtures-dir') result.fixturesDir = resolve(argv[++index] ?? '');
    else if (arg?.startsWith('--fixtures-dir=')) {
      result.fixturesDir = resolve(arg.slice('--fixtures-dir='.length));
    }
  }
  return result;
}

function resolveEntitySource(
  firestore: Firestore,
  args: { source: BackfillEntitySourceName; fixturesDir: string },
): CanonicalEntitySource {
  switch (args.source) {
    case 'canonicalEntities':
      return createFirestoreCanonicalEntitySource(firestore);
    case 'fixtures':
      return createNationalCatalogFixtureEntitySource(args.fixturesDir);
    case 'publicSearchIndex':
    default:
      return createFirestorePublicSearchIndexEntitySource(firestore);
  }
}

async function mainCli(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const { app } = createServerFirebaseApp(process.env);
  const { getFirestore } = await import('firebase-admin/firestore');
  const firestore = getFirestore(app);

  const summary = await runBackfill({
    source: resolveEntitySource(firestore, args),
    provider: createGeminiEmbeddingProvider({ environment: process.env }),
    store: createAdminVectorIndexStore(firestore),
    existingHashes: createFirestoreExistingHashLookup(firestore),
    ...(args.maxItems !== undefined ? { maxItems: args.maxItems } : {}),
    ...(args.maxCostUsd !== undefined ? { maxEstimatedCostUsd: args.maxCostUsd } : {}),
    force: args.force,
  });

  console.log(
    JSON.stringify(
      {
        source: args.source,
        ...(args.source === 'fixtures' ? { fixturesDir: args.fixturesDir } : {}),
        ...summary,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void mainCli(process.argv.slice(2));
}
