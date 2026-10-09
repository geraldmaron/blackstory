import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { getOpsPostgresPool } from '@repo/data-access';
import { ManagementWorkStore } from '@repo/ops-data/management';
import { dispatchManagementWork } from '@repo/ops-data/management/dispatch';
import { assertContract } from '@repo/research-kernel';
import { sessionManagementResearch } from './management-session.js';

const connectionString = process.env.BLACKSTORY_TEST_DATABASE_URL;
test(
  'session tools checkpoint evidence, resume, reject unsupported prose and save an approvable proposal without hosted credentials',
  { skip: !connectionString },
  async () => {
    const pool = getOpsPostgresPool({ DATABASE_URL: connectionString, DATABASE_POOL_MAX: '1' });
    const store = new ManagementWorkStore(pool);
    const actor = { ownerId: randomUUID(), canResearch: true, canPublish: true };
    const runIds: string[] = [];
    try {
      await pool.query(
        `INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,'{"app_role":"admin"}')`,
        [actor.ownerId],
      );
      assert.equal(
        (await pool.query("SELECT pg_has_role('research_worker','admin_app','member') AS elevated"))
          .rows[0].elevated,
        false,
      );
      await pool.query('SET SESSION AUTHORIZATION admin_app');
      assert.equal((await pool.query('SELECT session_user AS role')).rows[0].role, 'admin_app');
      const work = await store.submit(actor, {
        request: 'Research the documented school',
        sessionId: 'first',
        harness: 'any-harness',
        idempotencyKey: randomUUID(),
      });
      let dispatched = false;
      assert.equal(
        await dispatchManagementWork(store, work.id, async () => {
          dispatched = true;
        }),
        false,
      );
      assert.equal(dispatched, false);
      assert.equal((await store.get(actor, work.id))!.error, null);
      await assert.rejects(
        sessionManagementResearch(store, { ...actor, ownerId: randomUUID() }, work.id, {
          action: 'start',
          sessionId: 'first',
        }),
        /not found/,
      );
      await assert.rejects(
        sessionManagementResearch(store, { ...actor, canResearch: false }, work.id, {
          action: 'start',
          sessionId: 'first',
        }),
        /permission/,
      );
      let sessionId = 'first';
      let started = await sessionManagementResearch(store, actor, work.id, {
        action: 'start',
        sessionId,
      });
      assert.ok('lease' in started && started.lease);
      let lease = started.lease;
      runIds.push(String(started.runId));
      const next = () =>
        sessionManagementResearch(store, actor, work.id, { action: 'next', sessionId, lease });
      const complete = async (taskLease: unknown, output: unknown) => {
        const result = await sessionManagementResearch(store, actor, work.id, {
          action: 'complete',
          sessionId,
          lease,
          taskLease,
          output: JSON.stringify(output),
        });
        assert.ok('receipt' in result && result.receipt);
        return result.receipt;
      };
      let step = await next();
      assert.ok('taskLease' in step && step.taskLease);
      const plan = {
        interpretation: 'One documented school.',
        subjects: ['School'],
        queries: [
          {
            query: 'School archival history contradictory dates',
            seeking: 'School site and counterevidence',
            sourceFitnessReason: 'District and archival records document the site.',
            collectionPolicies: [],
            counterevidence: true,
          },
        ],
        limitations: [],
      };
      assert.equal((await complete(step.taskLease, plan)).valid, true);
      assert.equal((await complete(step.taskLease, plan)).valid, true);
      step = await next();
      assert.ok('taskLease' in step && step.taskLease);
      const urls = [
        'https://archive.example.gov/session-school',
        'https://district.example.org/session-school',
      ];
      const quote =
        'The district operated the school at this site during the period documented in the archival record.';
      assert.equal(
        (
          await complete(step.taskLease, {
            query: plan.queries[0]!.query,
            seeking: 'Identity and dates',
            leads: urls.map((url) => ({ url, title: 'School record', snippet: '' })),
            limitations: [],
          })
        ).valid,
        true,
      );
      // A stopped session relinquishes its work lease; the next session resumes the same ledger.
      await pool.query(
        `UPDATE research.management_work SET lease_until=now()-interval '1 second' WHERE id=$1`,
        [work.id],
      );
      sessionId = 'resumed';
      started = await sessionManagementResearch(store, actor, work.id, {
        action: 'start',
        sessionId,
      });
      assert.ok('lease' in started && started.lease);
      lease = started.lease;
      assert.equal(started.runId, runIds[0]);
      step = await next();
      assert.ok('taskLease' in step && step.taskLease);
      assert.equal(step.taskLease.task.outputContract, 'ResearchAcquisitionResult');
      await assert.rejects(
        sessionManagementResearch(store, actor, work.id, {
          action: 'complete',
          sessionId: 'other-session',
          lease,
          taskLease: step.taskLease,
          output: '{}',
        }),
        /another work request or session/,
      );
      const now = new Date().toISOString();
      const acquisition = {
        sources: urls.map((url, i) => ({
          id: `source-${i}`,
          connectorKind: 'browser',
          title: 'School record',
          description: quote,
          excerpts: [
            { exact: quote, locator: 'Page 2' },
            { exact: 'The register covers the autumn term.', locator: 'Page 3, heading' },
          ],
          cites: [url],
          rawRecord: {
            sessionObservation: {
              tool: 'browser.open',
              reference: `source-${i} page 2`,
              retrievedAt: now,
            },
            preservationDecision: {
              sourceUrl: url,
              allowTextRetention: true,
              allowArchive: false,
              sensitivity: 'public',
              reviewedBy: 'session',
              reviewedAt: now,
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
              basis:
                'Published factual school history; a short necessary quotation for private verification, without sensitive personal information or substitution for the source.',
            },
          },
        })),
        limitations: [],
      };
      assert.equal((await complete(step.taskLease, acquisition)).valid, true);
      assert.equal((await complete(step.taskLease, acquisition)).valid, true);
      step = await next();
      assert.ok('taskLease' in step && step.taskLease);
      const retained = assertContract(
        'ResearchAcquisitionResult',
        step.taskLease.dependencies.find((d) => d.taskId.endsWith('-2'))!.output,
      );
      assert.ok(
        retained.sources.every(
          (source) =>
            source.description.includes('[Page 2]') &&
            source.description.includes('[Page 3, heading]'),
        ),
      );
      const entityId = `session-test-${randomUUID()}`;
      const proposal = {
        summary: 'Create one sourced school record.',
        interpretation: plan.interpretation,
        held: [],
        researchRunIds: [],
        changes: [
          {
            entityId,
            operation: 'create',
            beforeHash: null,
            record: {
              entityId,
              displayName: 'Documented school',
              summary: quote,
              jurisdiction: 'Atlanta, Georgia',
              topicIds: ['education'],
              topicTags: ['education'],
              eraBuckets: ['1920s'],
              sources: urls.map((url) => ({
                url,
                title: 'School record',
                excerpt: quote,
                fitness: 'strong',
              })),
            },
            assertions: [
              {
                id: 'school-site',
                statement: quote,
                finding: 'supported',
                reasoning: 'The exact passages support the school site.',
                counterevidenceSearch:
                  'Compared district and archive names and periods; no conflict found in these fixtures.',
                evidence: retained.sources.map((source) => ({
                  sourceUrl: source.cites[0],
                  title: source.title,
                  quote,
                  locator: 'Page 2',
                  contentHash: source.rawRecord.contentHash,
                  retrievedAt: now,
                  fitness: 'strong',
                  fitnessReason: 'Period school record',
                  lineage: source.cites[0],
                  limitations: [],
                })),
              },
            ],
            sentenceClaims: [{ sentence: quote, assertionIds: ['school-site'] }],
            identityReview: 'Compared school names and location.',
            proseReview: 'Each sentence has attached evidence.',
            rightsReview: 'Short factual citation excerpts only.',
            reviewBasis: 'self_review',
            producerActorId: 'session',
            reviewerActorId: 'session',
            blockers: [],
            omissions: [],
          },
        ],
      };
      const unsupported = structuredClone(proposal);
      unsupported.changes[0]!.assertions[0]!.evidence[0]!.quote =
        'An invented firstness claim absent from the sources.';
      assert.equal((await complete(step.taskLease, unsupported)).valid, false);
      const deferred = await next();
      assert.ok('waiting' in deferred && deferred.waiting);
      await pool.query(
        "UPDATE research.frontier_tasks SET available_at=now() WHERE run_id=$1 AND status='failed'",
        [runIds[0]],
      );
      step = await next();
      assert.ok('taskLease' in step && step.taskLease);
      assert.equal((await complete(step.taskLease, proposal)).valid, true);
      step = await next();
      assert.ok('taskLease' in step && step.taskLease);
      assert.equal(step.taskLease.task.input.action, 'review');
      assert.equal((await complete(step.taskLease, proposal)).valid, true);
      const ready = await next();
      assert.ok('work' in ready && ready.work);
      assert.equal(ready.work.state, 'awaiting_review');
      assert.deepEqual(ready.work.proposal!.researchRunIds, runIds);
      assert.equal(await store.claim(work.id, 'publish'), null);
      const approved = await store.decide(actor, work.id, {
        version: ready.work.version,
        proposalHash: ready.work.proposalHash,
        action: 'approve',
        entityIds: [entityId],
        reason: 'Publish this exact proposal.',
        sessionId,
        idempotencyKey: randomUUID(),
      });
      assert.equal(approved.state, 'approved');
      assert.equal(
        await dispatchManagementWork(store, work.id, async () => {
          dispatched = true;
        }),
        false,
      );
      assert.equal(dispatched, false);
      assert.ok(await store.claim(work.id, 'publish'));
    } finally {
      // Preserve append-only evidence for inspection in this disposable integration database.
      await pool.end();
    }
  },
);
