import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, generateKeyPairSync, createHash } from 'node:crypto';
import pg from 'pg';
import { ManagementWorkStore } from '@repo/ops-data/management';
import { publishManagementWork } from './publish-work';

const connectionString = process.env.BLACKSTORY_TEST_DATABASE_URL;
test(
  'approved release preserves unrelated content, commits once and retains unapproved work',
  { skip: !connectionString },
  async () => {
    const pool = new pg.Pool({ connectionString, max: 3 });
    const store = new ManagementWorkStore(pool);
    const ownerId = randomUUID();
    const actor = { ownerId, canPublish: true, canResearch: true };
    const previous = `test_release_${randomUUID()}`;
    const untouchedId = `untouched_${randomUUID()}`;
    const untouched = {
      id: untouchedId,
      kind: 'place',
      displayName: 'Unrelated record',
      summary: 'Unrelated content stays intact.',
      releaseId: previous,
      claims: [],
      related: [],
    };
    const originalFetch = globalThis.fetch;
    const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const publicPem = keys.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const vars = {
      RELEASE_SIGNING_PRIVATE_KEY: keys.privateKey
        .export({ format: 'pem', type: 'pkcs8' })
        .toString(),
      RELEASE_SIGNING_PUBLIC_KEY: publicPem,
      RELEASE_SIGNING_KEY_ID: 'local-test-only',
      EXPECTED_RELEASE_SIGNING_PUBLIC_KEY_SHA256: createHash('sha256')
        .update(publicPem)
        .digest('hex'),
      SUPABASE_URL: 'https://storage.example.test',
      SUPABASE_SECRET_KEY: 'local-test-only',
    };
    const oldEnv = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
    Object.assign(process.env, vars);
    const objects = new Map<string, string>();
    let failReadback = true;
    let failUpload = true;
    try {
      await pool.query(
        'INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,\'{"app_role":"admin"}\')',
        [ownerId],
      );
      await pool.query(
        "INSERT INTO publication.releases(id,status,search_index_version) VALUES($1,'active','test')",
        [previous],
      );
      await pool.query(
        "INSERT INTO published.active_release(id,release_id,activated_at) VALUES('active',$1,now()) ON CONFLICT(id) DO UPDATE SET release_id=$1",
        [previous],
      );
      await pool.query(
        "INSERT INTO published.search_index(id,release_id,entity_id,name,name_lower,kind,facets) VALUES($1,$2,$3,'Unrelated record','unrelated record','place','{}')",
        [`${previous}:${untouchedId}`, previous, untouchedId],
      );
      await pool.query(
        'INSERT INTO published.release_entities(release_id,entity_id,projection) VALUES($1,$2,$3)',
        [previous, untouchedId, JSON.stringify(untouched)],
      );
      const request = await store.submit(actor, {
        request: 'Research two schools',
        sessionId: 'test',
        harness: 'test',
        idempotencyKey: randomUUID(),
      });
      const quote =
        'The school served Black students at the documented site during the period covered by this historical record.';
      const sources = ['https://archive.example.gov/school', 'https://district.example.org/school'];
      const change = (name: string) => {
        const entityId = `school_${randomUUID()}`;
        return {
          entityId,
          operation: 'create',
          beforeHash: null,
          record: {
            entityId,
            displayName: name,
            summary: quote,
            jurisdiction: 'Atlanta, Georgia',
            topicIds: ['education'],
            topicTags: ['education'],
            eraBuckets: ['1920s'],
            sources: sources.map((url) => ({
              url,
              title: 'School record',
              excerpt: quote,
              fitness: 'strong',
            })),
          },
          assertions: [
            {
              id: 'school',
              statement: quote,
              finding: 'supported',
              reasoning: 'The excerpt records the school.',
              counterevidenceSearch: 'Compared name and location.',
              evidence: sources.map((sourceUrl) => ({
                sourceUrl,
                title: 'School record',
                quote,
                locator: 'Page 2',
                contentHash: 'a'.repeat(64),
                retrievedAt: new Date().toISOString(),
                fitness: 'strong',
                fitnessReason: 'Historical school record',
                lineage: sourceUrl,
                limitations: [],
              })),
            },
          ],
          sentenceClaims: [{ sentence: quote, assertionIds: ['school'] }],
          identityReview: 'Checked building identity.',
          proseReview: 'Checked exact wording.',
          rightsReview: 'Cited excerpts only.',
          reviewBasis: 'self_review',
          producerActorId: 'test-worker',
          reviewerActorId: 'test-worker',
          blockers: [],
          omissions: [],
        };
      };
      const changes = [change(`School ${randomUUID()}`), change(`School ${randomUUID()}`)];
      const lease = await store.claim(request.id, 'research');
      await store.saveProposal(request.id, lease!.lease, {
        summary: 'Two schools.',
        interpretation: 'Two school records only.',
        changes,
        held: [],
        researchRunIds: [],
      });
      const proposed = (await store.get(actor, request.id))!;
      await store.decide(actor, request.id, {
        version: proposed.version,
        proposalHash: proposed.proposalHash,
        entityIds: [changes[0]!.entityId],
        action: 'approve',
        reason: 'Publish selected',
        sessionId: 'test',
        idempotencyKey: randomUUID(),
      });
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url.startsWith('https://storage.example.test/storage/v1/object/')) {
          const path = url
            .replace('https://storage.example.test/storage/v1/object/', '')
            .replace(/^public\//u, '');
          if (init?.method === 'POST') {
            if (failUpload) return new Response('Unavailable', { status: 503 });
            if (objects.has(path)) return new Response('exists', { status: 409 });
            objects.set(path, String(init.body));
            return new Response('{}', { status: 200 });
          }
          return new Response(objects.get(path) ?? '', { status: objects.has(path) ? 200 : 404 });
        }
        if (url === 'https://api.blackstory.app/v1/map') {
          if (failReadback) return new Response('Unavailable', { status: 503 });
          const active = await pool.query(
            "SELECT release_id FROM published.active_release WHERE id='active'",
          );
          return Response.json({ releaseId: active.rows[0].release_id, features: [] });
        }
        if (url.startsWith('https://api.blackstory.app/v1/search?')) {
          const rows = await pool.query(
            'SELECT p.projection FROM published.release_entities p JOIN published.active_release a ON a.release_id=p.release_id',
          );
          return Response.json({ results: rows.rows.map((row) => row.projection) });
        }
        if (url.startsWith('https://api.blackstory.app/v1/entity/')) {
          const id = decodeURIComponent(url.split('/').at(-1)!);
          const row = await pool.query(
            'SELECT p.projection,p.release_id FROM published.release_entities p JOIN published.active_release a ON a.release_id=p.release_id WHERE p.entity_id=$1',
            [id],
          );
          return Response.json({
            ...row.rows[0]?.projection,
            revision: { releaseId: row.rows[0]?.release_id },
          });
        }
        if (url.startsWith('https://blackstory.app/entity/'))
          return new Response(
            changes.find((c) => url.endsWith(c.entityId))!.record.displayName + quote,
          );
        throw new Error('Unexpected external boundary');
      };
      const publish = await store.claim(request.id, 'publish');
      await pool.query("UPDATE auth.users SET raw_app_meta_data='{}'::jsonb WHERE id=$1", [
        ownerId,
      ]);
      await assert.rejects(
        publishManagementWork(store, publish!.work, publish!.lease),
        /permission is no longer active/,
      );
      assert.equal(objects.size, 0);
      await pool.query(
        "UPDATE auth.users SET raw_app_meta_data='{" +
          '"app_role":"admin"' +
          "}'::jsonb WHERE id=$1",
        [ownerId],
      );
      await assert.rejects(publishManagementWork(store, publish!.work, publish!.lease), /503/);
      assert.equal(
        (await pool.query('SELECT id FROM canonical.entities WHERE id=$1', [changes[0]!.entityId]))
          .rows.length,
        0,
      );
      assert.equal(
        (await pool.query("SELECT release_id FROM published.active_release WHERE id='active'"))
          .rows[0].release_id,
        previous,
      );
      failUpload = false;
      await publishManagementWork(store, (await store.get(actor, request.id))!, publish!.lease);
      const failed = (await store.get(actor, request.id))!;
      assert.equal(failed.state, 'verification_failed');
      const committedRelease = failed.outcome!.releaseId;
      const uploadedCount = objects.size;
      failReadback = false;
      const retry = await store.claim(request.id, 'publish');
      await publishManagementWork(store, retry!.work, retry!.lease);
      const result = (await store.get(actor, request.id))!;
      assert.equal(result.outcome!.releaseId, committedRelease);
      assert.equal(objects.size, uploadedCount);
      assert.equal(result.state, 'awaiting_review');
      assert.equal(result.outcome?.verified, true);
      assert.deepEqual(result.outcome?.publishedEntityIds, [changes[0]!.entityId]);
      assert.equal(await store.claim(request.id, 'publish'), null);
      const preserved = await pool.query(
        'SELECT projection FROM published.release_entities WHERE release_id=$1 AND entity_id=$2',
        [result.outcome!.releaseId, untouchedId],
      );
      assert.deepEqual(preserved.rows[0].projection, {
        ...untouched,
        releaseId: result.outcome!.releaseId,
      });
      const absent = await pool.query('SELECT id FROM canonical.entities WHERE id=$1', [
        changes[1]!.entityId,
      ]);
      assert.equal(absent.rows.length, 0);
      assert.equal(objects.size, 6);
      await store.decide(actor, request.id, {
        version: result.version,
        proposalHash: result.proposalHash,
        entityIds: [changes[1]!.entityId],
        action: 'approve',
        reason: 'Publish remaining',
        sessionId: 'test',
        idempotencyKey: randomUUID(),
      });
      const second = await store.claim(request.id, 'publish');
      await publishManagementWork(store, second!.work, second!.lease);
      const complete = (await store.get(actor, request.id))!;
      assert.equal(complete.state, 'published');
      assert.deepEqual(
        complete.outcome!.publishedEntityIds,
        changes.map((change) => change.entityId),
      );
      const duplicates = await pool.query(
        'SELECT count(*)::int AS count FROM canonical.claims WHERE entity_id=$1',
        [changes[0]!.entityId],
      );
      assert.equal(duplicates.rows[0].count, 2);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of Object.entries(oldEnv))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      await pool.end();
    }
  },
);
