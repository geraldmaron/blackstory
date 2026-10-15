import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { generateReleaseArtifacts } from '@repo/domain';
import { redactLocationForPublic } from '@repo/security';
import { createPoolPostgresReleaseStore, activateReleaseAsync } from '@repo/data-access';
import { getPostgresPool, __resetPostgresPoolForTests } from '../lib/canonical-postgres-client';
import {
  saveArticle,
  readArticle,
  reviewArticle,
  restoreArticle,
  EditorialConflict,
  saveContributor,
} from './store';
import { publishArticle, rollbackArticle } from './publish';
import type { ArticleDraft } from '@repo/schemas';
const connection = process.env.BLACKSTORY_TEST_DATABASE_URL;
test(
  'durable drafts, credits, stale edits, review invalidation and signed article release',
  { skip: !connection },
  async () => {
    const pool = getPostgresPool(),
      uid = randomUUID(),
      id = `test_editorial_${randomUUID()}`;
    const actor = { uid, email: 'editorial-test@example.test', role: 'admin' as const };
    try {
      await pool.query(
        'INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,\'{"app_role":"admin"}\')',
        [uid],
      );
      await saveContributor(
        actor,
        {
          id: 'gerald-dagher',
          name: 'Gerald Dagher',
          kind: 'person',
          biography: '',
          linkToMe: true,
        },
        'Verify contributor binding',
      );
      const draft: ArticleDraft = {
        id,
        slug: `test-${randomUUID()}`,
        title: 'Editorial acceptance fixture',
        summary: 'A controlled editorial acceptance fixture.',
        kind: 'article',
        publishedAt: '2026-10-14',
        eraLabel: 'Acceptance test',
        placeLabel: 'Isolated environment',
        body: [
          {
            type: 'paragraph',
            text: 'This controlled fixture checks article persistence. [ref:loc]',
          },
        ],
        references: [{ id: 'loc', label: 'Library of Congress', url: 'https://www.loc.gov/' }],
        tags: [],
        relatedEntityIds: [],
        contributors: [
          {
            id: 'gerald-dagher',
            name: 'Untrusted posted name',
            kind: 'editorial',
            roles: ['author'],
          },
          { id: 'neo', name: 'Neo', kind: 'editorial', roles: ['editor'] },
        ],
      };
      const saved = await saveArticle(actor, draft, 0, 'Create test draft');
      assert.equal(saved.revision, 1);
      const firstInsert = { ...draft, id: `race_${randomUUID()}`, slug: `race-${randomUUID()}` };
      const competing = await Promise.allSettled([
        saveArticle(actor, firstInsert, 0, 'First concurrent create'),
        saveArticle(actor, { ...firstInsert, title: 'Competing create' }, 0, 'Competing create'),
      ]);
      assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(
        competing.filter(
          (result) => result.status === 'rejected' && result.reason instanceof EditorialConflict,
        ).length,
        1,
      );
      await assert.rejects(
        saveArticle(actor, { ...draft, slug: 'new' }, 1, 'Reserved URL'),
        /reserved/,
      );

      const reopened = (await readArticle(id))!;
      assert.equal(reopened.draft.contributors[0]!.name, 'Gerald Dagher');
      assert.equal(reopened.draft.contributors[0]!.kind, 'person');
      await assert.rejects(
        saveArticle({ ...actor, role: 'security' }, draft, 1, 'Unauthorized draft'),
        /does not have/,
      );
      await assert.rejects(
        saveArticle(actor, { ...draft, title: 'Concurrent edit' }, 0, 'Stale edit'),
        EditorialConflict,
      );
      await reviewArticle(actor, id, 1, 'approved', 'Evidence, rights and prose checked', {
        facts: true,
        rights: true,
        prose: true,
      });
      const changed = await saveArticle(
        actor,
        { ...reopened.draft, title: 'Updated acceptance fixture' },
        1,
        'Edit after approval',
      );
      assert.equal(changed.revision, 2);
      assert.equal((await readArticle(id))!.review, null);
      await assert.rejects(publishArticle(actor, id, 2, 'Reject stale approval'), /needs approval/);
      await restoreArticle(actor, id, 1, 2, 'Recover revision');
      assert.equal((await readArticle(id))!.revision, 3);
      await reviewArticle(actor, id, 3, 'approved', 'Review restored fixture', {
        facts: true,
        rights: true,
        prose: true,
      });
      const base = `test_base_${randomUUID()}`;
      await pool.query(
        "INSERT INTO publication.releases(id,status,search_index_version) VALUES($1,'active','test')",
        [base],
      );
      await pool.query(
        "INSERT INTO published.active_release(id,release_id,activated_at) VALUES('active',$1,now()) ON CONFLICT(id) DO UPDATE SET release_id=$1",
        [base],
      );
      await pool.query(
        "INSERT INTO canonical.entities(id,kind,display_name) VALUES('ent_editorial_released_fixture','person','Released editorial test record') ON CONFLICT(id) DO NOTHING",
      );
      const projection = {
        id: 'ent_editorial_released_fixture',
        releaseId: base,
        kind: 'person',
        displayName: 'Released editorial test record',
        nameLower: 'released editorial test record',
        summary:
          'A controlled record for editorial acceptance, including article associations, citations, revision changes and public reading. This fixture makes no historical claim.',
        claims: [],
        related: [],
      };
      const seed = await pool.connect();
      try {
        await seed.query('BEGIN');
        await seed.query(
          "INSERT INTO published.search_index(id,release_id,entity_id,name,name_lower,kind,facets) VALUES($1,$2,$3,$4,$5,'person','{}')",
          [
            `${base}:${projection.id}`,
            base,
            projection.id,
            projection.displayName,
            projection.nameLower,
          ],
        );
        await seed.query(
          'INSERT INTO published.release_entities(release_id,entity_id,projection) VALUES($1,$2,$3::jsonb)',
          [base, projection.id, JSON.stringify(projection)],
        );
        await seed.query('COMMIT');
      } catch (error) {
        await seed.query('ROLLBACK');
        throw error;
      } finally {
        seed.release();
      }
      const mobileStore = createPoolPostgresReleaseStore(pool);
      await activateReleaseAsync(
        mobileStore,
        generateReleaseArtifacts({
          releaseId: base,
          generatedAt: new Date().toISOString(),
          mapEntities: [],
          redactLocation: redactLocationForPublic,
          contentIndex: [],
          entitiesList: [projection],
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
            legalVersions: { privacy: 'local-test' },
            cacheDirectives: {
              bootstrapMaxAgeSeconds: 60,
              bootstrapStaleWhileRevalidateSeconds: 600,
              releaseArtifactImmutableMaxAgeSeconds: 31536000,
            },
          },
        }),
      );
      const result = await publishArticle(actor, id, 3, 'Publish controlled test fixture');
      const row = await pool.query(
        'SELECT payload FROM published.release_articles WHERE release_id=$1 AND article_id=$2',
        [result.releaseId, id],
      );
      assert.equal(row.rows[0].payload.title, draft.title);
      assert.equal(row.rows[0].payload.contributors.length, 2);
      const manifest = await pool.query(
        'SELECT signed_manifest FROM publication.releases WHERE id=$1',
        [result.releaseId],
      );
      assert.ok(
        manifest.rows[0].signed_manifest.manifest.aggregateArtifacts.some((a: { path: string }) =>
          a.path.endsWith('/articles.json'),
        ),
      );

      const version = await saveArticle(
        actor,
        { ...reopened.draft, title: 'Corrected acceptance fixture' },
        3,
        'Correct the fixture',
      );
      await reviewArticle(actor, id, version.revision, 'approved', 'Review correction', {
        facts: true,
        rights: true,
        prose: true,
      });
      const trusted = process.env.EXPECTED_RELEASE_SIGNING_PUBLIC_KEY_SHA256;
      process.env.EXPECTED_RELEASE_SIGNING_PUBLIC_KEY_SHA256 = 'invalid';
      await assert.rejects(
        publishArticle(actor, id, version.revision, 'Fail closed on signing identity'),
        /signing identity/,
      );
      process.env.EXPECTED_RELEASE_SIGNING_PUBLIC_KEY_SHA256 = trusted;
      assert.equal(
        (await pool.query("SELECT release_id FROM published.active_release WHERE id='active'"))
          .rows[0].release_id,
        result.releaseId,
      );
      const correction = await publishArticle(actor, id, version.revision, 'Publish correction');
      const rollback = await rollbackArticle(
        actor,
        id,
        correction.releaseId,
        'Restore preceding article',
      );
      assert.equal(
        (
          await pool.query(
            'SELECT payload FROM published.release_articles WHERE release_id=$1 AND article_id=$2',
            [rollback.releaseId, id],
          )
        ).rows[0].payload.title,
        draft.title,
      );
      await assert.rejects(
        rollbackArticle(actor, id, correction.releaseId, 'Stale rollback'),
        EditorialConflict,
      );
      await assert.rejects(
        pool.query('DELETE FROM reference.article_revisions WHERE article_id=$1', [id]),
        /append only/,
      );
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE anon');
        await assert.rejects(
          client.query('SELECT * FROM reference.article_revisions'),
          /permission denied/,
        );
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } finally {
      await __resetPostgresPoolForTests();
    }
  },
);

test(
  'entity proposals preserve evidence, deny researcher approval and reject stale canonical snapshots',
  { skip: !connection },
  async () => {
    const { readEntityEditorial, proposeEntityEditorial, applyEntityEditorial } =
      await import('./entities');
    const pool = getPostgresPool(),
      uid = randomUUID(),
      id = `entity_editorial_${randomUUID()}`;
    const actor = { uid, email: 'local-editorial@example.test', role: 'admin' as const };
    try {
      await pool.query(
        'INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,\'{"app_role":"admin"}\')',
        [uid],
      );
      await pool.query(
        "INSERT INTO canonical.entities(id,kind,display_name) VALUES($1,'person','Controlled proposal record')",
        [id],
      );
      const initial = (await readEntityEditorial(id))!;
      const proposal = {
        entityId: id,
        beforeHash: initial.beforeHash,
        summary: 'Controlled summary with reviewed evidence.',
        historicalContext: 'Controlled context for an isolated test.',
        evidence: [
          {
            url: 'https://www.loc.gov/',
            title: 'Controlled evidence fixture',
            excerpt: 'This excerpt is a test fixture only.',
          },
        ],
        relationships: [
          {
            targetId: 'ent_editorial_released_fixture',
            predicate: 'related_to',
            statement: 'Controlled relationship statement.',
            evidenceIndex: 0,
          },
        ],
      };
      const saved = await proposeEntityEditorial(actor, proposal, 'Propose test prose');
      for (const dbRole of ['anon', 'authenticated']) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`SET LOCAL ROLE ${dbRole}`);
          try {
            const visible = await client.query(
              'SELECT id FROM submissions.intake_items WHERE id=$1',
              [saved.id],
            );
            assert.equal(visible.rows.length, 0, `${dbRole} must not read private proposals`);
            const changed = await client.query(
              "UPDATE submissions.intake_items SET status='rejected' WHERE id=$1 RETURNING id",
              [saved.id],
            );
            assert.equal(changed.rows.length, 0, `${dbRole} must not update private proposals`);
          } catch (error) {
            // A role with no schema/table privilege is also denied, before RLS is evaluated.
            assert.match(String(error), /permission denied/);
          }
          await client.query('ROLLBACK');
          await client.query('BEGIN');
          await client.query(`SET LOCAL ROLE ${dbRole}`);
          await assert.rejects(
            client.query('SELECT * FROM reference.articles'),
            /permission denied/,
          );
          await client.query('ROLLBACK');
          await client.query('BEGIN');
          await client.query(`SET LOCAL ROLE ${dbRole}`);
          await assert.rejects(
            client.query(
              "INSERT INTO submissions.intake_items(id,kind,payload,created_by) VALUES($1,'entity_editorial',$2::jsonb,'00000000-0000-4000-8000-000000000001')",
              [randomUUID(), JSON.stringify({ proposal })],
            ),
            /policy|permission denied/,
          );
          await client.query('ROLLBACK');
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
      }
      await assert.rejects(
        pool.query("UPDATE submissions.intake_items SET payload='{}'::jsonb WHERE id=$1", [
          saved.id,
        ]),
        /immutable/,
      );
      await assert.rejects(
        pool.query('DELETE FROM submissions.intake_items WHERE id=$1', [saved.id]),
        /review history/,
      );
      assert.equal(
        (
          await applyEntityEditorial(
            { ...actor, role: 'research' },
            saved.id,
            'Attempt unauthorized review',
          )
        ).status,
        'forbidden',
      );
      await pool.query('UPDATE canonical.entities SET display_name=$2 WHERE id=$1', [
        id,
        'A changed identity',
      ]);
      assert.equal(
        (await applyEntityEditorial(actor, saved.id, 'Reject stale proposal')).status,
        'failed',
      );
      const current = (await readEntityEditorial(id))!;
      const updated = await proposeEntityEditorial(
        actor,
        { ...proposal, beforeHash: current.beforeHash },
        'Propose against current record',
      );
      assert.equal(
        (await applyEntityEditorial(actor, updated.id, 'Evidence and relationship reviewed'))
          .status,
        'ok',
      );
      const applied = (await readEntityEditorial(id))!;
      assert.equal(applied.summary, proposal.summary);
      assert.equal(applied.relationships.length, 1);
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM canonical.entity_relationship_evidence e JOIN canonical.entity_relationships r ON r.id=e.relationship_id WHERE r.from_entity_id=$1',
            [id],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await __resetPostgresPoolForTests();
    }
  },
);

test(
  'image bytes and rights persist privately and publish from the approved revision',
  { skip: !connection },
  async () => {
    const { uploadEditorialMedia, readEditorialMedia } = await import('./media');
    const pool = getPostgresPool(),
      uid = randomUUID(),
      id = `media_editorial_${randomUUID()}`,
      actor = { uid, email: 'media-test@example.test', role: 'admin' as const };
    try {
      await pool.query(
        'INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,\'{"app_role":"admin"}\')',
        [uid],
      );
      const draft: ArticleDraft = {
        id,
        slug: `media-${randomUUID()}`,
        title: 'Controlled media fixture',
        summary: 'Controlled media acceptance test.',
        kind: 'article',
        publishedAt: '2026-10-14',
        eraLabel: 'Test',
        placeLabel: 'Isolated environment',
        body: [{ type: 'paragraph', text: 'Controlled media fixture. [ref:source]' }],
        references: [{ id: 'source', label: 'Library of Congress', url: 'https://www.loc.gov/' }],
        relatedEntityIds: [],
        tags: [],
        contributors: [
          { id: 'gerald-dagher', name: 'Gerald Dagher', kind: 'person', roles: ['author'] },
        ],
      };
      await saveArticle(actor, draft, 0, 'Create media test');
      const bytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      );
      const uploaded = await uploadEditorialMedia(
        actor,
        id,
        new File([bytes], 'fixture.png', { type: 'image/png' }),
        'Controlled test image',
        'public_domain',
      );
      const mediaId = new URL(uploaded.url).pathname.split('/').at(-1)!;
      assert.deepEqual(Buffer.from((await readEditorialMedia(mediaId))!.bytes), bytes);
      const metadata = (
        await pool.query('SELECT object_path FROM reference.editorial_media WHERE id=$1', [mediaId])
      ).rows[0];
      const unauthed = await fetch(
        `${process.env.SUPABASE_URL}/storage/v1/object/public/editorial-media/${metadata.object_path}`,
      );
      assert.equal(unauthed.ok, false);
      const image = {
        ...uploaded,
        rightsStatus: 'public_domain' as const,
        alt: 'Controlled one-pixel image fixture',
      };
      const next = await saveArticle(
        actor,
        { ...draft, heroImage: image, body: [...draft.body, { type: 'image', image }] },
        1,
        'Attach image and rights',
      );
      await reviewArticle(
        actor,
        id,
        next.revision,
        'approved',
        'Rights, evidence and prose reviewed',
        { facts: true, rights: true, prose: true },
      );
      const result = await publishArticle(actor, id, next.revision, 'Publish media fixture');
      const doc = (
        await pool.query(
          'SELECT payload FROM published.release_articles WHERE release_id=$1 AND article_id=$2',
          [result.releaseId, id],
        )
      ).rows[0].payload;
      assert.equal(doc.heroImage.credit, 'Controlled test image');
      assert.equal(doc.heroImage.url.includes('/public/public-media/'), true);
      assert.deepEqual(Buffer.from(await (await fetch(doc.heroImage.url)).arrayBuffer()), bytes);
    } finally {
      await __resetPostgresPoolForTests();
    }
  },
);
