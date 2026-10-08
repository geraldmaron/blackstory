import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { ManagementWorkStore, workDigest } from './work-store.js';
import { dispatchManagementWork } from './dispatch.js';

const connectionString = process.env.BLACKSTORY_TEST_DATABASE_URL;
test(
  'durable work: ownership, duplicate delivery, leases, approvals, revocation and failed dispatch',
  { skip: !connectionString },
  async () => {
    const pool = new pg.Pool({ connectionString, max: 4 });
    const store = new ManagementWorkStore(pool);
    const ownerId = randomUUID();
    const actor = { ownerId, canPublish: true, canResearch: true };
    try {
      await pool.query(
        'INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,\'{"app_role":"admin"}\')',
        [ownerId],
      );
      const input = {
        request: 'Research one named school',
        sessionId: 'test',
        harness: 'integration',
        executionMode: 'hosted',
        idempotencyKey: randomUUID(),
      };
      const [one, two] = await Promise.all([
        store.submit(actor, input),
        store.submit(actor, input),
      ]);
      assert.equal(one.id, two.id);
      assert.equal(await store.get({ ...actor, ownerId: randomUUID() }, one.id), null);
      await assert.rejects(
        store.submit(actor, { ...input, request: 'Another scope' }),
        /different content/,
      );
      let dispatched = 0;
      await Promise.all([
        dispatchManagementWork(store, one.id, async () => {
          dispatched++;
        }),
        dispatchManagementWork(store, one.id, async () => {
          dispatched++;
        }),
      ]);
      assert.equal(dispatched, 1);
      const claims = await Promise.all([
        store.claim(one.id, 'research'),
        store.claim(one.id, 'research'),
      ]);
      assert.equal(claims.filter(Boolean).length, 1);
      const claim = claims.find(Boolean)!;
      assert.equal(await store.claim(one.id, 'publish'), null);
      const quote =
        'The district operated this school at the documented site during the period covered by this archival record.';
      const sources = [
        'https://archive.example.gov/record',
        'https://district.example.org/history',
      ];
      const proposal = {
        summary: 'Create a documented school.',
        interpretation: input.request,
        held: [],
        researchRunIds: [],
        changes: [
          {
            entityId: `test-${randomUUID()}`,
            operation: 'create',
            beforeHash: null,
            record: {
              entityId: '',
              displayName: 'Documented school',
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
                id: 'site',
                statement: quote,
                finding: 'supported',
                reasoning: 'Exact attributed record passage.',
                counterevidenceSearch: 'Compared dates and names in the cited records.',
                evidence: sources.map((sourceUrl) => ({
                  sourceUrl,
                  title: 'School record',
                  quote,
                  locator: 'Page 2',
                  contentHash: 'a'.repeat(64),
                  retrievedAt: new Date().toISOString(),
                  fitness: 'strong',
                  fitnessReason: 'Period school record',
                  lineage: sourceUrl,
                  limitations: [],
                })),
              },
            ],
            sentenceClaims: [{ sentence: quote, assertionIds: ['site'] }],
            identityReview: 'Checked names and location.',
            proseReview: 'Exact assertion wording.',
            rightsReview: 'Citation excerpts.',
            reviewBasis: 'self_review',
            producerActorId: 'worker',
            reviewerActorId: 'worker',
            blockers: [],
            omissions: [],
          },
        ],
      };
      proposal.changes[0]!.record.entityId = proposal.changes[0]!.entityId;
      await assert.rejects(store.saveProposal(one.id, randomUUID(), proposal), /lease/);
      await store.saveProposal(one.id, claim.lease, proposal);
      const current = (await store.get(actor, one.id))!;
      const decision = {
        version: current.version,
        proposalHash: current.proposalHash!,
        action: 'approve',
        entityIds: [proposal.changes[0]!.entityId],
        reason: 'Publish the displayed change',
        sessionId: 'test',
        idempotencyKey: randomUUID(),
      };
      await assert.rejects(
        store.decide({ ...actor, canPublish: false }, one.id, decision),
        /permission/,
      );
      await assert.rejects(
        store.decide(actor, one.id, { ...decision, proposalHash: 'f'.repeat(64) }),
        /changed/,
      );
      assert.equal((await store.decide(actor, one.id, decision)).state, 'approved');
      assert.equal((await store.decide(actor, one.id, decision)).state, 'approved');
      await assert.rejects(
        store.decide(actor, one.id, { ...decision, reason: 'Different' }),
        /different content/,
      );
      await assert.rejects(
        pool.query('UPDATE research.management_work_proposals SET proposal=$2 WHERE work_id=$1', [
          one.id,
          {},
        ]),
        /append|immutable/i,
      );
      await assert.rejects(
        pool.query('DELETE FROM research.management_work_decisions WHERE work_id=$1', [one.id]),
        /append|immutable/i,
      );
      assert.equal(workDigest(current.proposal), current.proposalHash);
      const held = await store.decide(actor, one.id, {
        ...decision,
        action: 'hold',
        idempotencyKey: randomUUID(),
      });
      assert.equal(held.state, 'held');
      assert.equal(await store.claim(one.id, 'publish'), null);
      const agent = { ...actor, clientId: 'integration-client' };
      await assert.rejects(
        store.decide(agent, one.id, { ...decision, idempotencyKey: randomUUID() }),
        /delegation/,
      );
      const delegation = await pool.query(
        `INSERT INTO research.management_delegations(owner_id,client_id,session_id,expires_at)
      VALUES($1,$2,'test',now()+interval '1 hour') RETURNING id`,
        [ownerId, agent.clientId],
      );
      await pool.query('UPDATE research.management_delegations SET revoked_at=now() WHERE id=$1', [
        delegation.rows[0].id,
      ]);
      await assert.rejects(
        store.decide(agent, one.id, {
          ...decision,
          delegationId: delegation.rows[0].id,
          idempotencyKey: randomUUID(),
        }),
        /delegation/,
      );
      const another = await store.submit(actor, { ...input, idempotencyKey: randomUUID() });
      assert.equal(
        await dispatchManagementWork(store, another.id, async () => {
          throw new Error('offline');
        }),
        false,
      );
      assert.equal((await store.get(actor, another.id))!.dispatchStatus, 'failed');
      assert.equal(await dispatchManagementWork(store, another.id, async () => {}), true);
      const revisionWork = await store.submit(actor, { ...input, idempotencyKey: randomUUID() });
      const twoChanges = structuredClone(proposal);
      const otherChange = structuredClone(twoChanges.changes[0]!);
      otherChange.entityId = `test-${randomUUID()}`;
      otherChange.record.entityId = otherChange.entityId;
      twoChanges.changes.push(otherChange);
      const initialLease = await store.claim(revisionWork.id, 'research');
      await store.saveProposal(revisionWork.id, initialLease!.lease, twoChanges);
      const firstReview = (await store.get(actor, revisionWork.id))!;
      const approval = {
        ...decision,
        version: firstReview.version,
        proposalHash: firstReview.proposalHash!,
        idempotencyKey: randomUUID(),
      };
      await store.decide(actor, revisionWork.id, approval);
      await store.decide(actor, revisionWork.id, {
        ...approval,
        action: 'request_changes',
        entityIds: [otherChange.entityId],
        reason: 'Revise only the second record',
        idempotencyKey: randomUUID(),
      });
      const revisionLease = await store.claim(revisionWork.id, 'research');
      const changed = structuredClone(twoChanges);
      changed.changes[0]!.record.summary = 'A worker tried to rewrite already approved content.';
      changed.changes[0]!.sentenceClaims[0]!.sentence = changed.changes[0]!.record.summary;
      await store.saveProposal(revisionWork.id, revisionLease!.lease, changed);
      const secondReview = (await store.get(actor, revisionWork.id))!;
      assert.deepEqual(
        secondReview.proposal!.changes.find((c) => c.entityId === approval.entityIds[0]),
        firstReview.proposal!.changes[0],
      );
      assert.deepEqual(secondReview.approvedEntityIds, approval.entityIds);
      assert.equal((await store.claim(revisionWork.id, 'publish'))!.work.state, 'publishing');

      const allHeld = await store.submit(actor, { ...input, idempotencyKey: randomUUID() });
      const heldLease = await store.claim(allHeld.id, 'research');
      await store.saveProposal(allHeld.id, heldLease!.lease, {
        summary: 'No changes can be supported yet.',
        interpretation: input.request,
        changes: [],
        held: [{ subject: 'School', reason: 'The sources identify different institutions.' }],
        researchRunIds: [],
      });
      const heldReview = (await store.get(actor, allHeld.id))!;
      const heldDecision = {
        ...decision,
        version: heldReview.version,
        proposalHash: heldReview.proposalHash!,
        entityIds: [],
        idempotencyKey: randomUUID(),
      };
      await assert.rejects(store.decide(actor, allHeld.id, heldDecision));
      assert.equal(
        (await store.decide(actor, allHeld.id, { ...heldDecision, action: 'hold' })).state,
        'held',
      );
      assert.equal(await store.claim(allHeld.id, 'publish'), null);
      assert.equal(
        (
          await store.decide(actor, allHeld.id, {
            ...heldDecision,
            action: 'request_changes',
            idempotencyKey: randomUUID(),
          })
        ).state,
        'queued',
      );
      assert.ok(await store.claim(allHeld.id, 'research'));

      const expired = await store.submit(actor, { ...input, idempotencyKey: randomUUID() });
      const expiredLease = (await store.claim(expired.id, 'research'))!;
      await assert.rejects(
        store.saveProposal(expired.id, expiredLease.lease, {
          ...proposal,
          researchRunIds: ['missing-research-run'],
        }),
        /expired|unavailable/,
      );
      await store.saveProposal(expired.id, expiredLease.lease, proposal);
      const expiring = (await store.get(actor, expired.id))!;
      await assert.rejects(
        pool.query(
          'UPDATE research.management_work_proposals SET proposal=NULL,payload_disposed_at=now() WHERE work_id=$1',
          [expired.id],
        ),
        /immutable/,
      );
      // Insert an expired immutable revision as a historical fixture; ordinary writes cannot age it.
      await pool.query(
        `INSERT INTO research.management_work_proposals(work_id,version,proposal_hash,proposal,created_at)
        SELECT work_id,version+1,proposal_hash,proposal,now()-interval '31 days'
        FROM research.management_work_proposals WHERE work_id=$1`,
        [expired.id],
      );
      await pool.query('UPDATE research.management_work SET version=version+1 WHERE id=$1', [
        expired.id,
      ]);
      assert.equal((await store.get(actor, expired.id))!.proposal, null);
      assert.equal((await store.list(actor)).find((w) => w.id === expired.id)!.proposal, null);
      await assert.rejects(
        store.decide(actor, expired.id, {
          ...decision,
          version: expiring.version + 1,
          proposalHash: expiring.proposalHash,
          idempotencyKey: randomUUID(),
        }),
        /expired/,
      );
      await pool.query('SELECT research.dispose_expired_management_proposals(true)');
      const disposed = await pool.query(
        'SELECT proposal,proposal_hash,payload_disposed_at FROM research.management_work_proposals WHERE work_id=$1 AND version=$2',
        [expired.id, expiring.version + 1],
      );
      assert.equal(disposed.rows[0].proposal, null);
      assert.equal(disposed.rows[0].proposal_hash, expiring.proposalHash);
      assert.ok(disposed.rows[0].payload_disposed_at);
      assert.equal((await store.get(actor, expired.id))!.state, 'held');
      await store.retry(actor, expired.id);
      assert.equal((await store.get(actor, expired.id))!.state, 'queued');
      assert.ok(await store.claim(expired.id, 'research'));

      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query('SET LOCAL ROLE research_worker');
        await assert.rejects(
          db.query("UPDATE research.management_work SET state='approved' WHERE id=$1", [
            another.id,
          ]),
          /cannot authorize/,
        );
        await db.query('ROLLBACK');
        await db.query('BEGIN');
        await db.query('SET LOCAL ROLE anon');
        await assert.rejects(
          db.query('SELECT * FROM research.management_work'),
          /permission denied/,
        );
        await db.query('ROLLBACK');
      } finally {
        db.release();
      }
    } finally {
      await pool.end();
    }
  },
);
