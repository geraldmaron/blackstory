import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { getOpsPostgresPool } from '@repo/data-access';
import {
  segmentEvidenceText,
  parseEvidenceQueryVector,
  indexCaptureText,
  attachPassageEmbedding,
  retrieveEvidence,
} from './evidence-retrieval.js';
import { sweepCaptureRetention, drainCaptureDisposals } from './capture-retention.js';
import { persistCapture } from './capture-backfill.js';
import { sourceIdForUrl } from './source-capture.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const vector = (x: number, y: number) => [x, y, ...Array<number>(766).fill(0)];
test('passages preserve all Unicode text and overlapping selector offsets', () => {
  const text = '𐐀'.repeat(1800) + ' The river restoration committee met at the school.';
  const points = Array.from(text);
  const chunks = segmentEvidenceText(text);
  assert.equal(chunks.length, 2);
  for (const chunk of chunks)
    assert.equal(points.slice(chunk.start, chunk.end).join(''), chunk.body);
  assert.equal(chunks[1]?.start, 1620);
  assert.equal(chunks[1]?.end, points.length);
});

test(
  'Postgres evidence retrieval preserves origins, exact text and model isolation',
  { skip: !process.env.RESEARCH_TEST_DATABASE_URL },
  async () => {
    const connectionString = process.env.RESEARCH_TEST_DATABASE_URL!;
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname));
    const pool = getOpsPostgresPool({ DATABASE_URL: connectionString });
    const prefix = randomUUID();
    const urls = [
      `https://${prefix}.example/school`,
      `https://${prefix}.example/river`,
      `https://${prefix}.example/copy`,
    ];
    const texts = [
      'The school principal Ada Rivers taught cartography. Her testimony challenged the district map.',
      'The river restoration committee disputed the industrial drainage permit.',
      'The school principal Ada Rivers taught cartography. Her testimony challenged the district map.',
    ];
    const sourceId = sourceIdForUrl(urls[0]!)!.id;
    const itemIds = urls.map((url) => `src_item_${hash(url)}`);
    const decision = (sourceUrl: string) => ({
      sourceUrl,
      allowTextRetention: true,
      allowArchive: false,
      sensitivity: 'public' as const,
      reviewedBy: 'synthetic-fixture',
      reviewedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2099-01-01T00:00:00Z',
      basis: 'Synthetic integration fixture',
    });
    try {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        const text = texts[i]!;
        await persistCapture(
          pool,
          {
            id: `${prefix}-capture-${i === 2 ? 0 : i}`,
            sourceItemId: null,
            contentHashAlgorithm: 'sha256',
            contentHashDigest: hash(`${prefix}-${text}`),
            parserVersion: 'fixture-v1',
            snapshotMode: 'selective',
            dedupOfCaptureId: null,
            capturedAt: new Date().toISOString(),
            extractedText: text,
            storageObject: {
              stored: 'supabase-storage',
              bucket: 'raw-sources',
              path: `captures/${hash(text)}.txt`,
              sourceUrl: url,
              preservationDecision: decision(url),
              extractedTextHash: hash(text),
            },
          },
          {
            id: `${prefix}-event-${i}`,
            sourceId,
            adapterId: 'fixture',
            status: 'success',
            httpStatus: 200,
            detail: { url, finalUrl: url },
            occurredAt: new Date().toISOString(),
          },
        );
      }
      const origins = await pool.query(
        'SELECT capture_id,source_item_id FROM evidence.capture_origins WHERE source_item_id=ANY($1)',
        [itemIds],
      );
      assert.equal(
        origins.rows.length,
        3,
        'A copied source retains its origin without inventing independent content',
      );
      assert.equal(new Set(origins.rows.map((r) => r.capture_id)).size, 2);
      const lexical = await retrieveEvidence(pool, {
        query: 'cartography',
        sourceItemIds: itemIds,
      });
      assert.equal(lexical.hits.length, 2);
      assert.deepEqual(new Set(lexical.hits.map((h) => h.sourceUrl)), new Set([urls[0], urls[2]]));
      const school = lexical.hits.find((h) => h.sourceUrl === urls[0])!;
      await attachPassageEmbedding(pool, {
        passageId: school.id,
        bodyHash: school.bodyHash,
        model: 'fixture-space-v1',
        vector: vector(0.8, 0.6),
      });
      await assert.rejects(
        attachPassageEmbedding(pool, {
          passageId: school.id,
          bodyHash: '0'.repeat(64),
          model: 'fixture-space-v1',
          vector: vector(0.8, 0.6),
        }),
        /changed/,
      );
      const semantic = await retrieveEvidence(pool, {
        query: 'teaching navigation',
        sourceItemIds: itemIds,
        vector: { model: 'fixture-space-v1', values: vector(1, 0) },
      });
      assert.equal(semantic.hits[0]?.id, school.id);
      assert.equal(semantic.vectorMode, 'exact');
      assert.equal(
        (
          await retrieveEvidence(pool, {
            query: 'unmatched',
            sourceItemIds: itemIds,
            vector: { model: 'other-space', values: vector(1, 0) },
          })
        ).hits.length,
        0,
      );
      const river = (
        await retrieveEvidence(pool, { query: 'drainage permit', sourceItemIds: [itemIds[1]!] })
      ).hits[0]!;
      await attachPassageEmbedding(pool, {
        passageId: river.id,
        bodyHash: river.bodyHash,
        model: 'fixture-space-v1',
        vector: vector(1, 0),
      });
      const sourceFiltered = await retrieveEvidence(pool, {
        query: 'unmatched',
        sourceItemIds: [itemIds[0]!],
        vector: { model: 'fixture-space-v1', values: vector(1, 0) },
      });
      assert.equal(sourceFiltered.hits.length, 1);
      assert.equal(sourceFiltered.hits[0]?.sourceItemId, itemIds[0]);
      assert.equal(
        sourceFiltered.hits.some((hit) => hit.sourceItemId === itemIds[1]),
        false,
        'A closer vector from an unauthorized source item cannot enter the candidate set',
      );
      await pool.query(
        "UPDATE evidence.retrieval_passages SET retention_expires_at='2000-01-01T00:00:00Z' WHERE id=$1",
        [river.id],
      );
      assert.equal(
        (
          await retrieveEvidence(pool, {
            query: 'unmatched',
            sourceItemIds: [itemIds[1]!],
            vector: { model: 'fixture-space-v1', values: vector(1, 0) },
          })
        ).hits.length,
        0,
        'Expired passages cannot enter exact vector candidates',
      );
      await assert.rejects(
        indexCaptureText(pool, {
          captureId: school.captureId,
          sourceItemId: school.sourceItemId,
          parserVersion: 'fixture-v1',
          text: 'invented',
          decision: decision(urls[0]!),
        }),
        /hash/,
      );
      await pool.query(
        'UPDATE evidence.retrieval_passages SET withdrawn_at=clock_timestamp() WHERE id=$1',
        [school.id],
      );
      assert.equal(
        (await retrieveEvidence(pool, { query: 'cartography', sourceItemIds: [itemIds[0]!] })).hits
          .length,
        0,
      );
      const dry = await sweepCaptureRetention(pool, {
        commit: false,
        actor: 'fixture-reviewer',
        sourceItemId: itemIds[0]!,
      });
      assert.equal(dry.selectedOrigins, 1);
      assert.equal(dry.deletedPassages, 0);
      const removed = await sweepCaptureRetention(pool, {
        commit: true,
        actor: 'fixture-reviewer',
        sourceItemId: itemIds[0]!,
      });
      assert.equal(removed.deletedPassages, 1);
      await assert.rejects(
        indexCaptureText(pool, {
          captureId: school.captureId,
          sourceItemId: school.sourceItemId,
          parserVersion: 'fixture-v1',
          text: texts[0]!,
          decision: decision(urls[0]!),
        }),
        /capture origin/,
      );
      let deletes = 0;
      const storage = {
        url: 'https://storage.example',
        bucket: 'raw-sources',
        secretKey: 'fixture-key',
        transport: async () => {
          deletes++;
          return new Response('[]', { status: 200 });
        },
      };
      assert.equal((await drainCaptureDisposals(pool, storage)).sharedObjectsDeferred, 1);
      assert.equal(deletes, 0, 'A still-authorized duplicate keeps its stored text');
      await sweepCaptureRetention(pool, {
        commit: true,
        actor: 'fixture-reviewer',
        sourceItemId: itemIds[2]!,
      });
      await assert.rejects(
        drainCaptureDisposals(pool, {
          ...storage,
          transport: async () => new Response('', { status: 503 }),
        }),
        /retained for retry/,
      );
      assert.equal((await drainCaptureDisposals(pool, storage)).deletedObjects, 1);
      assert.equal(deletes, 1);
      assert.equal((await drainCaptureDisposals(pool, storage)).deletedObjects, 0);
      await assert.rejects(
        persistCapture(
          pool,
          {
            id: `${prefix}-rejected-capture`,
            sourceItemId: null,
            contentHashAlgorithm: 'sha256',
            contentHashDigest: hash(`${prefix}-rejected`),
            parserVersion: 'fixture-v1',
            snapshotMode: 'selective',
            dedupOfCaptureId: null,
            capturedAt: new Date().toISOString(),
            extractedText: texts[0]!,
            storageObject: {
              stored: 'supabase-storage',
              bucket: 'raw-sources',
              path: `captures/${hash(texts[0]!)}.txt`,
              sourceUrl: urls[1],
              preservationDecision: decision(urls[1]!),
              extractedTextHash: hash(texts[0]!),
            },
          },
          {
            id: `${prefix}-rejected-event`,
            sourceId,
            adapterId: 'fixture',
            status: 'success',
            httpStatus: 200,
            detail: { url: urls[1] },
            occurredAt: new Date().toISOString(),
          },
        ),
        /queued for disposal/,
      );
      assert.equal(
        (
          await pool.query('SELECT id FROM evidence.source_captures WHERE id=$1', [
            `${prefix}-rejected-capture`,
          ])
        ).rows.length,
        0,
        'Rejected origin rolls back the byte capture',
      );
      assert.equal(
        (
          await pool.query('SELECT id FROM evidence.retrieval_events WHERE id=$1', [
            `${prefix}-rejected-event`,
          ])
        ).rows.length,
        0,
        'Failed capture does not record a success event',
      );
      const retained = await pool.query(
        'SELECT storage_object FROM evidence.capture_origins WHERE source_item_id=$1',
        [itemIds[0]],
      );
      assert.equal(retained.rows[0]?.storage_object.representation, 'withdrawn-text');
    } finally {
      await pool.query('DELETE FROM evidence.capture_disposals WHERE source_item_id=ANY($1)', [
        itemIds,
      ]);
      await pool.query('DELETE FROM evidence.retrieval_passages WHERE source_item_id=ANY($1)', [
        itemIds,
      ]);
      await pool.query('DELETE FROM evidence.capture_origins WHERE source_item_id=ANY($1)', [
        itemIds,
      ]);
      await pool.query('DELETE FROM evidence.source_captures WHERE id LIKE $1', [`${prefix}%`]);
      await pool.query('DELETE FROM evidence.retrieval_events WHERE source_id=$1', [sourceId]);
      await pool.query('DELETE FROM evidence.source_items WHERE source_id=$1', [sourceId]);
      await pool.query('DELETE FROM evidence.evidence_sources WHERE id=$1', [sourceId]);
      await pool.end();
    }
  },
);

test('query vectors reject coercion, malformed dimensions and unknown fields', () => {
  for (const input of [
    null,
    0,
    [],
    {},
    { model: 'space', values: 'vector' },
    { model: 'space', values: [1] },
    { model: 'space', values: Array(768).fill(0) },
    { model: 'space', values: [NaN, ...Array(767).fill(1)] },
    { model: 'space', values: ['1', ...Array(767).fill(1)] },
    { model: 'space', values: Array(768).fill(1), extra: true },
  ]) {
    assert.throws(() => parseEvidenceQueryVector(input));
  }
  assert.equal(
    parseEvidenceQueryVector({ model: 'space-v1', values: vector(1, 0) }).model,
    'space-v1',
  );
});

test('approximate retrieval keeps every eligibility predicate inside the bounded ANN candidate query', async () => {
  const queries: string[] = [];
  const db = {
    async query(text: string) {
      queries.push(text);
      if (text.includes('approximate_candidates')) return { rows: [{ id: 'p1' }] };
      if (text.includes('SELECT passage.*')) {
        return {
          rows: [
            {
              id: 'p1',
              capture_id: 'capture-1',
              source_item_id: 'authorized-source',
              source_url: 'https://example.test/source',
              body: 'held-out passage',
              start_offset: 0,
              end_offset: 16,
              body_hash: 'a'.repeat(64),
              document_text_hash: 'b'.repeat(64),
              parser_version: 'fixture-v1',
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
  const result = await retrieveEvidence(db, {
    query: 'held-out query',
    sourceItemIds: ['authorized-source'],
    vector: { model: 'held-out-model', values: vector(1, 0) },
    approximate: true,
  });
  const semantic = queries.find((query) => query.includes('approximate_candidates'))!;
  assert.match(semantic, /WITH approximate_candidates AS MATERIALIZED/);
  assert.match(
    semantic,
    /withdrawn_at IS NULL AND retention_expires_at>clock_timestamp\(\).*source_item_id=ANY.*embedding_model=\$4 AND embedding_text_hash=body_hash/s,
  );
  assert.match(
    semantic,
    /ORDER BY embedding OPERATOR\(extensions\.<=>\) \$1::extensions\.vector LIMIT \$3\s*\) SELECT id FROM approximate_candidates ORDER BY distance,id/,
  );
  assert.equal(result.vectorMode, 'approximate');
  assert.ok(result.limitations.some((limitation) => /ANN limit boundary/.test(limitation)));
});
