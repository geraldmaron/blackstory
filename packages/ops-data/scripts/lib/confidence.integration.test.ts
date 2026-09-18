import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { loadReviewedClaimAssessments, assessPublicationClaims } from './confidence.ts';
import { loadPublicCitationArchives } from './citation-archive-publication.ts';

/** Use only an isolated, disposable local database. All fixtures roll back. */
test(
  'canonical review gates publication and new evidence invalidates approval',
  {
    skip: !process.env.RESEARCH_TEST_DATABASE_URL,
  },
  async () => {
    const connectionString = process.env.RESEARCH_TEST_DATABASE_URL!;
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname));
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
      SET LOCAL request.jwt.claims = '{"role":"service_role"}';
      INSERT INTO research.research_profiles
        (id,version,schema_version,checksum,profile,active)
      VALUES ('confidence-test','1.0.0','1.0.0',repeat('a',64),'{}',false);
      INSERT INTO research.cases (id,state,candidate_id,title,profile_id,profile_version,risk_class)
      VALUES ('confidence-case','candidate','candidate','Claim review','confidence-test','1.0.0','standard');
      INSERT INTO canonical.entities (id,kind,entity_class,display_name)
      VALUES ('confidence-entity','person','person','Test person');
      INSERT INTO canonical.claims (id,entity_id,claim_class,workflow_status)
      VALUES ('confidence-claim','confidence-entity','standard','accepted');
      INSERT INTO canonical.claim_versions (id,claim_id,predicate,object,workflow_status)
      VALUES ('confidence-version','confidence-claim','founded','"Founded in 1920"','accepted');
      UPDATE canonical.claims SET current_version_id='confidence-version' WHERE id='confidence-claim';
      INSERT INTO evidence.evidence_sources (id,display_name) VALUES ('confidence-source','Archive');
      INSERT INTO evidence.source_items (id,source_id,stable_identifier,url)
      VALUES ('confidence-item','confidence-source','item','https://example.org/record'),
        ('confidence-mirror','confidence-source','mirror','https://example.org/mirror');
      INSERT INTO evidence.source_captures (id,source_item_id,content_hash_algorithm,content_hash_digest)
      VALUES ('confidence-capture','confidence-mirror','sha256',repeat('c',64));
      INSERT INTO evidence.capture_origins
        (capture_id,source_item_id,source_url,final_url,storage_object,observed_at)
      VALUES ('confidence-capture','confidence-item','https://example.org/record','https://example.org/record','{}',now()),
        ('confidence-capture','confidence-mirror','https://example.org/mirror','https://example.org/mirror','{}',now());
      INSERT INTO evidence.evidence_selectors
        (id,capture_id,source_item_id,selector_type,conforms_to,exact_text,selector_hash)
      VALUES ('confidence-selector','confidence-capture','confidence-item','TextQuoteSelector',
        'http://www.w3.org/TR/annotation-model/','Founded in 1920',repeat('d',64));
      INSERT INTO evidence.lineage_clusters (id,root_capture_id,method_version,confidence,rationale)
      VALUES ('confidence-lineage','confidence-capture','v1',1,'Original');
      INSERT INTO canonical.evidence_assignments
        (id,claim_version_id,selector_id,role,fitness,entailment_probability,
         entailment_calibration_version,lineage_cluster_id,reviewer_actor_id,status)
      VALUES ('confidence-evidence','confidence-version','confidence-selector','supporting',
        'strong',0.99,'held-out-v1','confidence-lineage','reviewer','accepted');
      INSERT INTO canonical.claim_confidence_assessments
        (id,claim_version_id,acceptance_probability,interval_low,interval_high,
         source_reliability,entailment,independence,identity_confidence,relevance,
         research_completeness,calibration_version)
      VALUES ('confidence-assessment','confidence-version',0.95,0.8,0.99,0.9,0.99,0.8,0.99,1,0.9,'held-out-v1');
      INSERT INTO research.runs
        (id,case_id,profile_id,profile_version,policy_version,mode,status,started_at)
      VALUES ('confidence-run','confidence-case','confidence-test','1.0.0','1.0.0','quality-prose','running',now());
      INSERT INTO research.agent_activities
        (id,run_id,actor_id,actor_type,model_family,activity_type,started_at)
      VALUES ('confidence-activity','confidence-run','producer','model','producer-model','extract',now());
      SELECT research.submit_artifact('confidence-artifact','confidence-run','confidence-activity',
        'claim-assessment',repeat('e',64),'ClaimStatement','1.0.0','local://claim','{}','confidence-key');
      INSERT INTO research.artifact_claims (artifact_id,claim_version_id)
      VALUES ('confidence-artifact','confidence-version');
    `);
      assert.deepEqual(await loadReviewedClaimAssessments(client, ['confidence-entity']), []);
      await client.query(`SELECT research.approve_artifact('confidence-review','confidence-artifact',
      'reviewer','review-model','[]','held-out-v1')`);
      const reviewed = await loadReviewedClaimAssessments(client, ['confidence-entity']);
      assert.equal(reviewed.length, 1);
      assert.deepEqual(reviewed[0]!.citationHrefs, ['https://example.org/record']);
      assert.deepEqual(reviewed[0]!.reviewedEvidenceCaptures, [
        {
          sourceUrl: 'https://example.org/record',
          sourceItemId: 'confidence-item',
          captureId: 'confidence-capture',
          contentHashDigest: 'c'.repeat(64),
        },
      ]);
      const preservationDecision = {
        sourceUrl: 'https://example.org/record',
        allowTextRetention: false,
        allowArchive: true,
        sensitivity: 'public',
        reviewedBy: 'reviewer',
        reviewedAt: '2026-09-01T00:00:00.000Z',
        expiresAt: '2027-09-01T00:00:00.000Z',
        basis: 'Public archival record approved for preservation.',
      };
      await client.query(
        `UPDATE evidence.capture_origins
         SET storage_object=jsonb_build_object('preservationDecision',$1::jsonb)
         WHERE capture_id='confidence-capture' AND source_item_id='confidence-item'`,
        [JSON.stringify(preservationDecision)],
      );
      await client.query(
        `INSERT INTO research.preservation_jobs
          (source_url,content_hash_digest,state,decision,job_id,result)
         VALUES ($1,$2,'anchored',$3::jsonb,'confidence-job',$4::jsonb)`,
        [
          'https://example.org/record',
          'c'.repeat(64),
          JSON.stringify(preservationDecision),
          JSON.stringify({
            status: 'anchored',
            waybackCaptureUrl:
              'https://web.archive.org/web/20260902000000/https://example.org/record',
            waybackCapturedAt: '2026-09-02T00:00:00.000Z',
          }),
        ],
      );
      await client.query(
        `INSERT INTO evidence.source_captures
          (id,source_item_id,content_hash_algorithm,content_hash_digest)
         VALUES ('confidence-unreviewed-capture','confidence-item','sha256',repeat('d',64))`,
      );
      await client.query(
        `INSERT INTO evidence.capture_origins
          (capture_id,source_item_id,source_url,final_url,storage_object,observed_at)
         VALUES ('confidence-unreviewed-capture','confidence-item',$1,$1,
           jsonb_build_object('preservationDecision',$2::jsonb),now())`,
        ['https://example.org/record', JSON.stringify(preservationDecision)],
      );
      await client.query(
        `INSERT INTO research.preservation_jobs
          (source_url,content_hash_digest,state,decision,job_id,result)
         VALUES ($1,repeat('d',64),'anchored',$2::jsonb,'confidence-unreviewed-job',$3::jsonb)`,
        [
          'https://example.org/record',
          JSON.stringify(preservationDecision),
          JSON.stringify({
            status: 'anchored',
            waybackCaptureUrl:
              'https://web.archive.org/web/20260903000000/https://example.org/record',
            waybackCapturedAt: '2026-09-03T00:00:00.000Z',
          }),
        ],
      );
      const reviewedCaptures = reviewed.flatMap((claim) =>
        claim.reviewedEvidenceCaptures.map((capture) => ({
          claimId: claim.claimId,
          sourceUrl: capture.sourceUrl,
          sourceItemId: capture.sourceItemId,
          captureId: capture.captureId,
          contentHashDigest: capture.contentHashDigest,
        })),
      );
      const archives = await loadPublicCitationArchives(
        client,
        reviewedCaptures,
        '2026-09-18T12:00:00.000Z',
      );
      assert.equal(
        archives.get('confidence-claim\u001fhttps://example.org/record')?.archivedAt,
        '2026-09-02T00:00:00.000Z',
      );
      await client.query(
        `UPDATE evidence.capture_origins SET retention_revoked_at=now()
         WHERE capture_id='confidence-capture' AND source_item_id='confidence-item'`,
      );
      assert.equal(
        (
          await loadPublicCitationArchives(client, reviewedCaptures, '2026-09-18T12:00:00.000Z', {
            lock: true,
          })
        ).size,
        0,
      );
      const result = assessPublicationClaims(
        {
          id: 'confidence-entity',
          claims: [
            {
              predicate: 'founded',
              object: 'Founded in 1920',
              citationHref: 'https://example.org/record',
              confidenceLevel: 'high',
              citationLabel: 'Record',
              citationSource: 'Archive',
            },
          ],
        },
        reviewed,
      );
      assert.ok(result.ok);
      assert.equal(result.reviewBasis, 'independent_review');
      assert.equal('score' in result, false);
      await client.query('SAVEPOINT origin_check');
      await assert.rejects(
        client.query(`INSERT INTO evidence.evidence_selectors
        (id,capture_id,source_item_id,selector_type,conforms_to,exact_text,selector_hash)
        VALUES ('wrong-origin','confidence-capture','missing-origin','TextQuoteSelector',
          'http://www.w3.org/TR/annotation-model/','Founded in 1920',repeat('f',64))`),
        /foreign key/,
      );
      await client.query('ROLLBACK TO SAVEPOINT origin_check');
      for (const sql of [
        "UPDATE canonical.claim_confidence_assessments SET interval_low=0.9 WHERE id='confidence-assessment'",
        "UPDATE evidence.evidence_selectors SET exact_text='Changed' WHERE id='confidence-selector'",
        "DELETE FROM research.artifact_claims WHERE artifact_id='confidence-artifact'",
      ]) {
        await client.query('SAVEPOINT immutable_check');
        await assert.rejects(client.query(sql), /append-only|immutable/);
        await client.query('ROLLBACK TO SAVEPOINT immutable_check');
      }
      await client.query(`INSERT INTO canonical.evidence_assignments
      (id,claim_version_id,selector_id,role,fitness,entailment_probability,
       entailment_calibration_version,lineage_cluster_id,reviewer_actor_id,status)
      VALUES ('confidence-contradiction','confidence-version','confidence-selector','contradicting',
        'strong',0.9,'held-out-v1','confidence-lineage','reviewer','proposed')`);
      assert.deepEqual(await loadReviewedClaimAssessments(client, ['confidence-entity']), []);
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  },
);
