import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, generateKeyPairSync, createHash } from 'node:crypto';
import pg from 'pg';
import { generateReleaseArtifacts, verifySignedReleaseManifest } from '@repo/domain';
import {
  createPoolPostgresReleaseStore,
  activateReleaseAsync,
  rollbackToAsync,
} from '@repo/data-access';
import { redactLocationForPublic } from '@repo/security';
import { managementEntitySnapshot } from '@repo/ops-data/management/catalog';
import { workDigest } from '@repo/ops-data/management';
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
    let wrongPublicPoint = false;
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
      const mobileStore = createPoolPostgresReleaseStore(pool);
      const baseline = generateReleaseArtifacts({
        releaseId: previous,
        generatedAt: new Date().toISOString(),
        mapEntities: [],
        redactLocation: redactLocationForPublic,
        contentIndex: [
          { id: 'existing-story', kind: 'story', title: 'Unrelated story', version: 'original' },
        ],
        entitiesList: [],
        searchIndex: [],
        bootstrap: {
          schemaRange: { min: 1, max: 1 },
          compatibility: {
            apiVersion: 'v1',
            minSupportedApiVersion: 'v1',
            deprecationWindowDays: 90,
            minSupportedAppBuild: 1,
          },
          featureFlags: { map: true },
          legalVersions: { privacy: 'existing' },
          cacheDirectives: {
            bootstrapMaxAgeSeconds: 60,
            bootstrapStaleWhileRevalidateSeconds: 600,
            releaseArtifactImmutableMaxAgeSeconds: 31536000,
          },
        },
      });
      await activateReleaseAsync(mobileStore, baseline);
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
          const points = await pool.query(
            'SELECT projection FROM published.release_entities WHERE release_id=$1',
            [active.rows[0].release_id],
          );
          return Response.json({
            releaseId: active.rows[0].release_id,
            features: points.rows
              .filter(({ projection }) => projection.location?.lat != null)
              .map(({ projection }) => ({
                properties: {
                  entityId: projection.id,
                  displayName: projection.displayName,
                  precision: projection.location.precision,
                },
                geometry: {
                  type: 'Point',
                  coordinates: [projection.location.lng, projection.location.lat],
                },
              })),
          });
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
            ...(row.rows[0]?.projection.location?.lat != null
              ? {
                  geoAnchor: {
                    lat: wrongPublicPoint ? 0 : row.rows[0].projection.location.lat,
                    lng: row.rows[0].projection.location.lng,
                  },
                }
              : {}),
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
      assert.equal(objects.size, 12);
      const mobilePointer = await mobileStore.getPointer();
      assert.equal(mobilePointer!.activeReleaseId, committedRelease);
      const publishedMobile = await mobileStore.getRelease(String(committedRelease));
      assert.deepEqual(publishedMobile!.manifest.compatibility, baseline.manifest.compatibility);
      const signedRow = await pool.query(
        'SELECT signed_manifest FROM publication.releases WHERE id=$1',
        [committedRelease],
      );
      const signed = signedRow.rows[0].signed_manifest;
      assert.equal(
        verifySignedReleaseManifest(
          { ...signed, manifestHash: { algorithm: 'sha256', digest: signed.manifestHash } },
          keys.publicKey,
        ),
        true,
      );
      assert.equal(signed.manifest.aggregateArtifacts.length, 8);
      assert.equal(signed.mobileBootstrap.activeRelease.releaseId, committedRelease);
      const content = await mobileStore.getArtifact(
        publishedMobile!.manifest.artifactHashes['content-index']!.path,
      );
      assert.equal(JSON.parse(content!.canonical).entries[0].id, 'existing-story');
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
      const correction = await store.submit(actor, {
        request: 'Correct the first school and remove its unsupported context',
        sessionId: 'test',
        harness: 'test',
        idempotencyKey: randomUUID(),
      });
      const oldLocationId = `location_${randomUUID()}`;
      await pool.query(
        `INSERT INTO canonical.entity_locations(id,entity_id,role,geometry_type,geometry,location,lat,lng,precision,match_method,label)
        VALUES($1,$2,'historical','Point','{"type":"Point","coordinates":[-84.4,33.7]}',
          ST_SetSRID(ST_MakePoint(-84.4,33.7),4326)::geography,33.7,-84.4,'institution','documented','Old point')`,
        [oldLocationId, changes[0]!.entityId],
      );
      const snapshot = await managementEntitySnapshot(pool, changes[0]!.entityId);
      assert.equal(snapshot.locations[0].lat, 33.7);
      const correctionLease = await store.claim(correction.id, 'research');
      await store.saveProposal(correction.id, correctionLease!.lease, {
        summary: 'Correct the existing account.',
        interpretation: 'One existing school only.',
        held: [],
        researchRunIds: [],
        changes: [
          {
            ...changes[0],
            operation: 'update',
            beforeHash: workDigest(snapshot),
            claimRevisions: snapshot.claims.map((row: { claim: { id: string } }) => ({
              claimId: row.claim.id,
              reason: 'Superseded by the reviewed atomic assertion.',
              replacementAssertionIds: ['school'],
            })),
            contextRevision: {
              text: '',
              reason: 'Remove unsupported context.',
              sentenceClaims: [],
            },
            locationRevision: {
              locationId: oldLocationId,
              reason: 'Withhold an unsupported point.',
              assertionIds: ['school'],
            },
          },
        ],
      });
      const correctionReview = (await store.get(actor, correction.id))!;
      assert.equal(correctionReview.proposal!.changes[0]!.before!.claims!.length, 2);
      await store.decide(actor, correction.id, {
        version: correctionReview.version,
        proposalHash: correctionReview.proposalHash,
        entityIds: [changes[0]!.entityId],
        action: 'approve',
        reason: 'Publish this correction',
        sessionId: 'test',
        idempotencyKey: randomUUID(),
      });
      const correctionPublish = await store.claim(correction.id, 'publish');
      const beforeCorrectionRelease = (await mobileStore.getPointer())!.activeReleaseId;
      await pool.query('UPDATE canonical.entities SET display_name=$2 WHERE id=$1', [
        changes[0]!.entityId,
        'Concurrent editor correction',
      ]);
      await assert.rejects(
        publishManagementWork(store, correctionPublish!.work, correctionPublish!.lease),
        /canonical record changed after review/,
      );
      assert.equal((await mobileStore.getPointer())!.activeReleaseId, beforeCorrectionRelease);
      assert.equal(
        (await managementEntitySnapshot(pool, changes[0]!.entityId)).locations[0].lat,
        33.7,
      );
      await pool.query('UPDATE canonical.entities SET display_name=$2 WHERE id=$1', [
        changes[0]!.entityId,
        snapshot.entity.display_name,
      ]);
      await publishManagementWork(store, correctionPublish!.work, correctionPublish!.lease);
      const corrected = (await store.get(actor, correction.id))!;
      assert.equal(corrected.state, 'published');
      const correctedSnapshot = await managementEntitySnapshot(pool, changes[0]!.entityId);
      assert.equal(
        correctedSnapshot.claims.filter(
          (row: { claim: { publication_status: string } }) =>
            row.claim.publication_status === 'superseded',
        ).length,
        2,
      );
      assert.equal(correctedSnapshot.entity.kind_detail.editorial.historicalContext, '');
      assert.equal(correctedSnapshot.locations.length, 1);
      assert.equal(correctedSnapshot.locations[0].id, oldLocationId);
      for (const field of ['lat', 'lng', 'geometry', 'location', 'geohash'])
        assert.equal(correctedSnapshot.locations[0][field], null, `${field} must be withheld`);
      const correctedProjection = await pool.query(
        'SELECT projection FROM published.release_entities WHERE release_id=$1 AND entity_id=$2',
        [corrected.outcome!.releaseId, changes[0]!.entityId],
      );
      assert.equal(correctedProjection.rows[0].projection.claims.length, 1);
      assert.equal(correctedProjection.rows[0].projection.location, undefined);
      const replacement = await store.submit(actor, {
        request: 'Replace the withheld school location with the sourced point',
        sessionId: 'test',
        harness: 'test',
        idempotencyKey: randomUUID(),
      });
      const replacementLease = await store.claim(replacement.id, 'research');
      const newPoint = {
        lat: 33.75,
        lng: -84.42,
        precision: 'institution',
        matchMethod: 'documented',
        label: 'Reviewed school site',
      };
      await store.saveProposal(replacement.id, replacementLease!.lease, {
        summary: 'Restore a sourced school point.',
        interpretation: 'One school only.',
        held: [],
        researchRunIds: [],
        changes: [
          {
            ...changes[0],
            operation: 'update',
            beforeHash: workDigest(correctedSnapshot),
            record: { ...changes[0]!.record, location: newPoint },
            locationRevision: {
              locationId: oldLocationId,
              reason: 'Reviewed evidence locates this site.',
              assertionIds: ['school'],
            },
          },
        ],
      });
      const replacementReview = (await store.get(actor, replacement.id))!;
      await store.decide(actor, replacement.id, {
        version: replacementReview.version,
        proposalHash: replacementReview.proposalHash,
        entityIds: [changes[0]!.entityId],
        action: 'approve',
        reason: 'Publish this point',
        sessionId: 'test',
        idempotencyKey: randomUUID(),
      });
      wrongPublicPoint = true;
      const replacementPublish = await store.claim(replacement.id, 'publish');
      await publishManagementWork(store, replacementPublish!.work, replacementPublish!.lease);
      const wrongReadback = (await store.get(actor, replacement.id))!;
      assert.equal(wrongReadback.state, 'verification_failed');
      assert.equal(wrongReadback.outcome!.verified, false);
      wrongPublicPoint = false;
      const replacementRetry = await store.claim(replacement.id, 'publish');
      await publishManagementWork(store, replacementRetry!.work, replacementRetry!.lease);
      assert.equal((await store.get(actor, replacement.id))!.state, 'published');
      const replacedLocation = (await managementEntitySnapshot(pool, changes[0]!.entityId))
        .locations[0];
      assert.equal(replacedLocation.lat, newPoint.lat);
      assert.equal(replacedLocation.lng, newPoint.lng);
      assert.deepEqual(replacedLocation.geometry.coordinates, [newPoint.lng, newPoint.lat]);
      await rollbackToAsync(mobileStore, String(committedRelease), { platformSchemaVersion: 1 });
      assert.equal((await mobileStore.getPointer())!.activeReleaseId, committedRelease);
      assert.equal(
        (await pool.query("SELECT release_id FROM published.active_release WHERE id='active'"))
          .rows[0].release_id,
        committedRelease,
      );
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of Object.entries(oldEnv))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      await pool.end();
    }
  },
);
