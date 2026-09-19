/**
 * Bounded held-out retrieval pilot against the production evidence-retrieval implementation.
 *
 * The command writes temporary public-text captures to a local Postgres database, evaluates
 * lexical and OpenRouter embedding retrieval, then removes every
 * temporary row in a finally block. It never publishes or writes canonical/release records.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getOpsPostgresPool } from '../../packages/data-access/src/index.ts';
import { persistCapture } from '../../packages/operator-cli/src/capture-backfill.ts';
import {
  attachPassageEmbedding,
  retrieveEvidence,
  type EvidenceRetrievalHit,
} from '../../packages/operator-cli/src/evidence-retrieval.ts';
import { sourceIdForUrl } from '../../packages/operator-cli/src/source-capture.ts';
import type { QueryablePool } from '../../packages/operator-cli/src/model-invocation-log.ts';
import {
  compareHybridRetrievalTopK,
  runHybridRetrievalEval,
  type HybridQueryCategory,
  type HybridRetrievalEvalResult,
  type HybridRetrievalQuerySet,
} from '../../packages/testing/src/gold-corpus/hybrid-retrieval-eval.ts';
import {
  evaluateHeldoutIdentityAndEdges,
  verifyHeldoutQualityArtifacts,
} from '../../packages/testing/src/gold-corpus/heldout-quality-eval.ts';
import { evaluateEvidencePilotReceiptBudget } from '../../packages/testing/src/gold-corpus/evidence-retrieval-cost.ts';
import { createDeterministicMockEvalProvider } from '../../packages/testing/src/gold-corpus/retrieval-embedding.ts';
import {
  createOpenRouterEvaluationEmbeddingProvider,
  type OpenRouterEmbeddingUsage,
} from './openrouter-evaluation-embedding-provider.ts';

const PROVIDER = 'openrouter';
const LOCAL_PROVIDER = 'deterministic-evaluation';
const MODEL = 'openai/text-embedding-3-small';
const LOCAL_MODEL = 'mock-deterministic-embedding';
const DIMENSIONS = 768;
const PRICE_USD_PER_MILLION_TEXT_TOKENS = 0.02;
const PRICE_SOURCE = 'https://openrouter.ai/api/v1/embeddings/models';
const PRICE_RETRIEVED_AT = '2026-09-18';
const MAX_ALLOWED_COST_USD = 0.25;
const EVALUATION_K = 5;
const MIN_HNSW_PADDING_ROWS_PER_PARTITION = 1_000;
const MAX_HNSW_PADDING_ROWS_PER_PARTITION = 25_000;

type BlindDocument = {
  readonly id: string;
  readonly title: string;
  readonly sourceUrl: string;
  readonly aliases?: readonly string[];
  readonly text: string;
};

type BlindRetrievalCase = {
  readonly id: string;
  readonly query: string;
  readonly category: string;
};

type BlindCorpus = {
  readonly version: string;
  readonly retrievedAt: string;
  readonly protocol: string;
  readonly documents: readonly BlindDocument[];
  readonly retrievalCases: readonly BlindRetrievalCase[];
};

type GoldRetrievalCase = {
  readonly id: string;
  readonly relevantDocumentIds: readonly string[];
  readonly forbiddenDocumentIds?: readonly string[];
};

type GoldCorpus = {
  readonly schemaVersion: 'heldout-research-gold.v1';
  readonly version: string;
  readonly benchmarkVersion: string;
  readonly retrievalCases: readonly GoldRetrievalCase[];
  readonly entailmentCases: readonly {
    readonly id: string;
    readonly expected: EntailmentLabel;
  }[];
};

type EntailmentLabel = 'supported' | 'contradicted' | 'insufficient';

type EntailmentPredictions = {
  readonly schemaVersion: 'heldout-entailment-predictions.v1';
  readonly benchmarkVersion: string;
  readonly predictor: string;
  readonly generatedAt: string;
  readonly predictions: readonly { readonly id: string; readonly label: EntailmentLabel }[];
};

type EmbeddingReplayCache = {
  readonly schemaVersion: 'evidence-retrieval-embedding-cache.v2';
  readonly inputSetSha256: string;
  readonly requestedModel: string;
  readonly responseModel: string;
  readonly dimensions: number;
  readonly entries: readonly {
    readonly textSha256: string;
    readonly vector: readonly number[];
  }[];
};

type IndexedPassage = {
  readonly id: string;
  readonly source_item_id: string;
  readonly body: string;
  readonly body_hash: string;
};

type TemporarySource = {
  readonly itemId: string;
  readonly captureId: string;
  readonly eventId: string;
  readonly sourceId: string;
};

type SemanticExplainMode = 'exact' | 'approximate';

type SemanticExplainPlan = {
  readonly mode: SemanticExplainMode;
  readonly statement: 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)';
  readonly hnswIndexSelected: boolean;
  readonly hnswIndexUsed: boolean;
  readonly hnswActualLoops: number;
  readonly nodeTypes: readonly string[];
  readonly indexNames: readonly string[];
  readonly plan: unknown;
};

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

const SQL_VECTOR_LITERAL = /'\[[0-9eE+.,\-\s]+\]'::(?:extensions\.)?vector/gu;

/** EXPLAIN embeds parameter values in plan strings; public artifacts retain the plan, not vectors. */
function redactPlanVectorLiterals(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(SQL_VECTOR_LITERAL, "'<redacted-vector>'::vector");
  }
  if (Array.isArray(value)) return value.map(redactPlanVectorLiterals);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      redactPlanVectorLiterals(child),
    ]),
  );
}

function planDetails(plan: unknown): {
  readonly hnswIndexSelected: boolean;
  readonly hnswIndexUsed: boolean;
  readonly hnswActualLoops: number;
  readonly nodeTypes: readonly string[];
  readonly indexNames: readonly string[];
} {
  const nodeTypes = new Set<string>();
  const indexNames = new Set<string>();
  let hnswActualLoops = 0;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record['Node Type'] === 'string') nodeTypes.add(record['Node Type']);
    if (typeof record['Index Name'] === 'string') {
      indexNames.add(record['Index Name']);
      if (record['Index Name'] === 'retrieval_passages_vector_idx') {
        hnswActualLoops += Number(record['Actual Loops'] ?? 0);
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(plan);
  const hnswIndexSelected = indexNames.has('retrieval_passages_vector_idx');
  return {
    hnswIndexSelected,
    hnswIndexUsed: hnswIndexSelected && hnswActualLoops > 0,
    hnswActualLoops,
    nodeTypes: [...nodeTypes],
    indexNames: [...indexNames],
  };
}

function controlledQueryVector(): string {
  return `[${Array.from({ length: DIMENSIONS }, (_, index) =>
    Math.sin((index + 1) * 1.41421356237),
  ).join(',')}]`;
}

function explainRecordingPool(
  pool: QueryablePool,
  plans: Map<SemanticExplainMode, SemanticExplainPlan>,
): QueryablePool {
  return {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ) {
      if (text.includes('embedding OPERATOR(extensions.<=>)')) {
        const mode: SemanticExplainMode = text.includes('WITH eligible AS MATERIALIZED')
          ? 'exact'
          : 'approximate';
        if (!plans.has(mode)) {
          const explained = await pool.query<Record<string, unknown>>(
            `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${text}`,
            values,
          );
          const plan = explained.rows[0]?.['QUERY PLAN'];
          if (!plan) throw new Error(`Postgres returned no ${mode} semantic EXPLAIN plan`);
          plans.set(mode, {
            mode,
            statement: 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)',
            ...planDetails(plan),
            plan,
          });
        }
      }
      return pool.query<Row>(text, values);
    },
  };
}

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function requiredOption(args: readonly string[], name: string): string {
  const value = option(args, name);
  if (!value || value.startsWith('--')) throw new Error(`Missing required option ${name}`);
  return value;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readEmbeddingReplayCache(
  path: string,
  inputs: readonly string[],
): { readonly cache: EmbeddingReplayCache; readonly vectors: readonly (readonly number[])[] } {
  const cache = readJson<EmbeddingReplayCache>(path);
  const inputHashes = inputs.map(hash);
  if (new Set(inputHashes).size !== inputHashes.length)
    throw new Error('Embedding replay cache requires distinct frozen input text');
  const inputSetSha256 = hash(JSON.stringify([...inputHashes].sort()));
  if (
    cache.schemaVersion !== 'evidence-retrieval-embedding-cache.v2' ||
    cache.inputSetSha256 !== inputSetSha256 ||
    cache.requestedModel !== MODEL ||
    cache.responseModel !== 'text-embedding-3-small' ||
    cache.dimensions !== DIMENSIONS ||
    !Array.isArray(cache.entries) ||
    cache.entries.length !== inputs.length ||
    cache.entries.some(
      ({ textSha256, vector }) =>
        !/^[a-f0-9]{64}$/u.test(textSha256) ||
        !Array.isArray(vector) ||
        vector.length !== DIMENSIONS ||
        vector.some((value) => !Number.isFinite(value)) ||
        !vector.some((value) => value !== 0),
    )
  ) {
    throw new Error('Embedding replay cache does not match the frozen inputs and model contract');
  }
  const vectorsByTextHash = new Map(cache.entries.map((entry) => [entry.textSha256, entry.vector]));
  if (vectorsByTextHash.size !== cache.entries.length)
    throw new Error('Embedding replay cache requires distinct text hashes');
  const vectors = inputHashes.map((textSha256) => vectorsByTextHash.get(textSha256));
  if (vectors.some((vector) => !vector))
    throw new Error('Embedding replay cache does not cover every frozen input');
  return { cache, vectors: vectors as readonly (readonly number[])[] };
}

function readGold(path: string): GoldCorpus {
  return readJson<GoldCorpus>(path);
}

function optionalQualityEvaluation(args: readonly string[]): Record<string, unknown> {
  const casesPath = option(args, '--quality-cases');
  const predictionsPath = option(args, '--quality-predictions');
  const goldPath = option(args, '--quality-gold');
  const manifestPath = option(args, '--quality-freeze-manifest');
  if (!casesPath && !predictionsPath && !goldPath && !manifestPath) {
    return { status: 'not_run', reason: 'No held-out identity/edge artifacts were supplied.' };
  }
  if (!casesPath || !predictionsPath || !goldPath || !manifestPath) {
    throw new Error(
      '--quality-cases, --quality-predictions, --quality-gold, and --quality-freeze-manifest must be supplied together',
    );
  }
  const verified = verifyHeldoutQualityArtifacts({
    casesRaw: readFileSync(casesPath, 'utf8'),
    predictionsRaw: readFileSync(predictionsPath, 'utf8'),
    goldRaw: readFileSync(goldPath, 'utf8'),
    manifest: readJson<unknown>(manifestPath),
  });
  return {
    ...evaluateHeldoutIdentityAndEdges(verified),
    integrity: verified.integrity,
  };
}

async function persistTemporarySource(
  pool: Parameters<typeof persistCapture>[0] & QueryablePool,
  input: {
    readonly prefix: string;
    readonly documentId: string;
    readonly publicSourceUrl: string;
    readonly text: string;
    readonly capturedAt: string;
    readonly reviewedBy: string;
  },
): Promise<TemporarySource> {
  const evaluationUrl = `https://${input.prefix}.example/${encodeURIComponent(input.documentId)}`;
  const source = sourceIdForUrl(evaluationUrl);
  if (!source) throw new Error(`Could not derive evaluation source for ${input.documentId}`);
  const itemId = `src_item_${hash(evaluationUrl)}`;
  const captureId = `${input.prefix}-${input.documentId}`;
  const eventId = `${input.prefix}-event-${input.documentId}`;
  const decision = {
    sourceUrl: evaluationUrl,
    allowTextRetention: true,
    allowArchive: false,
    sensitivity: 'public' as const,
    reviewedBy: input.reviewedBy,
    reviewedAt: new Date().toISOString(),
    expiresAt: '2099-01-01T00:00:00.000Z',
    basis: `Temporary local evaluation of public text from ${input.publicSourceUrl}`,
  };
  await persistCapture(
    pool,
    {
      id: captureId,
      sourceItemId: null,
      contentHashAlgorithm: 'sha256',
      contentHashDigest: hash(`${input.prefix}|${input.text}`),
      parserVersion: 'heldout-public-text-v1',
      snapshotMode: 'selective',
      dedupOfCaptureId: null,
      capturedAt: input.capturedAt,
      extractedText: input.text,
      storageObject: {
        stored: 'inline-evaluation',
        sourceUrl: evaluationUrl,
        evaluationSourceUrl: input.publicSourceUrl,
        preservationDecision: decision,
        extractedTextHash: hash(input.text),
      },
    },
    {
      id: eventId,
      sourceId: source.id,
      adapterId: input.reviewedBy,
      status: 'success',
      httpStatus: 200,
      detail: {
        url: evaluationUrl,
        finalUrl: evaluationUrl,
        publicSourceUrl: input.publicSourceUrl,
      },
      occurredAt: input.capturedAt,
    },
  );
  return { itemId, captureId, eventId, sourceId: source.id };
}

async function insertControlledHnswPadding(
  pool: QueryablePool,
  input: {
    readonly captureId: string;
    readonly sourceItemId: string;
    readonly partition: 'included' | 'excluded';
    readonly rowCount: number;
    readonly embeddingModel: string;
  },
): Promise<void> {
  await pool.query('DELETE FROM evidence.retrieval_passages WHERE source_item_id=$1', [
    input.sourceItemId,
  ]);
  await pool.query(
    `INSERT INTO evidence.retrieval_passages(
       id,capture_id,source_item_id,parser_version,document_text_hash,ordinal,start_offset,end_offset,
       body,body_hash,retention_decision,retention_expires_at,embedding,embedding_model,embedding_text_hash
     )
     SELECT
       $1 || '-passage-' || row_number,$2,$3,'controlled-hnsw-padding-v1',md5($1),row_number-1,0,
       char_length(body),body,md5($1 || ':' || row_number),
       jsonb_build_object('evaluationOnly',true,'partition',$4::text),
       '2099-01-01T00:00:00.000Z'::timestamptz,
       ('[' || array_to_string(ARRAY(
         SELECT sin(row_number * 0.61803398875 + dimension * 1.41421356237)::text
         FROM generate_series(1,768) dimension
       ),',') || ']')::extensions.vector,
       $5,md5($1 || ':' || row_number)
     FROM generate_series(1,$6) row_number
     CROSS JOIN LATERAL (SELECT $7::text || ' ' || row_number AS body) text_value`,
    [
      `${input.captureId}-${input.partition}`,
      input.captureId,
      input.sourceItemId,
      input.partition,
      input.embeddingModel,
      input.rowCount,
      `controlled ${input.partition} HNSW padding`,
    ],
  );
}

function category(value: string): HybridQueryCategory {
  switch (value) {
    case 'exact_name':
      return 'name_lookup';
    case 'semantic':
      return 'descriptive';
    case 'alias':
    case 'ocr':
    case 'missed_entity':
    case 'relationship':
    case 'path':
      return value;
    default:
      throw new Error(`Unsupported held-out retrieval category: ${value}`);
  }
}

function validateInput(blind: BlindCorpus, gold: GoldCorpus): void {
  if (
    !blind.version.trim() ||
    !gold.version.trim() ||
    gold.schemaVersion !== 'heldout-research-gold.v1'
  )
    throw new Error('Corpus versions are required');
  if (gold.benchmarkVersion !== blind.version)
    throw new Error('Gold labels do not identify the supplied blind benchmark');
  if (!blind.documents.length || !blind.retrievalCases.length)
    throw new Error('Held-out corpus requires documents and retrieval cases');
  const documentIds = new Set(blind.documents.map((document) => document.id));
  if (documentIds.size !== blind.documents.length)
    throw new Error('Held-out document identifiers must be distinct');
  for (const document of blind.documents) {
    if (!document.id.trim() || !document.title.trim() || !document.text.trim())
      throw new Error('Every held-out document requires id, title, and text');
    const source = new URL(document.sourceUrl);
    if (source.protocol !== 'https:' && source.protocol !== 'http:')
      throw new Error(`Document ${document.id} requires a public HTTP source URL`);
  }
  const queries = new Map(blind.retrievalCases.map((query) => [query.id, query]));
  const judgments = new Map(gold.retrievalCases.map((query) => [query.id, query]));
  if (queries.size !== blind.retrievalCases.length || judgments.size !== gold.retrievalCases.length)
    throw new Error('Held-out query and judgment identifiers must be distinct');
  if (queries.size !== judgments.size || [...queries.keys()].some((id) => !judgments.has(id)))
    throw new Error('Blind queries and gold retrieval judgments must have identical identifiers');
  for (const query of blind.retrievalCases) {
    if (!query.query.trim()) throw new Error(`Query ${query.id} is empty`);
    category(query.category);
    const judgment = judgments.get(query.id)!;
    if (!judgment.relevantDocumentIds.length)
      throw new Error(`Query ${query.id} requires at least one relevant document`);
    const allLabels = [...judgment.relevantDocumentIds, ...(judgment.forbiddenDocumentIds ?? [])];
    if (allLabels.some((id) => !documentIds.has(id)))
      throw new Error(`Query ${query.id} labels an unknown document`);
    if (
      new Set(judgment.relevantDocumentIds).size !== judgment.relevantDocumentIds.length ||
      new Set(judgment.forbiddenDocumentIds ?? []).size !==
        (judgment.forbiddenDocumentIds ?? []).length ||
      (judgment.forbiddenDocumentIds ?? []).some((id) => judgment.relevantDocumentIds.includes(id))
    )
      throw new Error(`Query ${query.id} has duplicated or contradictory relevance labels`);
  }
}

function evaluateEntailment(
  blind: BlindCorpus & { readonly entailmentCases?: readonly { readonly id: string }[] },
  gold: GoldCorpus,
  predictions: EntailmentPredictions,
): Record<string, unknown> {
  if (
    predictions.schemaVersion !== 'heldout-entailment-predictions.v1' ||
    predictions.benchmarkVersion !== blind.version ||
    !predictions.predictor.trim()
  )
    throw new Error('Entailment predictions do not identify this benchmark and predictor');
  const blindIds = new Set((blind.entailmentCases ?? []).map((item) => item.id));
  const goldById = new Map(gold.entailmentCases.map((item) => [item.id, item.expected]));
  const predictionById = new Map(predictions.predictions.map((item) => [item.id, item.label]));
  if (
    blindIds.size === 0 ||
    blindIds.size !== blind.entailmentCases?.length ||
    goldById.size !== gold.entailmentCases.length ||
    predictionById.size !== predictions.predictions.length ||
    blindIds.size !== goldById.size ||
    blindIds.size !== predictionById.size ||
    [...blindIds].some((id) => !goldById.has(id) || !predictionById.has(id))
  )
    throw new Error('Blind, gold, and predicted entailment case identifiers must match exactly');
  const labels: readonly EntailmentLabel[] = ['supported', 'contradicted', 'insufficient'];
  if (
    predictions.predictions.some((item) => !labels.includes(item.label)) ||
    gold.entailmentCases.some((item) => !labels.includes(item.expected))
  )
    throw new Error('Entailment predictions or gold judgments contain an unsupported label');
  const confusion = Object.fromEntries(
    labels.map((expected) => [
      expected,
      Object.fromEntries(labels.map((predicted) => [predicted, 0])),
    ]),
  ) as Record<EntailmentLabel, Record<EntailmentLabel, number>>;
  let correct = 0;
  let falseSupport = 0;
  let negativeCases = 0;
  const perCase = [...blindIds].map((id) => {
    const expected = goldById.get(id)!;
    const predicted = predictionById.get(id)!;
    confusion[expected][predicted] += 1;
    if (expected === predicted) correct += 1;
    if (expected !== 'supported') {
      negativeCases += 1;
      if (predicted === 'supported') falseSupport += 1;
    }
    return { id, expected, predicted, correct: expected === predicted };
  });
  return {
    predictor: predictions.predictor,
    generatedAt: predictions.generatedAt,
    labelStatus:
      'Curated provisional labels from an independent corpus author; no consensus or human adjudication.',
    caseCount: blindIds.size,
    exactAccuracy: correct / blindIds.size,
    falseSupportRate: falseSupport / Math.max(1, negativeCases),
    confusion,
    perCase,
    probabilityCalibration: {
      status: 'unavailable',
      probabilityClaimSupported: false,
      reason: 'The predictor emitted categorical labels and no probabilities.',
    },
  };
}

function querySet(blind: BlindCorpus, gold: GoldCorpus): HybridRetrievalQuerySet {
  const judgments = new Map(gold.retrievalCases.map((query) => [query.id, query]));
  return {
    schemaVersion: 'hybrid-retrieval-queries.v1',
    querySetVersion: `${blind.version}:${gold.version}`,
    description: blind.protocol,
    queries: blind.retrievalCases.map((query) => {
      const judgment = judgments.get(query.id)!;
      return {
        id: query.id,
        text: query.query,
        category: category(query.category),
        relevantEntityIds: judgment.relevantDocumentIds,
        ...(judgment.forbiddenDocumentIds
          ? { forbiddenResultIds: judgment.forbiddenDocumentIds }
          : {}),
      };
    }),
  };
}

function uniqueDocumentIds(
  hits: readonly EvidenceRetrievalHit[],
  documentIdBySourceItemId: ReadonlyMap<string, string>,
): readonly string[] {
  return [
    ...new Set(
      hits.flatMap((hit) => {
        const id = documentIdBySourceItemId.get(hit.sourceItemId);
        return id ? [id] : [];
      }),
    ),
  ];
}

async function evaluateMode(
  set: HybridRetrievalQuerySet,
  run: (queryId: string, query: string) => Promise<readonly string[]>,
): Promise<HybridRetrievalEvalResult> {
  const idByNormalizedQuery = new Map(
    set.queries.map((query) => [query.text.trim().toLowerCase(), query.id]),
  );
  return runHybridRetrievalEval(
    set,
    async ({ normalizedQuery }) => {
      const queryId = idByNormalizedQuery.get(normalizedQuery);
      if (!queryId) throw new Error(`No held-out query id for ${normalizedQuery}`);
      return run(queryId, normalizedQuery);
    },
    {
      k: EVALUATION_K,
      thresholds: {
        minimumPrecisionAt5: 0,
        minimumRecallAt5: 0,
        minimumMeanReciprocalRank: 0,
      },
      fusionWeightsVersion: 'production-evidence-rrf-v1',
    },
  );
}

/** Measurement runs have no calibrated admission threshold and cannot award a quality pass. */
function measuredMetrics(result: HybridRetrievalEvalResult | null) {
  if (!result) return null;
  return {
    ...result,
    passed: undefined,
    failures: undefined,
    qualityAdmission: 'not_evaluated',
  };
}

async function cleanupTemporaryEvaluation(
  pool: ReturnType<typeof getOpsPostgresPool>,
  itemIds: readonly string[],
  captureIds: readonly string[],
  eventIds: readonly string[],
  sourceIds: readonly string[],
) {
  const deletedPassages = await pool.query(
    'DELETE FROM evidence.retrieval_passages WHERE source_item_id=ANY($1)',
    [itemIds],
  );
  const deletedOrigins = await pool.query(
    'DELETE FROM evidence.capture_origins WHERE source_item_id=ANY($1)',
    [itemIds],
  );
  const deletedCaptures = await pool.query(
    'DELETE FROM evidence.source_captures WHERE id=ANY($1)',
    [captureIds],
  );
  const deletedEvents = await pool.query('DELETE FROM evidence.retrieval_events WHERE id=ANY($1)', [
    eventIds,
  ]);
  const deletedItems = await pool.query('DELETE FROM evidence.source_items WHERE id=ANY($1)', [
    itemIds,
  ]);
  const deletedSources = await pool.query(
    'DELETE FROM evidence.evidence_sources WHERE id=ANY($1) AND NOT EXISTS (SELECT 1 FROM evidence.source_items item WHERE item.source_id=evidence.evidence_sources.id)',
    [sourceIds],
  );
  // Remove synthetic rows from planner statistics as well as from the table.
  await pool.query('ANALYZE evidence.retrieval_passages');
  const remaining = await pool.query<{
    remaining_passages: number;
    remaining_origins: number;
    remaining_captures: number;
    remaining_events: number;
    remaining_items: number;
    remaining_sources: number;
  }>(
    `SELECT
       (SELECT count(*)::int FROM evidence.retrieval_passages WHERE source_item_id=ANY($1)) AS remaining_passages,
       (SELECT count(*)::int FROM evidence.capture_origins WHERE source_item_id=ANY($1)) AS remaining_origins,
       (SELECT count(*)::int FROM evidence.source_captures WHERE id=ANY($2)) AS remaining_captures,
       (SELECT count(*)::int FROM evidence.retrieval_events WHERE id=ANY($3)) AS remaining_events,
       (SELECT count(*)::int FROM evidence.source_items WHERE id=ANY($1)) AS remaining_items,
       (SELECT count(*)::int FROM evidence.evidence_sources WHERE id=ANY($4)) AS remaining_sources`,
    [itemIds, captureIds, eventIds, sourceIds],
  );
  const remainingRows = remaining.rows[0];
  if (!remainingRows) throw new Error('Cleanup verification returned no row');
  const remainingTotal = Object.values(remainingRows).reduce((total, count) => total + count, 0);
  const cleanup = {
    status: remainingTotal === 0 ? 'completed' : 'failed_rows_remain',
    plannerStatisticsRefreshed: true,
    deletedRows: {
      retrievalPassages: deletedPassages.rowCount ?? 0,
      captureOrigins: deletedOrigins.rowCount ?? 0,
      sourceCaptures: deletedCaptures.rowCount ?? 0,
      retrievalEvents: deletedEvents.rowCount ?? 0,
      sourceItems: deletedItems.rowCount ?? 0,
      evidenceSources: deletedSources.rowCount ?? 0,
    },
    remainingRows: {
      retrievalPassages: remainingRows.remaining_passages,
      captureOrigins: remainingRows.remaining_origins,
      sourceCaptures: remainingRows.remaining_captures,
      retrievalEvents: remainingRows.remaining_events,
      sourceItems: remainingRows.remaining_items,
      evidenceSources: remainingRows.remaining_sources,
    },
  };
  if (remainingTotal !== 0) {
    throw new Error(`Retrieval pilot cleanup left ${remainingTotal} temporary rows`);
  }
  return cleanup;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const blindPath = requiredOption(args, '--blind');
  const goldPath = requiredOption(args, '--gold');
  const entailmentPredictionsPath = option(args, '--entailment-predictions');
  const qualityCasesPath = option(args, '--quality-cases');
  const qualityPredictionsPath = option(args, '--quality-predictions');
  const qualityGoldPath = option(args, '--quality-gold');
  const qualityFreezeManifestPath = option(args, '--quality-freeze-manifest');
  const embeddingCacheInPath = option(args, '--embedding-cache-in');
  const embeddingCacheOutPath = option(args, '--embedding-cache-out');
  const outPath = option(args, '--out');
  if (outPath && existsSync(outPath)) throw new Error('The evaluation output path already exists');
  if (embeddingCacheOutPath && existsSync(embeddingCacheOutPath))
    throw new Error('The embedding cache output path already exists');
  if (embeddingCacheInPath && embeddingCacheOutPath)
    throw new Error('Use either --embedding-cache-in or --embedding-cache-out, not both');
  const embeddingProvider = requiredOption(args, '--embedding-provider');
  const embeddingModel = requiredOption(args, '--embedding-model');
  const maxCostUsd = Number(requiredOption(args, '--max-cost-usd'));
  const priorReservedCostUsd = Number(option(args, '--prior-reserved-cost-usd') ?? '0');
  const priorProviderCalls = Number(option(args, '--prior-provider-calls') ?? '0');
  const hnswPaddingRowsPerPartition = Number(
    requiredOption(args, '--hnsw-padding-rows-per-partition'),
  );
  if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > MAX_ALLOWED_COST_USD)
    throw new Error(`--max-cost-usd must be greater than zero and at most ${MAX_ALLOWED_COST_USD}`);
  if (!Number.isFinite(priorReservedCostUsd) || priorReservedCostUsd < 0)
    throw new Error('--prior-reserved-cost-usd must be a finite nonnegative number');
  if (!Number.isSafeInteger(priorProviderCalls) || priorProviderCalls < 0)
    throw new Error('--prior-provider-calls must be a nonnegative integer');
  if (
    !Number.isSafeInteger(hnswPaddingRowsPerPartition) ||
    hnswPaddingRowsPerPartition < MIN_HNSW_PADDING_ROWS_PER_PARTITION ||
    hnswPaddingRowsPerPartition > MAX_HNSW_PADDING_ROWS_PER_PARTITION
  )
    throw new Error(
      `--hnsw-padding-rows-per-partition must be an integer from ${MIN_HNSW_PADDING_ROWS_PER_PARTITION} to ${MAX_HNSW_PADDING_ROWS_PER_PARTITION}`,
    );
  if (priorReservedCostUsd > maxCostUsd)
    throw new Error('Prior embedding reservation already exceeds the total cost cap');
  if (![PROVIDER, LOCAL_PROVIDER].includes(embeddingProvider))
    throw new Error(`--embedding-provider must be ${PROVIDER} or ${LOCAL_PROVIDER}`);
  if ((embeddingCacheInPath || embeddingCacheOutPath) && embeddingProvider !== PROVIDER)
    throw new Error('Embedding cache input and output are available only with OpenRouter');
  if (
    (embeddingProvider === PROVIDER && embeddingModel !== MODEL) ||
    (embeddingProvider === LOCAL_PROVIDER && embeddingModel !== LOCAL_MODEL)
  )
    throw new Error(
      `--embedding-model must match the selected provider (${MODEL} or ${LOCAL_MODEL})`,
    );
  const connectionString = process.env.RESEARCH_TEST_DATABASE_URL;
  if (!connectionString) throw new Error('RESEARCH_TEST_DATABASE_URL is required');
  const databaseUrl = new URL(connectionString);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname))
    throw new Error('The retrieval pilot only runs against a local database');

  const blind = readJson<BlindCorpus>(blindPath);
  const gold = readGold(goldPath);
  const entailmentPredictions = entailmentPredictionsPath
    ? readJson<EntailmentPredictions>(entailmentPredictionsPath)
    : null;
  validateInput(blind, gold);
  const set = querySet(blind, gold);
  const entailment = entailmentPredictions
    ? evaluateEntailment(blind, gold, entailmentPredictions)
    : {
        status: 'not_run',
        reason: 'No independently frozen --entailment-predictions artifact was supplied.',
      };
  const heldoutQuality = optionalQualityEvaluation(args);
  const excludedPaddingRows = Math.max(100, Math.ceil(hnswPaddingRowsPerPartition / 10));

  const prefix = `retrieval-pilot-${randomUUID()}`;
  const deterministicPaddingModel = `${LOCAL_MODEL}:hnsw-padding:${prefix}`;
  const semanticEmbeddingModel =
    embeddingProvider === LOCAL_PROVIDER
      ? deterministicPaddingModel
      : `${embeddingModel}:heldout:${prefix}`;
  const pool = getOpsPostgresPool({ DATABASE_URL: connectionString });
  const semanticPlans = new Map<SemanticExplainMode, SemanticExplainPlan>();
  const retrievalPool = explainRecordingPool(pool, semanticPlans);
  const itemIds: string[] = [];
  const captureIds: string[] = [];
  const eventIds: string[] = [];
  const sourceIds: string[] = [];
  const documentIdBySourceItemId = new Map<string, string>();
  let output: Record<string, unknown> | undefined;
  let budgetGateFailed = false;
  const failures: unknown[] = [];
  try {
    for (const document of blind.documents) {
      const temporary = await persistTemporarySource(pool, {
        prefix,
        documentId: document.id,
        publicSourceUrl: document.sourceUrl,
        text: document.text,
        capturedAt: blind.retrievedAt,
        reviewedBy: 'heldout-retrieval-pilot',
      });
      itemIds.push(temporary.itemId);
      captureIds.push(temporary.captureId);
      eventIds.push(temporary.eventId);
      sourceIds.push(temporary.sourceId);
      documentIdBySourceItemId.set(temporary.itemId, document.id);
    }
    const documentItemIds = [...itemIds];

    const lexical = await evaluateMode(set, async (_queryId, query) => {
      const result = await retrieveEvidence(retrievalPool, {
        query,
        limit: EVALUATION_K,
        sourceItemIds: documentItemIds,
      });
      return uniqueDocumentIds(result.hits, documentIdBySourceItemId);
    });

    let exact: HybridRetrievalEvalResult | null = null;
    let approximate: HybridRetrievalEvalResult | null = null;
    let comparison: ReturnType<typeof compareHybridRetrievalTopK> | null = null;
    const passages = (
      await pool.query<IndexedPassage>(
        `SELECT id,source_item_id,body,body_hash FROM evidence.retrieval_passages
           WHERE source_item_id=ANY($1::text[]) ORDER BY source_item_id,ordinal`,
        [documentItemIds],
      )
    ).rows;
    const paddingSources: TemporarySource[] = [];
    for (const partition of ['included', 'excluded'] as const) {
      const source = await persistTemporarySource(pool, {
        prefix,
        documentId: `hnsw-padding-${partition}`,
        publicSourceUrl: 'https://example.invalid/controlled-hnsw-padding',
        text: `Controlled ${partition} HNSW padding seed.`,
        capturedAt: blind.retrievedAt,
        reviewedBy: 'controlled-hnsw-index-mechanics',
      });
      itemIds.push(source.itemId);
      captureIds.push(source.captureId);
      eventIds.push(source.eventId);
      sourceIds.push(source.sourceId);
      paddingSources.push(source);
    }
    const includedPaddingSource = paddingSources[0]!;
    const excludedPaddingSource = paddingSources[1]!;
    await insertControlledHnswPadding(pool, {
      captureId: includedPaddingSource.captureId,
      sourceItemId: includedPaddingSource.itemId,
      partition: 'included',
      rowCount: hnswPaddingRowsPerPartition,
      embeddingModel: deterministicPaddingModel,
    });
    await insertControlledHnswPadding(pool, {
      captureId: excludedPaddingSource.captureId,
      sourceItemId: excludedPaddingSource.itemId,
      partition: 'excluded',
      rowCount: excludedPaddingRows,
      embeddingModel: `${deterministicPaddingModel}:excluded`,
    });
    await pool.query('ANALYZE evidence.retrieval_passages');
    const preflightExplain = await pool.query<Record<string, unknown>>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       WITH approximate_candidates AS MATERIALIZED (
         SELECT id,embedding OPERATOR(extensions.<=>) $1::extensions.vector AS distance
         FROM evidence.retrieval_passages
         WHERE withdrawn_at IS NULL AND retention_expires_at>clock_timestamp()
           AND ($2::text[] IS NULL OR source_item_id=ANY($2))
           AND embedding_model=$4 AND embedding_text_hash=body_hash
         ORDER BY embedding OPERATOR(extensions.<=>) $1::extensions.vector LIMIT $3
       ) SELECT id FROM approximate_candidates ORDER BY distance,id`,
      [controlledQueryVector(), null, EVALUATION_K * 4, deterministicPaddingModel],
    );
    const preflightPlan = preflightExplain.rows[0]?.['QUERY PLAN'];
    if (!preflightPlan) throw new Error('Postgres returned no controlled HNSW preflight plan');
    const naturalPreflightPlanDetails = planDetails(preflightPlan);
    const forcedClient = await pool.connect();
    let forcedPreflightPlan: unknown;
    try {
      await forcedClient.query('BEGIN');
      await forcedClient.query('SET LOCAL enable_seqscan=off');
      await forcedClient.query('SET LOCAL enable_bitmapscan=off');
      const forcedExplain = await forcedClient.query<Record<string, unknown>>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         WITH approximate_candidates AS MATERIALIZED (
           SELECT id,embedding OPERATOR(extensions.<=>) $1::extensions.vector AS distance
           FROM evidence.retrieval_passages
           WHERE withdrawn_at IS NULL AND retention_expires_at>clock_timestamp()
             AND ($2::text[] IS NULL OR source_item_id=ANY($2))
             AND embedding_model=$4 AND embedding_text_hash=body_hash
           ORDER BY embedding OPERATOR(extensions.<=>) $1::extensions.vector LIMIT $3
         ) SELECT id FROM approximate_candidates ORDER BY distance,id`,
        [controlledQueryVector(), null, EVALUATION_K * 4, deterministicPaddingModel],
      );
      forcedPreflightPlan = forcedExplain.rows[0]?.['QUERY PLAN'];
    } finally {
      await forcedClient.query('ROLLBACK').catch(() => undefined);
      forcedClient.release();
    }
    if (!forcedPreflightPlan)
      throw new Error('Postgres returned no forced controlled HNSW preflight plan');
    const forcedPreflightPlanDetails = planDetails(forcedPreflightPlan);
    if (!forcedPreflightPlanDetails.hnswIndexUsed) {
      throw new Error(
        `Controlled forced HNSW preflight did not execute retrieval_passages_vector_idx; nodes=${forcedPreflightPlanDetails.nodeTypes.join(',')} indexes=${forcedPreflightPlanDetails.indexNames.join(',')}`,
      );
    }
    const queryTexts = blind.retrievalCases.map((query) => query.query);
    const inputs = [...passages.map((passage) => passage.body), ...queryTexts];
    const embeddingInputSetSha256 = hash(JSON.stringify(inputs.map(hash).sort()));
    // The UTF-8 byte count supplies a conservative pre-call expected-rate estimate at the listed
    // text-token price. It does not cap or predict the provider's authoritative receipt.
    const inputUtf8Bytes = inputs.reduce(
      (total, input) => total + Buffer.byteLength(input, 'utf8'),
      0,
    );
    const expectedRateEstimateTokens =
      embeddingProvider === PROVIDER && !embeddingCacheInPath ? inputUtf8Bytes : 0;
    const currentRunExpectedRateEstimateUsd =
      embeddingProvider === PROVIDER
        ? (expectedRateEstimateTokens / 1_000_000) * PRICE_USD_PER_MILLION_TEXT_TOKENS
        : 0;
    const cumulativePreCallBudgetedCostUsd =
      priorReservedCostUsd + currentRunExpectedRateEstimateUsd;
    if (cumulativePreCallBudgetedCostUsd > maxCostUsd)
      throw new Error(
        `Cumulative pre-call expected-rate estimate $${cumulativePreCallBudgetedCostUsd.toFixed(6)} exceeds budget $${maxCostUsd.toFixed(6)}`,
      );

    const providerUsage: { value: OpenRouterEmbeddingUsage | null } = { value: null };
    const replayCache = embeddingCacheInPath
      ? readEmbeddingReplayCache(embeddingCacheInPath, inputs)
      : null;
    const provider = replayCache
      ? null
      : embeddingProvider === PROVIDER
        ? createOpenRouterEvaluationEmbeddingProvider({
            apiKey:
              process.env.OPENROUTER_API_KEY?.trim() ||
              (() => {
                throw new Error('OPENROUTER_API_KEY is required after HNSW preflight');
              })(),
            model: embeddingModel,
            dimensions: DIMENSIONS,
            onUsage: (usage) => {
              providerUsage.value = usage;
            },
          })
        : createDeterministicMockEvalProvider(DIMENSIONS);
    const vectors = replayCache ? replayCache.vectors : await provider!.embed(inputs);
    if (embeddingCacheOutPath) {
      if (embeddingProvider !== PROVIDER || !providerUsage.value)
        throw new Error('Embedding cache output requires a completed OpenRouter response');
      const cache: EmbeddingReplayCache = {
        schemaVersion: 'evidence-retrieval-embedding-cache.v2',
        inputSetSha256: embeddingInputSetSha256,
        requestedModel: MODEL,
        responseModel: providerUsage.value.responseModel,
        dimensions: DIMENSIONS,
        entries: inputs.map((input, index) => ({
          textSha256: hash(input),
          vector: vectors[index]!,
        })),
      };
      writeFileSync(embeddingCacheOutPath, `${JSON.stringify(cache)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
    }
    const providerReportedCostUsd = providerUsage.value?.costUsd ?? null;
    const budgetGate = evaluateEvidencePilotReceiptBudget({
      priorReservedCostUsd,
      providerReportedCostUsd,
      totalCostCapUsd: maxCostUsd,
    });
    budgetGateFailed = !budgetGate.passed;
    for (let index = 0; index < passages.length; index += 1) {
      const passage = passages[index]!;
      await attachPassageEmbedding(pool, {
        passageId: passage.id,
        bodyHash: passage.body_hash,
        model: semanticEmbeddingModel,
        vector: vectors[index]!,
      });
    }
    const queryVectorById = new Map(
      blind.retrievalCases.map((query, index) => [query.id, vectors[passages.length + index]!]),
    );
    const semanticSourceItemIds =
      embeddingProvider === LOCAL_PROVIDER
        ? [...documentItemIds, includedPaddingSource.itemId]
        : documentItemIds;
    const forcedEvaluationClient = await pool.connect();
    try {
      await forcedEvaluationClient.query('BEGIN');
      await forcedEvaluationClient.query('SET LOCAL enable_seqscan=off');
      await forcedEvaluationClient.query('SET LOCAL enable_bitmapscan=off');
      const forcedRetrievalPool = explainRecordingPool(forcedEvaluationClient, semanticPlans);
      const runVectorMode = (approximateMode: boolean) =>
        evaluateMode(set, async (queryId, query) => {
          const result = await retrieveEvidence(forcedRetrievalPool, {
            query,
            limit: EVALUATION_K,
            sourceItemIds: semanticSourceItemIds,
            vector: { model: semanticEmbeddingModel, values: queryVectorById.get(queryId)! },
            approximate: approximateMode,
          });
          return uniqueDocumentIds(result.hits, documentIdBySourceItemId);
        });
      exact = await runVectorMode(false);
      approximate = await runVectorMode(true);
    } finally {
      await forcedEvaluationClient.query('ROLLBACK').catch(() => undefined);
      forcedEvaluationClient.release();
    }
    comparison = compareHybridRetrievalTopK(exact, approximate);
    const embedding: Record<string, unknown> = {
      status: budgetGateFailed ? `failed_${budgetGate.failureReason}` : 'completed',
      provider: embeddingProvider,
      requestedModel: embeddingModel,
      responseModel:
        embeddingProvider === PROVIDER
          ? (replayCache?.cache.responseModel ?? providerUsage.value?.responseModel ?? null)
          : LOCAL_MODEL,
      dimensions: DIMENSIONS,
      providerCalls: embeddingProvider === PROVIDER && !replayCache ? 1 : 0,
      priorProviderCalls,
      totalProviderCalls:
        priorProviderCalls + (embeddingProvider === PROVIDER && !replayCache ? 1 : 0),
      embeddedPassageCount: passages.length,
      embeddedQueryCount: queryTexts.length,
      inputUtf8Bytes,
      expectedRateEstimateTokens,
      currentRunExpectedRateEstimateUsd,
      priorRunReservedCostUsd: priorReservedCostUsd,
      cumulativePreCallBudgetedCostUsd,
      preCallEstimateLimitation:
        'UTF-8 bytes priced at the listed text-token rate are a pre-call expected-rate budget estimate, not an external billing cap. The provider receipt is authoritative when available.',
      totalCostCapUsd: maxCostUsd,
      providerReportedPromptTokens: providerUsage.value?.promptTokens ?? null,
      providerReportedTotalTokens: providerUsage.value?.totalTokens ?? null,
      providerReportedCostUsd,
      embeddingReplay: replayCache
        ? { status: 'replayed', inputSetSha256: embeddingInputSetSha256 }
        : embeddingCacheOutPath
          ? { status: 'cached_private_local', inputSetSha256: embeddingInputSetSha256 }
          : { status: 'not_retained', inputSetSha256: embeddingInputSetSha256 },
      budgetGate,
      accountingLimitation: replayCache
        ? 'Private replay cache matched the frozen input hash and model contract; no provider call or new charge occurred.'
        : embeddingProvider === LOCAL_PROVIDER
          ? 'Local deterministic evaluation provider made no network call and incurred no provider charge.'
          : providerUsage.value?.costUsd === null
            ? 'OpenRouter did not return usage.cost; actual provider charge is unknown.'
            : 'OpenRouter usage.cost is a provider-reported USD-denominated credit charge.',
      priceUsdPerMillionTextTokens:
        embeddingProvider === PROVIDER ? PRICE_USD_PER_MILLION_TEXT_TOKENS : null,
      priceSource: embeddingProvider === PROVIDER ? PRICE_SOURCE : null,
      priceRetrievedAt: embeddingProvider === PROVIDER ? PRICE_RETRIEVED_AT : null,
    };

    output = {
      schemaVersion: 'evidence-retrieval-pilot.v1',
      benchmarkVersion: `${blind.version}:${gold.version}`,
      evaluatedAt: new Date().toISOString(),
      inputProvenance: {
        blind: { path: blindPath, fileByteSha256: hash(readFileSync(blindPath, 'utf8')) },
        gold: { path: goldPath, fileByteSha256: hash(readFileSync(goldPath, 'utf8')) },
        entailmentPredictions: entailmentPredictionsPath
          ? {
              path: entailmentPredictionsPath,
              fileByteSha256: hash(readFileSync(entailmentPredictionsPath, 'utf8')),
              canonicalJsonSha256: hash(JSON.stringify(entailmentPredictions)),
            }
          : null,
        heldoutIdentityAndEdges:
          qualityCasesPath && qualityPredictionsPath && qualityGoldPath && qualityFreezeManifestPath
            ? {
                cases: {
                  path: qualityCasesPath,
                  fileByteSha256: hash(readFileSync(qualityCasesPath, 'utf8')),
                },
                predictions: {
                  path: qualityPredictionsPath,
                  fileByteSha256: hash(readFileSync(qualityPredictionsPath, 'utf8')),
                },
                gold: {
                  path: qualityGoldPath,
                  fileByteSha256: hash(readFileSync(qualityGoldPath, 'utf8')),
                },
                freezeManifest: {
                  path: qualityFreezeManifestPath,
                  fileByteSha256: hash(readFileSync(qualityFreezeManifestPath, 'utf8')),
                },
              }
            : null,
      },
      corpus: {
        documentCount: blind.documents.length,
        queryCount: blind.retrievalCases.length,
        sourceUrls: blind.documents.map((document) => document.sourceUrl),
      },
      execution: {
        implementation: 'packages/operator-cli/src/evidence-retrieval.ts#retrieveEvidence',
        database: 'local temporary evidence rows',
        k: EVALUATION_K,
        lexicalVectorFusion: 'reciprocal rank fusion',
        controlledHnswMechanics: {
          status: 'completed',
          includedPaddingRows: hnswPaddingRowsPerPartition,
          excludedPaddingRows,
          filter:
            'A run-unique deterministic mechanics namespace includes only the intended padding partition and excludes existing/private rows and the wrong-model partition; semantic retrieval also uses an explicit held-out source-item allowlist.',
          interpretation:
            'The natural padding preflight records the default plan, and the forced padding preflight proves HNSW execution mechanics. The filtered semantic query records its separate plan under transaction-local controls and may use the source-item B-tree instead; synthetic rows do not represent natural distractors or production-scale research quality.',
          embeddingInterpretation:
            embeddingProvider === LOCAL_PROVIDER
              ? 'Deterministic document and included-padding vectors share a mechanics-only namespace and are not semantically meaningful.'
              : 'Provider vectors are isolated to held-out documents; the deterministic padding namespace is used only for the separate mechanics preflight.',
          semanticSourceScope:
            embeddingProvider === LOCAL_PROVIDER
              ? 'Held-out document source items plus the intentionally included deterministic padding source.'
              : 'Held-out document source items only.',
          naturalPlannerPreflight: {
            statement: 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)',
            setting: 'default local planner settings',
            ...naturalPreflightPlanDetails,
          },
          forcedIndexMechanicsPreflight: {
            statement: 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)',
            setting:
              'SET LOCAL enable_seqscan=off; SET LOCAL enable_bitmapscan=off in an isolated rolled-back transaction',
            ...forcedPreflightPlanDetails,
          },
        },
      },
      cost: embedding,
      lexical: measuredMetrics(lexical),
      exactVector: measuredMetrics(exact),
      approximateVector: measuredMetrics(approximate),
      approximateAgainstExact: comparison,
      semanticQueryPlans: {
        setting:
          'SET LOCAL enable_seqscan=off; SET LOCAL enable_bitmapscan=off in an isolated rolled-back transaction',
        interpretation:
          'These are the plans PostgreSQL chose for source-filtered semantic retrieval under the recorded transaction-local controls. HNSW is not required here because the source-item B-tree remains eligible; HNSW execution is asserted only by the separate forced padding preflight.',
        exact: semanticPlans.get('exact') ?? null,
        approximate: semanticPlans.get('approximate') ?? null,
      },
      entailment,
      heldoutIdentityAndEdges: heldoutQuality,
      uncertainty: {
        calibrationStatus: 'unavailable',
        probabilityClaimSupported: false,
        reason:
          'Retrieval ranks are not probabilities, and this bounded corpus does not supply probabilistic predictions for held-out calibration.',
      },
      limitations: [
        'This is a bounded held-out pilot; its sample size does not support population-level quality claims.',
        'Temporary local rows exercise production SQL and isolation filters but do not reproduce production corpus composition or natural distractors; source-item filtering is covered separately by the integration regression.',
        'Controlled deterministic padding proves HNSW selection and execution only in the separate forced mechanics preflight. A source-filtered semantic query may legitimately use the source-item B-tree, and neither plan is representative-scale retrieval-quality evidence.',
        'Retrieval relevance does not establish identity, entailment, relationship truth, or source independence.',
        'Forbidden retrieval results remain candidate-level false positives; false merges and unsupported edge assertions are measured separately on categorical held-out cases when their independent gold file is supplied.',
        'Entailment labels are curated provisional judgments rather than consensus or human-adjudicated gold labels.',
      ],
    };
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      const cleanup = await cleanupTemporaryEvaluation(
        pool,
        itemIds,
        captureIds,
        eventIds,
        sourceIds,
      );
      if (output) output['cleanup'] = cleanup;
    } catch (error) {
      failures.push(error);
    }
    try {
      await pool.end();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(
      failures,
      'Evaluation and cleanup failed; inspect each recorded cause',
    );
  }

  if (!output) throw new Error('Retrieval pilot produced no evaluation artifact');
  const serialized = `${JSON.stringify(redactPlanVectorLiterals(output), null, 2)}\n`;
  if (outPath) writeFileSync(outPath, serialized, { encoding: 'utf8', flag: 'wx' });
  else process.stdout.write(serialized);
  if (budgetGateFailed) {
    console.error('The evidence-pilot budget gate failed; the reason is recorded in the output.');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const causes: readonly unknown[] = error instanceof AggregateError ? error.errors : [error];
  for (const cause of causes) {
    console.error(cause instanceof Error ? cause.message : String(cause));
  }
  process.exitCode = 1;
});
