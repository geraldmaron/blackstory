import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import {
  assertReviewedPublicationAnchors,
  publicationAssertionDigest,
} from './reviewed-anchors.js';

test(
  'publication binds exact content, reviewed selectors, current review and work lineage',
  {
    skip: !process.env.RESEARCH_TEST_DATABASE_URL,
  },
  async () => {
    const connectionString = process.env.RESEARCH_TEST_DATABASE_URL!;
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname));
    const db = new pg.Client({ connectionString });
    await db.connect();
    const assertion = { type: 'stat', estimate: 5, caption: 'Five recorded pupils' };
    const anchor = {
      url: 'https://example.org/record',
      claimId: 'anchors-claim',
      claimVersionId: 'anchors-version',
      selectorId: 'anchors-selector',
    };
    try {
      await db.query('BEGIN');
      await db.query(`      SET LOCAL request.jwt.claims = '{"role":"service_role"}';
      INSERT INTO research.research_profiles
        (id,version,schema_version,checksum,profile,active)
      VALUES ('anchors-test','1.0.0','1.0.0',repeat('a',64),'{}',false);
      INSERT INTO research.cases (id,state,candidate_id,title,profile_id,profile_version,risk_class)
      VALUES ('anchors-case','candidate','candidate','Claim review','anchors-test','1.0.0','standard');
      INSERT INTO canonical.entities (id,kind,entity_class,display_name)
      VALUES ('anchors-entity','person','person','Test person');
      INSERT INTO canonical.claims (id,entity_id,claim_class,workflow_status)
      VALUES ('anchors-claim','anchors-entity','standard','accepted');
      INSERT INTO canonical.claim_versions (id,claim_id,predicate,object,workflow_status)
      VALUES ('anchors-version','anchors-claim','publication_assertion_sha256','"${publicationAssertionDigest(assertion)}"','accepted');
      UPDATE canonical.claims SET current_version_id='anchors-version' WHERE id='anchors-claim';
      INSERT INTO evidence.evidence_sources (id,display_name) VALUES ('anchors-source','Archive');
      INSERT INTO evidence.source_items (id,source_id,stable_identifier,url)
      VALUES ('anchors-item','anchors-source','item','https://example.org/record'),
        ('anchors-mirror','anchors-source','mirror','https://example.org/mirror');
      INSERT INTO evidence.source_captures (id,source_item_id,content_hash_algorithm,content_hash_digest)
      VALUES ('anchors-capture','anchors-mirror','sha256',repeat('c',64));
      INSERT INTO evidence.capture_origins
        (capture_id,source_item_id,source_url,final_url,storage_object,observed_at)
      VALUES ('anchors-capture','anchors-item','https://example.org/record','https://example.org/record','{}',now()),
        ('anchors-capture','anchors-mirror','https://example.org/mirror','https://example.org/mirror','{}',now());
      INSERT INTO evidence.evidence_selectors
        (id,capture_id,source_item_id,selector_type,conforms_to,exact_text,selector_hash)
      VALUES ('anchors-selector','anchors-capture','anchors-item','TextQuoteSelector',
        'http://www.w3.org/TR/annotation-model/','Five recorded pupils',repeat('d',64));
      INSERT INTO evidence.lineage_clusters (id,root_capture_id,method_version,confidence,rationale)
      VALUES ('anchors-lineage','anchors-capture','v1',1,'Original');
      INSERT INTO canonical.evidence_assignments
        (id,claim_version_id,selector_id,role,fitness,entailment_probability,
         entailment_calibration_version,lineage_cluster_id,reviewer_actor_id,status,assessment_basis,fitness_reason,support_reason)
      VALUES ('anchors-evidence','anchors-version','anchors-selector','supporting',
        'strong',NULL,NULL,'anchors-lineage','reviewer','accepted','qualitative_review','Contemporaneous class register records enrollment','Exact count of recorded pupils; no wider enrollment claim');
      INSERT INTO research.runs
        (id,case_id,profile_id,profile_version,policy_version,mode,status,started_at)
      VALUES ('anchors-run','anchors-case','anchors-test','1.0.0','1.0.0','quality-prose','running',now());
      INSERT INTO research.agent_activities
        (id,run_id,actor_id,actor_type,model_family,activity_type,started_at)
      VALUES ('anchors-activity','anchors-run','producer','model','producer-model','extract',now());
      SELECT research.submit_artifact('anchors-artifact','anchors-run','anchors-activity',
        'claim-assessment',repeat('e',64),'ClaimStatement','1.0.0','local://claim','{}','anchors-key');
      INSERT INTO research.artifact_claims (artifact_id,claim_version_id)
      VALUES ('anchors-artifact','anchors-version');
`);
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [anchor], false),
        /current accepted/,
      );
      // A second model family is insufficient; the compatible old call cannot claim independent review.
      await db.query(
        "SELECT research.approve_artifact('anchors-old-review','anchors-artifact','reviewer','other-model','[]','v1')",
      );
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [anchor], false),
        /current accepted/,
      );
      await db.query(
        "SELECT research.approve_artifact('anchors-review','anchors-artifact','reviewer','producer-model','[]','v1','independent_review','Separate researcher inspected raw documents before the producer conclusions')",
      );
      await assertReviewedPublicationAnchors(db, assertion, [anchor], false);
      await assert.rejects(
        assertReviewedPublicationAnchors(
          db,
          { ...assertion, caption: 'The first five pupils' },
          [anchor],
          false,
        ),
        /exact publication assertion/,
      );
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [anchor]),
        /independently derived/,
      );
      await assert.rejects(
        assertReviewedPublicationAnchors(
          db,
          assertion,
          [{ ...anchor, url: 'https://example.org/mirror' }],
          false,
        ),
        /exact publication assertion/,
      );
      // Two independently authored works held by the same archive may corroborate.
      await db.query(`
      INSERT INTO evidence.source_items(id,source_id,stable_identifier,url) VALUES ('anchors-second-item','anchors-source','second','https://example.org/second');
      INSERT INTO evidence.source_captures(id,source_item_id,content_hash_algorithm,content_hash_digest) VALUES ('anchors-second-capture','anchors-second-item','sha256',repeat('f',64));
      INSERT INTO evidence.capture_origins(capture_id,source_item_id,source_url,final_url,storage_object,observed_at) VALUES ('anchors-second-capture','anchors-second-item','https://example.org/second','https://example.org/second','{}',now());
      INSERT INTO evidence.evidence_selectors(id,capture_id,source_item_id,selector_type,conforms_to,exact_text,selector_hash) VALUES ('anchors-second-selector','anchors-second-capture','anchors-second-item','TextQuoteSelector','http://www.w3.org/TR/annotation-model/','Five pupils',repeat('e',64));
      INSERT INTO evidence.lineage_clusters(id,root_capture_id,method_version,confidence,rationale) VALUES ('anchors-second-lineage','anchors-second-capture','v1',1,'Independently authored district ledger; first document was a newspaper report');
      INSERT INTO canonical.evidence_assignments(id,claim_version_id,selector_id,role,fitness,entailment_probability,entailment_calibration_version,lineage_cluster_id,reviewer_actor_id,status,assessment_basis,fitness_reason,support_reason) VALUES ('anchors-second-assignment','anchors-version','anchors-second-selector','supporting','strong',NULL,NULL,'anchors-second-lineage','reviewer','accepted','qualitative_review','Independent period account','States the count within the same period');
    `);
      const second = {
        ...anchor,
        url: 'https://example.org/second',
        selectorId: 'anchors-second-selector',
      };
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [anchor, second]),
        /current accepted/,
      );
      await db.query(
        "SELECT research.approve_artifact('anchors-second-review','anchors-artifact','reviewer','producer-model','[]','v1','independent_review','Independently checked both documents and their distinct authorship')",
      );
      await assertReviewedPublicationAnchors(db, assertion, [anchor, second]);
      await db.query(`
        INSERT INTO evidence.source_items(id,source_id,stable_identifier,url) VALUES ('anchors-copy-item','anchors-source','copy','https://mirror.example.net/copied');
        INSERT INTO evidence.capture_origins(capture_id,source_item_id,source_url,final_url,storage_object,observed_at) VALUES ('anchors-capture','anchors-copy-item','https://mirror.example.net/copied','https://mirror.example.net/copied','{}',now());
        INSERT INTO evidence.evidence_selectors(id,capture_id,source_item_id,selector_type,conforms_to,exact_text,selector_hash) VALUES ('anchors-copy-selector','anchors-capture','anchors-copy-item','TextQuoteSelector','http://www.w3.org/TR/annotation-model/','Five pupils',repeat('f',64));
        INSERT INTO evidence.lineage_clusters(id,root_capture_id,method_version,rationale) VALUES ('anchors-forged-separation','anchors-capture','v1','Different cluster name for the same work');
        INSERT INTO canonical.evidence_assignments(id,claim_version_id,selector_id,role,fitness,lineage_cluster_id,reviewer_actor_id,status,assessment_basis,fitness_reason,support_reason) VALUES ('anchors-copy-assignment','anchors-version','anchors-copy-selector','supporting','strong','anchors-forged-separation','reviewer','accepted','qualitative_review','Same underlying document','Same recorded count');
      `);
      await db.query(
        "SELECT research.approve_artifact('anchors-mirror-review','anchors-artifact','reviewer','producer-model','[]','v1','independent_review','Reviewed the mirror and original as one work')",
      );
      const mirror = {
        ...anchor,
        url: 'https://mirror.example.net/copied',
        selectorId: 'anchors-copy-selector',
      };
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [anchor, mirror]),
        /independently derived/,
      );
      // The reproduced same-host-plus-unknown-host bypass also fails without exact review references.
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [
          { url: anchor.url },
          { url: second.url },
          { url: 'https://unclassified.example/irrelevant' },
        ]),
        /exact claim-version/,
      );
      // A copied work across domains remains one lineage, even if separate roots were declared.
      await db.query(`INSERT INTO evidence.lineage_cluster_members(cluster_id,capture_id,relationship)
        VALUES ('anchors-second-lineage','anchors-capture','shared_upstream')`);
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [anchor, second]),
        /current accepted/,
      );
      await db.query(
        "SELECT research.approve_artifact('anchors-copy-review','anchors-artifact','reviewer','producer-model','[]','v1','independent_review','Checked newly recorded shared upstream; the second document copied the first')",
      );
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [anchor, second]),
        /independently derived/,
      );
      // Reviewed source-specific content can still support a narrow attributed quote.
      await assertReviewedPublicationAnchors(db, assertion, [anchor], false);
      // Expired or withdrawn origins cannot be laundered through a different capture of the URL.
      await db.query(
        'UPDATE evidence.capture_origins SET storage_object=\'{"preservationDecision":{"expiresAt":"2000-01-01T00:00:00Z"}}\' WHERE capture_id=\'anchors-second-capture\'',
      );
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [anchor, second]),
        /source-specific assignment/,
      );
      await db.query(
        "UPDATE evidence.capture_origins SET retention_revoked_at=clock_timestamp() WHERE capture_id='anchors-second-capture'",
      );
      await assert.rejects(
        assertReviewedPublicationAnchors(db, assertion, [anchor, second]),
        /exact publication assertion/,
      );
    } finally {
      await db.query('ROLLBACK');
      await db.end();
    }
  },
);
