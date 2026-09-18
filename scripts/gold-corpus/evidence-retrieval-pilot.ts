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
  runHybridRetrievalEval,
  type HybridQueryCategory,
  type HybridRetrievalEvalResult,
  type HybridRetrievalQuerySet,
} from '../../packages/testing/src/gold-corpus/hybrid-retrieval-eval.ts';
import {
  createOpenRouterEvaluationEmbeddingProvider,
  type OpenRouterEmbeddingUsage,
} from './openrouter-evaluation-embedding-provider.ts';

const PROVIDER = 'openrouter';
const MODEL = 'openai/text-embedding-3-small';
const DIMENSIONS = 768;
const PRICE_USD_PER_MILLION_TEXT_TOKENS = 0.02;
const PRICE_SOURCE = 'https://openrouter.ai/api/v1/embeddings/models';
const PRICE_RETRIEVED_AT = '2026-09-18';
const MAX_ALLOWED_COST_USD = 0.25;
const EVALUATION_K = 5;

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

type IndexedPassage = {
  readonly id: string;
  readonly source_item_id: string;
  readonly body: string;
  readonly body_hash: string;
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

function readGold(path: string): GoldCorpus {
  return readJson<GoldCorpus>(path);
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

function exactApproximateComparison(
  exact: HybridRetrievalEvalResult,
  approximate: HybridRetrievalEvalResult,
): { meanRecallAgainstExact: number; identicalTopKRate: number } {
  const approximateById = new Map(approximate.perQuery.map((result) => [result.queryId, result]));
  let recall = 0;
  let identical = 0;
  for (const result of exact.perQuery) {
    const other = approximateById.get(result.queryId);
    if (!other) continue;
    const expected = new Set(result.topIds);
    const hits = other.topIds.filter((id) => expected.has(id)).length;
    recall += hits / Math.max(1, expected.size);
    if (JSON.stringify(result.topIds) === JSON.stringify(other.topIds)) identical += 1;
  }
  return {
    meanRecallAgainstExact: recall / exact.queryCount,
    identicalTopKRate: identical / exact.queryCount,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const blindPath = requiredOption(args, '--blind');
  const goldPath = requiredOption(args, '--gold');
  const entailmentPredictionsPath = option(args, '--entailment-predictions');
  const outPath = option(args, '--out');
  if (outPath && existsSync(outPath)) throw new Error('The evaluation output path already exists');
  const embeddingProvider = requiredOption(args, '--embedding-provider');
  const embeddingModel = requiredOption(args, '--embedding-model');
  const maxCostUsd = Number(requiredOption(args, '--max-cost-usd'));
  const priorReservedCostUsd = Number(option(args, '--prior-reserved-cost-usd') ?? '0');
  const priorProviderCalls = Number(option(args, '--prior-provider-calls') ?? '0');
  if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > MAX_ALLOWED_COST_USD)
    throw new Error(`--max-cost-usd must be greater than zero and at most ${MAX_ALLOWED_COST_USD}`);
  if (!Number.isFinite(priorReservedCostUsd) || priorReservedCostUsd < 0)
    throw new Error('--prior-reserved-cost-usd must be a finite nonnegative number');
  if (!Number.isSafeInteger(priorProviderCalls) || priorProviderCalls < 0)
    throw new Error('--prior-provider-calls must be a nonnegative integer');
  if (priorReservedCostUsd > maxCostUsd)
    throw new Error('Prior embedding reservation already exceeds the total cost cap');
  if (embeddingProvider !== PROVIDER)
    throw new Error(`--embedding-provider must be ${PROVIDER} for this evaluation`);
  if (embeddingModel !== MODEL)
    throw new Error(`--embedding-model must be the evaluated model ${MODEL}`);
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

  const prefix = `retrieval-pilot-${randomUUID()}`;
  const pool = getOpsPostgresPool({ DATABASE_URL: connectionString });
  const semanticPlans = new Map<SemanticExplainMode, SemanticExplainPlan>();
  const retrievalPool = explainRecordingPool(pool, semanticPlans);
  const itemIds: string[] = [];
  const captureIds: string[] = [];
  const eventIds: string[] = [];
  const sourceIds: string[] = [];
  const documentIdBySourceItemId = new Map<string, string>();
  let output: Record<string, unknown> | undefined;
  try {
    for (const document of blind.documents) {
      const evaluationUrl = `https://${prefix}.example/${encodeURIComponent(document.id)}`;
      const source = sourceIdForUrl(evaluationUrl);
      if (!source) throw new Error(`Could not derive evaluation source for ${document.id}`);
      const itemId = `src_item_${hash(evaluationUrl)}`;
      const captureId = `${prefix}-${document.id}`;
      const eventId = `${prefix}-event-${document.id}`;
      const decision = {
        sourceUrl: evaluationUrl,
        allowTextRetention: true,
        allowArchive: false,
        sensitivity: 'public' as const,
        reviewedBy: 'heldout-retrieval-pilot',
        reviewedAt: new Date().toISOString(),
        expiresAt: '2099-01-01T00:00:00.000Z',
        basis: `Temporary local evaluation of public text from ${document.sourceUrl}`,
      };
      await persistCapture(
        pool,
        {
          id: captureId,
          sourceItemId: null,
          contentHashAlgorithm: 'sha256',
          contentHashDigest: hash(`${prefix}|${document.text}`),
          parserVersion: 'heldout-public-text-v1',
          snapshotMode: 'selective',
          dedupOfCaptureId: null,
          capturedAt: blind.retrievedAt,
          extractedText: document.text,
          storageObject: {
            stored: 'inline-evaluation',
            sourceUrl: evaluationUrl,
            evaluationSourceUrl: document.sourceUrl,
            preservationDecision: decision,
            extractedTextHash: hash(document.text),
          },
        },
        {
          id: eventId,
          sourceId: source.id,
          adapterId: 'heldout-retrieval-pilot',
          status: 'success',
          httpStatus: 200,
          detail: {
            url: evaluationUrl,
            finalUrl: evaluationUrl,
            publicSourceUrl: document.sourceUrl,
          },
          occurredAt: blind.retrievedAt,
        },
      );
      itemIds.push(itemId);
      captureIds.push(captureId);
      eventIds.push(eventId);
      sourceIds.push(source.id);
      documentIdBySourceItemId.set(itemId, document.id);
    }

    const lexical = await evaluateMode(set, async (_queryId, query) => {
      const result = await retrieveEvidence(retrievalPool, {
        query,
        limit: EVALUATION_K,
        sourceItemIds: itemIds,
      });
      return uniqueDocumentIds(result.hits, documentIdBySourceItemId);
    });

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');
    let exact: HybridRetrievalEvalResult | null = null;
    let approximate: HybridRetrievalEvalResult | null = null;
    let comparison: ReturnType<typeof exactApproximateComparison> | null = null;
    const passages = (
      await pool.query<IndexedPassage>(
        `SELECT id,source_item_id,body,body_hash FROM evidence.retrieval_passages
           WHERE source_item_id=ANY($1::text[]) ORDER BY source_item_id,ordinal`,
        [itemIds],
      )
    ).rows;
    const queryTexts = blind.retrievalCases.map((query) => query.query);
    const inputs = [...passages.map((passage) => passage.body), ...queryTexts];
    // UTF-8 bytes are a conservative upper bound on text tokens, so this reservation is made
    // before the provider call and cannot understate the listed per-token charge.
    const reservedUpperBoundTokens = inputs.reduce(
      (total, input) => total + Buffer.byteLength(input, 'utf8'),
      0,
    );
    const currentRunReservedCostUsd =
      (reservedUpperBoundTokens / 1_000_000) * PRICE_USD_PER_MILLION_TEXT_TOKENS;
    const cumulativeReservedCostUsd = priorReservedCostUsd + currentRunReservedCostUsd;
    if (cumulativeReservedCostUsd > maxCostUsd)
      throw new Error(
        `Cumulative embedding reservation $${cumulativeReservedCostUsd.toFixed(6)} exceeds cap $${maxCostUsd.toFixed(6)}`,
      );

    let providerUsage: OpenRouterEmbeddingUsage | null = null;
    const provider = createOpenRouterEvaluationEmbeddingProvider({
      apiKey,
      model: embeddingModel,
      dimensions: DIMENSIONS,
      onUsage: (usage) => {
        providerUsage = usage;
      },
    });
    const vectors = await provider.embed(inputs);
    for (let index = 0; index < passages.length; index += 1) {
      const passage = passages[index]!;
      await attachPassageEmbedding(pool, {
        passageId: passage.id,
        bodyHash: passage.body_hash,
        model: embeddingModel,
        vector: vectors[index]!,
      });
    }
    const queryVectorById = new Map(
      blind.retrievalCases.map((query, index) => [query.id, vectors[passages.length + index]!]),
    );
    const runVectorMode = (approximateMode: boolean) =>
      evaluateMode(set, async (queryId, query) => {
        const result = await retrieveEvidence(retrievalPool, {
          query,
          limit: EVALUATION_K,
          sourceItemIds: itemIds,
          vector: { model: embeddingModel, values: queryVectorById.get(queryId)! },
          approximate: approximateMode,
        });
        return uniqueDocumentIds(result.hits, documentIdBySourceItemId);
      });
    exact = await runVectorMode(false);
    approximate = await runVectorMode(true);
    comparison = exactApproximateComparison(exact, approximate);
    const embedding: Record<string, unknown> = {
      status: 'completed',
      provider: embeddingProvider,
      requestedModel: embeddingModel,
      responseModel: providerUsage?.responseModel ?? null,
      dimensions: DIMENSIONS,
      providerCalls: 1,
      priorProviderCalls,
      totalProviderCalls: priorProviderCalls + 1,
      embeddedPassageCount: passages.length,
      embeddedQueryCount: queryTexts.length,
      reservedUpperBoundTokens,
      currentRunReservedCostUsd,
      priorRunReservedCostUsd: priorReservedCostUsd,
      cumulativeReservedCostUsd,
      totalCostCapUsd: maxCostUsd,
      providerReportedPromptTokens: providerUsage?.promptTokens ?? null,
      providerReportedTotalTokens: providerUsage?.totalTokens ?? null,
      providerReportedCostUsd: providerUsage?.costUsd ?? null,
      accountingLimitation:
        providerUsage?.costUsd === null
          ? 'OpenRouter did not return usage.cost; actual provider charge is unknown.'
          : 'OpenRouter usage.cost is a provider-reported USD-denominated credit charge.',
      priceUsdPerMillionTextTokens: PRICE_USD_PER_MILLION_TEXT_TOKENS,
      priceSource: PRICE_SOURCE,
      priceRetrievedAt: PRICE_RETRIEVED_AT,
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
      },
      cost: embedding,
      lexical: measuredMetrics(lexical),
      exactVector: measuredMetrics(exact),
      approximateVector: measuredMetrics(approximate),
      approximateAgainstExact: comparison,
      semanticQueryPlans: {
        exact: semanticPlans.get('exact') ?? null,
        approximate: semanticPlans.get('approximate') ?? null,
      },
      entailment,
      uncertainty: {
        calibrationStatus: 'unavailable',
        probabilityClaimSupported: false,
        reason:
          'Retrieval ranks are not probabilities, and this bounded corpus does not supply probabilistic predictions for held-out calibration.',
      },
      limitations: [
        'This is a bounded held-out pilot; its sample size does not support population-level quality claims.',
        'Temporary local rows exercise production SQL and fusion code but do not reproduce the live corpus size, HNSW planner choice, or production filters.',
        'EXPLAIN ANALYZE records planner execution for this tiny temporary corpus only; it cannot prove that the live corpus selects or exercises HNSW.',
        'Retrieval relevance does not establish identity, entailment, relationship truth, or source independence.',
        'Forbidden retrieval results are candidate-level false positives, not measured identity merges; resolver false-merge behavior remains unmeasured.',
        'Entailment labels are curated provisional judgments rather than consensus or human-adjudicated gold labels.',
      ],
    };
  } finally {
    await pool.query('DELETE FROM evidence.retrieval_passages WHERE source_item_id=ANY($1)', [
      itemIds,
    ]);
    await pool.query('DELETE FROM evidence.capture_origins WHERE source_item_id=ANY($1)', [
      itemIds,
    ]);
    await pool.query('DELETE FROM evidence.source_captures WHERE id=ANY($1)', [captureIds]);
    await pool.query('DELETE FROM evidence.retrieval_events WHERE id=ANY($1)', [eventIds]);
    await pool.query('DELETE FROM evidence.source_items WHERE id=ANY($1)', [itemIds]);
    await pool.query(
      'DELETE FROM evidence.evidence_sources WHERE id=ANY($1) AND NOT EXISTS (SELECT 1 FROM evidence.source_items item WHERE item.source_id=evidence.evidence_sources.id)',
      [sourceIds],
    );
    await pool.end();
  }

  if (!output) throw new Error('Retrieval pilot produced no evaluation artifact');
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (outPath) writeFileSync(outPath, serialized, { encoding: 'utf8', flag: 'wx' });
  else process.stdout.write(serialized);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
