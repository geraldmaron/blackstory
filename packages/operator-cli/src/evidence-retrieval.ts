/** Private passage retrieval with exact provenance and optional model-pinned vector ranking. */
import { createHash } from 'node:crypto';
import { reciprocalRankFusion } from '@repo/domain';
import type { PreservationDecision } from '@repo/research-kernel';
import type { QueryablePool } from './model-invocation-log.js';
import { validatePreservationDecision } from './wayback-anchor.js';

const hash = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
export const PASSAGE_VERSION = 'unicode-window-1800-overlap-180-v1';

/** Offsets count Unicode code points, matching PostgreSQL and Web Annotation text positions. */
export function segmentEvidenceText(
  text: string,
): readonly { ordinal: number; start: number; end: number; body: string; bodyHash: string }[] {
  if (Buffer.byteLength(text, 'utf8') > 2_000_000)
    throw new Error('Captured text exceeds the 2 MB indexing budget');
  const points = Array.from(text);
  const chunks = [];
  for (let start = 0; start < points.length; start += 1620) {
    const end = Math.min(start + 1800, points.length);
    const body = points.slice(start, end).join('');
    chunks.push({ ordinal: chunks.length, start, end, body, bodyHash: hash(body) });
    if (end === points.length) break;
  }
  return chunks;
}

export async function indexCaptureText(
  db: QueryablePool,
  input: {
    captureId: string;
    sourceItemId: string;
    parserVersion: string;
    text: string;
    decision: PreservationDecision;
  },
): Promise<number> {
  const origin = (
    await db.query(
      `SELECT source_url,storage_object FROM evidence.capture_origins WHERE capture_id=$1 AND source_item_id=$2 AND retention_revoked_at IS NULL`,
      [input.captureId, input.sourceItemId],
    )
  ).rows[0];
  if (!origin) throw new Error('Cannot index text without its capture origin');
  const decision = validatePreservationDecision(
    input.decision,
    String(origin.source_url),
    new Date().toISOString(),
  );
  if (!decision.allowTextRetention)
    throw new Error('Source policy prohibits retained text indexing');
  const documentHash = hash(input.text);
  if ((origin.storage_object as Record<string, unknown>).extractedTextHash !== documentHash) {
    throw new Error('Text does not match the captured extraction hash');
  }
  const chunks = segmentEvidenceText(input.text);
  // One SQL statement prevents a crash from leaving a partly rebuilt document index.
  const indexed = await db.query(
    `WITH authorized_origin AS (
      UPDATE evidence.capture_origins SET storage_object=jsonb_set(storage_object,'{preservationDecision}',$6::jsonb)
      WHERE capture_id=$1 AND source_item_id=$2 AND retention_revoked_at IS NULL
        AND (storage_object->'preservationDecision' IS NULL OR storage_object->'preservationDecision'='null'::jsonb OR
          (storage_object->'preservationDecision'->>'reviewedAt')::timestamptz <= ($6::jsonb->>'reviewedAt')::timestamptz)
      RETURNING capture_id
    ) INSERT INTO evidence.retrieval_passages
    (id,capture_id,source_item_id,parser_version,document_text_hash,ordinal,start_offset,end_offset,body,body_hash,retention_decision,retention_expires_at)
    SELECT row.id,$1,$2,$3,$4,row.ordinal,row.start,row.end,row.body,row.body_hash,$6::jsonb,$7::timestamptz
    FROM jsonb_to_recordset($5::jsonb) AS row(id text,ordinal integer,start integer,"end" integer,body text,body_hash text)
    WHERE EXISTS (SELECT 1 FROM authorized_origin)
    ON CONFLICT (id) DO UPDATE SET retention_decision=EXCLUDED.retention_decision,retention_expires_at=EXCLUDED.retention_expires_at
    WHERE evidence.retrieval_passages.withdrawn_at IS NULL
      AND (EXCLUDED.retention_decision->>'reviewedAt')::timestamptz >= (evidence.retrieval_passages.retention_decision->>'reviewedAt')::timestamptz
    RETURNING id`,
    [
      input.captureId,
      input.sourceItemId,
      `${input.parserVersion}:${PASSAGE_VERSION}`,
      documentHash,
      JSON.stringify(
        chunks.map((chunk) => ({
          ...chunk,
          id: `passage_${hash(`${input.captureId}|${input.sourceItemId}|${input.parserVersion}|${PASSAGE_VERSION}|${documentHash}|${chunk.ordinal}`)}`,
          body_hash: chunk.bodyHash,
        })),
      ),
      JSON.stringify(decision),
      decision.expiresAt,
    ],
  );
  if (indexed.rows.length !== chunks.length)
    throw new Error('Capture policy changed or text was withdrawn; indexing refused');
  return indexed.rows.length;
}

export function parseEvidenceQueryVector(value: unknown): { model: string; values: number[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Query vector must be an object');
  const record = value as Record<string, unknown>;
  if (
    typeof record.model !== 'string' ||
    !record.model.trim() ||
    Object.keys(record).some((key) => !['model', 'values'].includes(key))
  )
    throw new Error('Query vector requires only a model revision and values');
  vectorLiteral(record.values as number[]);
  return { model: record.model, values: record.values as number[] };
}

function vectorLiteral(vector: readonly number[]): string {
  if (
    !Array.isArray(vector) ||
    vector.length !== 768 ||
    vector.some((value) => !Number.isFinite(value)) ||
    !vector.some((value) => value !== 0)
  ) {
    throw new Error('Evidence vectors require 768 finite dimensions and nonzero magnitude');
  }
  return `[${vector.join(',')}]`;
}

export async function attachPassageEmbedding(
  db: QueryablePool,
  input: { passageId: string; bodyHash: string; model: string; vector: readonly number[] },
): Promise<void> {
  if (
    !input ||
    typeof input.model !== 'string' ||
    !input.model.trim() ||
    typeof input.passageId !== 'string' ||
    !input.passageId.trim() ||
    typeof input.bodyHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.bodyHash)
  )
    throw new Error('Embedding requires a passage id, unchanged body hash, and model revision');
  const result = await db.query(
    `UPDATE evidence.retrieval_passages SET embedding=$4::extensions.vector,embedding_model=$3,embedding_text_hash=$2
    WHERE id=$1 AND body_hash=$2 AND withdrawn_at IS NULL AND retention_expires_at>clock_timestamp() RETURNING id`,
    [input.passageId, input.bodyHash, input.model, vectorLiteral(input.vector)],
  );
  if (!result.rows.length)
    throw new Error('Passage is missing, expired, withdrawn, or changed since embedding');
}

export type EvidenceRetrievalInput = {
  query: string;
  limit?: number;
  sourceItemIds?: readonly string[];
  vector?: { model: string; values: readonly number[] };
  approximate?: boolean;
};
export type EvidenceRetrievalHit = {
  id: string;
  captureId: string;
  sourceItemId: string;
  sourceUrl: string;
  body: string;
  start: number;
  end: number;
  bodyHash: string;
  documentTextHash: string;
  parserVersion: string;
  lanes: readonly string[];
};
export async function retrieveEvidence(
  db: QueryablePool,
  input: EvidenceRetrievalInput,
): Promise<{
  hits: readonly EvidenceRetrievalHit[];
  vectorMode: 'off' | 'exact' | 'approximate';
  limitations: readonly string[];
}> {
  const limit = input.limit ?? 10;
  if (!input.query.trim() || input.query.length > 2000)
    throw new Error('Retrieval query must contain 1–2000 characters');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
    throw new Error('Retrieval limit must be 1–50');
  if (
    input.sourceItemIds &&
    (input.sourceItemIds.length > 100 || input.sourceItemIds.some((id) => !id.trim()))
  )
    throw new Error('Source filter must contain at most 100 nonempty identifiers');
  const laneLimit = Math.min(200, limit * 4);
  const where = `withdrawn_at IS NULL AND retention_expires_at>clock_timestamp() AND ($2::text[] IS NULL OR source_item_id=ANY($2))`;
  const lexical = await db.query(
    `SELECT id FROM evidence.retrieval_passages
    WHERE ${where} AND search_text @@ websearch_to_tsquery('simple',$1)
    ORDER BY ts_rank_cd(search_text,websearch_to_tsquery('simple',$1)) DESC,id LIMIT $3`,
    [input.query, input.sourceItemIds ?? null, laneLimit],
  );
  const lanes = [
    { laneId: 'text', weight: 1, items: lexical.rows.map((row) => ({ id: String(row.id) })) },
  ];
  if (input.vector) {
    if (
      typeof input.vector !== 'object' ||
      typeof input.vector.model !== 'string' ||
      !input.vector.model.trim()
    )
      throw new Error('Query vector requires an exact embedding model revision');
    const vector = vectorLiteral(input.vector.values);
    // A materialized candidate set provides the exact baseline without the HNSW planner path.
    const sql = input.approximate
      ? `WITH approximate_candidates AS MATERIALIZED (
          SELECT id,embedding OPERATOR(extensions.<=>) $1::extensions.vector AS distance
          FROM evidence.retrieval_passages WHERE ${where} AND embedding_model=$4 AND embedding_text_hash=body_hash
          ORDER BY embedding OPERATOR(extensions.<=>) $1::extensions.vector LIMIT $3
        ) SELECT id FROM approximate_candidates ORDER BY distance,id`
      : `WITH eligible AS MATERIALIZED (SELECT id,embedding FROM evidence.retrieval_passages WHERE ${where}
          AND embedding_model=$4 AND embedding_text_hash=body_hash)
          SELECT id FROM eligible ORDER BY embedding OPERATOR(extensions.<=>) $1::extensions.vector,id LIMIT $3`;
    const semantic = await db.query(sql, [
      vector,
      input.sourceItemIds ?? null,
      laneLimit,
      input.vector.model,
    ]);
    lanes.push({
      laneId: 'vector',
      weight: 1,
      items: semantic.rows.map((row) => ({ id: String(row.id) })),
    });
  }
  const ids = reciprocalRankFusion(lanes)
    .slice(0, limit)
    .map((hit) => hit.id);
  if (!ids.length)
    return {
      hits: [],
      vectorMode: input.vector ? (input.approximate ? 'approximate' : 'exact') : 'off',
      limitations: ['No matching indexed evidence; this does not establish historical absence.'],
    };
  const rows = await db.query(
    `SELECT passage.*,origin.source_url FROM evidence.retrieval_passages passage
    JOIN evidence.capture_origins origin USING (capture_id,source_item_id)
    WHERE passage.id=ANY($1::text[]) AND passage.withdrawn_at IS NULL AND passage.retention_expires_at>clock_timestamp()`,
    [ids],
  );
  const byId = new Map(rows.rows.map((row) => [String(row.id), row]));
  return {
    hits: ids.flatMap((id) => {
      const row = byId.get(id);
      return row
        ? [
            {
              id,
              captureId: String(row.capture_id),
              sourceItemId: String(row.source_item_id),
              sourceUrl: String(row.source_url),
              body: String(row.body),
              start: Number(row.start_offset),
              end: Number(row.end_offset),
              bodyHash: String(row.body_hash),
              documentTextHash: String(row.document_text_hash),
              parserVersion: String(row.parser_version),
              lanes: lanes
                .filter((lane) => lane.items.some((hit) => hit.id === id))
                .map((lane) => lane.laneId),
            },
          ]
        : [];
    }),
    vectorMode: input.vector ? (input.approximate ? 'approximate' : 'exact') : 'off',
    limitations: [
      'Retrieval ranks source passages; similarity does not establish identity, entailment, or source independence.',
      ...(input.vector
        ? [
            'Only passages with the exact embedding model and text revision participate in vector retrieval.',
          ]
        : ['Vector retrieval was not requested.']),
      ...(input.approximate
        ? [
            'Filtered HNSW retrieval can miss neighbors; compare with exact mode on a held-out corpus.',
            'Equal-distance candidates at the ANN limit boundary are not guaranteed to remain identical across runs.',
          ]
        : []),
    ],
  };
}
