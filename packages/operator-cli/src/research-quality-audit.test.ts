/**
 * The audit's job is to be re-runnable and honest. These pin the two things that would make it
 * dishonest: a source class inferred too generously, and a claim whose assertion is read off
 * the predicate when the object says something stronger.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { detectDeficits } from '@repo/domain';
import { getOpsPostgresPool } from '@repo/data-access';

import {
  type EntityAuditRow,
  type ReleasedEntity,
  assertionClassForClaim,
  auditReleasedEntities,
  selectDeficitCohort,
  snapshotForReleasedEntity,
  sourceClassForCitation,
} from './research-quality-audit.ts';
import { assessReviewedMaturity, assessReviewedMaturityOnClient } from './reviewed-maturity.ts';
import type { ReviewedMaturityPool } from './reviewed-maturity.ts';

function entity(overrides: Partial<ReleasedEntity> = {}): ReleasedEntity {
  return {
    entityId: 'ent_1',
    kind: 'person',
    displayName: 'Test Person',
    summary: 'A summary.',
    claims: [],
    ...overrides,
  };
}

function auditRow(overrides: Partial<EntityAuditRow> = {}): EntityAuditRow {
  return {
    entityId: 'ent_1',
    displayName: 'Test Person',
    kind: 'person',
    maturity: 'seeded',
    priority: 'P2',
    deficits: [],
    claimCount: 0,
    citedLineages: 0,
    corroboratingLineages: 0,
    bridgeOnly: false,
    ...overrides,
  };
}

test('a Wikipedia citation is a bridge however it is spelled', () => {
  assert.equal(
    sourceClassForCitation('https://en.wikipedia.org/wiki/X', undefined),
    'wikipedia_bridge',
  );
  assert.equal(sourceClassForCitation(undefined, 'wikipedia_api'), 'wikipedia_bridge');
  assert.equal(sourceClassForCitation(undefined, 'en.wikipedia.org'), 'wikipedia_bridge');
  assert.equal(
    sourceClassForCitation('https://www.wikidata.org/wiki/Q1', undefined),
    'wikidata_bridge',
  );
});

test('an NRHP nomination form is a technical report, not a biography', () => {
  // npgallery serves the nomination PDFs. Reading them as institutional prose would overstate
  // what they say about a person and understate what they say about a building.
  assert.equal(
    sourceClassForCitation('https://npgallery.nps.gov/NRHP/GetAsset/NRHP/12345_text', undefined),
    'government_technical_report',
  );
  assert.equal(
    sourceClassForCitation('https://www.nps.gov/articles/some-place.htm', undefined),
    'institutional_biography',
  );
});

test('a patent host is a patent specification', () => {
  assert.equal(
    sourceClassForCitation('https://patents.google.com/patent/US252386A/en', undefined),
    'patent_specification',
  );
});

test('an unrecognized host requires document review', () => {
  // Calling a state historical society a lead would understate real evidence more often than
  // calling an unknown blog a secondary source overstates it.
  assert.equal(
    sourceClassForCitation('https://www.okhistory.org/publications/enc/entry', undefined),
    'search_result_lead',
  );
  // But nothing at all is a lead, because it is.
  assert.equal(sourceClassForCitation(undefined, undefined), 'search_result_lead');
});

test('the object text decides the assertion, not the predicate', () => {
  // This is the real Frederick McKinley Jones claim from the active release. Its predicate is
  // "patented", which reads as an ordinary record fact; its object claims firstness.
  const claim = {
    predicate: 'patented',
    object:
      'the first practical automatic refrigeration system for long-haul trucks in 1940, an invention that led Minneapolis entrepreneur Joseph Numero to found the Thermo Control Company',
  };
  assert.equal(assertionClassForClaim(claim), 'superlative');

  // Without the superlative, the same predicate is a record fact.
  assert.equal(
    assertionClassForClaim({
      predicate: 'patented',
      object: 'a device for cooling truck trailers',
    }),
    'record_fact',
  );
});

test('a record_index claim is not treated as carrying public summary prose', () => {
  // A record restating its own listing cannot corroborate itself; the reader-facing rule
  // already refuses that and the audit must not reintroduce it.
  const snapshot = snapshotForReleasedEntity(
    entity({
      claims: [
        {
          id: 'c1',
          claimRole: 'record_index',
          predicate: 'listing',
          object: 'x',
          citationSource: 'nps.gov',
        },
        {
          id: 'c2',
          claimRole: 'evidence',
          predicate: 'born',
          object: 'y',
          citationSource: 'nps.gov',
        },
      ],
    }),
  );
  assert.equal(snapshot.claims[0]?.inPublicSummary, false);
  assert.equal(snapshot.claims[1]?.inPublicSummary, true);
});

test('the audit reports what it could not see rather than passing it silently', () => {
  // The released projection has no selectors, no captures and no document dates. Each of those
  // must surface as a deficit; "we did not record this" and "this is fine" must not look alike.
  const report = auditReleasedEntities('rel_test', [
    entity({
      claims: [
        {
          id: 'c1',
          claimRole: 'evidence',
          predicate: 'born',
          object: 'in Chelsea',
          citationHref: 'https://www.nps.gov/x',
          citationSource: 'nps.gov',
        },
      ],
    }),
  ]);
  assert.equal(report.entityCount, 1);
  assert.ok(report.deficitDistribution.claim_without_evidence_selector === 1);
  assert.ok(report.deficitDistribution.missing_creation_or_publication_date === 1);
  assert.ok(report.deficitDistribution.generic_confidence_dimension === 1);
});

test('a bridge-only entity is counted as zero corroborating lineages, not one', () => {
  const report = auditReleasedEntities('rel_test', [
    entity({
      claims: [
        {
          id: 'c1',
          claimRole: 'evidence',
          predicate: 'born',
          object: 'somewhere',
          citationHref: 'https://en.wikipedia.org/wiki/X',
          citationSource: 'en.wikipedia.org',
        },
      ],
    }),
  ]);
  assert.equal(report.lineage.bridgeOnlyEntities, 1);
  assert.equal(report.lineage.zeroCorroboratingLineageEntities, 1);
  assert.ok(report.deficitDistribution.wikipedia_only_summary_claim === 1);
});

test('two hosts of one authority do not read as two lineages', () => {
  const report = auditReleasedEntities('rel_test', [
    entity({
      claims: [
        {
          id: 'c1',
          claimRole: 'evidence',
          predicate: 'listed',
          object: 'x',
          citationHref: 'https://www.nps.gov/a',
          citationSource: 'nps.gov',
        },
        {
          id: 'c2',
          claimRole: 'evidence',
          predicate: 'documented_site',
          object: 'y',
          citationHref: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/1_text',
          citationSource: 'npgallery.nps.gov',
        },
      ],
      claimCountHint: undefined,
    } as Partial<ReleasedEntity>),
  ]);
  assert.equal(report.lineage.singleCorroboratingLineageEntities, 1);
});

test('per-entity rows appear only when the caller narrowed the query', () => {
  // A full-catalog run reports distributions; 4,000 rows of JSON is not a report.
  const one = [entity({ claims: [] })];
  assert.equal(auditReleasedEntities('rel_test', one).entities, undefined);
  assert.equal(
    auditReleasedEntities('rel_test', one, { includeEntities: true })?.entities?.length,
    1,
  );
});

test('the audit never returns a commit or write affordance', () => {
  const report = auditReleasedEntities('rel_test', [entity()]);
  assert.equal(report.verb, 'research-quality-audit');
  assert.equal('committed' in report, false);
});

// --------------------------------------------------------
test('an invention record requires a technical receipt', () => {
  const snapshot = snapshotForReleasedEntity(
    entity({
      kind: 'invention',
      claims: [
        {
          id: 'c1',
          claimRole: 'evidence',
          predicate: 'patented',
          object: 'a device',
          citationHref: 'https://patents.google.com/patent/US252386A/en',
        },
      ],
    }),
  );
  assert.equal(snapshot.requiresTechnicalReceipt, true);
  assert.equal(snapshot.requiresCommunityIdentityReceipt, false);
});

test('a person record cited only to a patent requires an independent identity receipt', () => {
  // The real shape of ent_lewis_latimer_001 and the other six person entities the active
  // release cites to a patent host: the technical identity is settled and the relevance gate
  // must not be.
  const snapshot = snapshotForReleasedEntity(
    entity({
      kind: 'person',
      claims: [
        {
          id: 'c1',
          claimRole: 'evidence',
          predicate: 'patented',
          object: 'an improved carbon filament',
          citationHref: 'https://patents.google.com/patent/US252386A/en',
        },
      ],
    }),
  );
  assert.equal(snapshot.requiresCommunityIdentityReceipt, true);
  const deficits = detectDeficits(snapshot);
  assert.ok(deficits.some((d) => d.code === 'missing_identity_receipt'));
  assert.ok(deficits.some((d) => d.code === 'patent_used_as_racial_identity_evidence'));
});

test('a person record with a non-patent source does not require an identity receipt', () => {
  const snapshot = snapshotForReleasedEntity(
    entity({
      kind: 'person',
      claims: [
        {
          id: 'c1',
          claimRole: 'evidence',
          predicate: 'born',
          object: 'in Chelsea',
          citationHref: 'https://www.nps.gov/x',
        },
      ],
    }),
  );
  assert.equal(snapshot.requiresCommunityIdentityReceipt, false);
});

test('a non-inventor, non-person record requires neither receipt', () => {
  const snapshot = snapshotForReleasedEntity(entity({ kind: 'place', claims: [] }));
  assert.equal(snapshot.requiresTechnicalReceipt, false);
  assert.equal(snapshot.requiresCommunityIdentityReceipt, false);
});

test('a deficit cohort is bounded from the matching set, not from the first N rows', () => {
  // The bug this pins: filtering a pre-limited slice can return fewer than --limit entities,
  // or none, even when far more than --limit entities actually carry the deficit. Here only
  // ent_3 and ent_5 (of five) carry the deficit; a --limit of 1 applied before filtering
  // (the old SQL-level LIMIT) would see only ent_1, which never matches, and return nothing.
  const rows = [
    auditRow({ entityId: 'ent_1', priority: 'P1', deficits: [] }),
    auditRow({ entityId: 'ent_2', priority: 'P0', deficits: [] }),
    auditRow({
      entityId: 'ent_3',
      priority: 'P2',
      deficits: ['wikipedia_only_summary_claim'] as never,
    }),
    auditRow({ entityId: 'ent_4', priority: 'P0', deficits: [] }),
    auditRow({
      entityId: 'ent_5',
      priority: 'P0',
      deficits: ['wikipedia_only_summary_claim'] as never,
    }),
  ];
  const cohort = selectDeficitCohort(rows, 'wikipedia_only_summary_claim' as never, 1);
  assert.deepEqual(
    cohort.map((row) => row.entityId),
    ['ent_5'],
  );
});

test('a deficit cohort is ordered by priority, not by input order', () => {
  const rows = [
    auditRow({
      entityId: 'ent_low',
      priority: 'P3',
      deficits: ['source_type_monoculture'] as never,
    }),
    auditRow({
      entityId: 'ent_high',
      priority: 'P0',
      deficits: ['source_type_monoculture'] as never,
    }),
    auditRow({
      entityId: 'ent_mid',
      priority: 'P1',
      deficits: ['source_type_monoculture'] as never,
    }),
  ];
  const cohort = selectDeficitCohort(rows, 'source_type_monoculture' as never);
  assert.deepEqual(
    cohort.map((row) => row.entityId),
    ['ent_high', 'ent_mid', 'ent_low'],
  );
});

test('a deficit cohort with no --limit returns every matching entity', () => {
  const rows = [
    auditRow({ entityId: 'ent_1', deficits: ['bridge_only_entity'] as never }),
    auditRow({ entityId: 'ent_2', deficits: [] }),
    auditRow({ entityId: 'ent_3', deficits: ['bridge_only_entity'] as never }),
  ];
  const cohort = selectDeficitCohort(rows, 'bridge_only_entity' as never);
  assert.equal(cohort.length, 2);
});

test('host names do not establish scholarly review, manuscript status or technical scope', () => {
  for (const url of [
    'https://doi.org/10.1/example',
    'https://archive.org/details/example',
    'https://wikipedia.example.com/x',
    'https://jstor.example.com/x',
  ])
    assert.equal(sourceClassForCitation(url, undefined), 'search_result_lead');
  assert.equal(
    sourceClassForCitation('https://www.uspto.gov/about-us', undefined),
    'institutional_biography',
  );
});

test('reviewed maturity admits exact, retained, independently reviewed assignments', async () => {
  const sourceUrl = 'https://www.nps.gov/people/ada-rivers.htm';
  const db: ReviewedMaturityPool = {
    async connect() {
      return {
        async query<Row extends Record<string, unknown>>(sql: string) {
          let rows: Record<string, unknown>[];
          if (sql.includes('assignment.id AS assignment_id')) {
            rows = [
              {
                claim_id: 'claim-ada',
                claim_version_id: 'claim-ada-v1',
                predicate: 'served_as',
                object: 'Principal of Douglass School',
                assignment_id: 'assignment-ada',
                source_item_id: 'source-item-ada',
                source_url: sourceUrl,
                capture_id: 'capture-ada',
                lineage_cluster_id: 'lineage-ada',
                lineage_rationale: 'Reviewed National Park Service biographical record.',
                exact_text: 'Ada Rivers served as principal of Douglass School.',
                start_offset: 10,
                end_offset: 59,
                preservation_decision: {
                  sourceUrl,
                  allowTextRetention: true,
                  allowArchive: true,
                  sensitivity: 'public',
                  reviewedBy: 'rights-reviewer',
                  reviewedAt: '2026-09-17T00:00:00.000Z',
                  expiresAt: '2027-09-17T00:00:00.000Z',
                  basis: 'Public institutional record approved for research retention.',
                },
              },
            ];
          } else if (sql.includes('SELECT DISTINCT need.description')) {
            rows = [];
          } else if (sql.includes('WITH current_claims AS')) {
            rows = [
              {
                reviewer_actor_id: 'reviewer-2',
                producer_actor_id: 'researcher-1',
                findings: [],
              },
            ];
          } else if (sql.includes('relationships_without_evidence')) {
            rows = [{ place_receipt: true, relationships_without_evidence: 0 }];
          } else if (sql.startsWith('BEGIN') || sql === 'COMMIT' || sql === 'ROLLBACK') {
            rows = [];
          } else {
            rows = [
              {
                claim_id: 'claim-ada',
                claim_version_id: 'claim-ada-v1',
                predicate: 'served_as',
                object: 'Principal of Douglass School',
              },
            ];
          }
          return { rows: rows as Row[] };
        },
        release() {},
      };
    },
  };
  const result = await assessReviewedMaturity(
    db,
    {
      entityId: 'entity-ada',
      kind: 'person',
      displayName: 'Ada Rivers',
      claims: [
        {
          id: 'claim-ada',
          predicate: 'served_as',
          object: 'Principal of Douglass School',
          claimRole: 'evidence',
        },
      ],
    },
    '2026-09-18T12:00:00.000Z',
  );
  assert.deepEqual(result.reviewedAssignmentIds, ['assignment-ada']);
  assert.equal(result.snapshot.claims[0]?.evidence[0]?.hasSelector, true);
  assert.equal(result.snapshot.claims[0]?.evidence[0]?.captured, true);
  assert.equal(result.snapshot.claims[0]?.evidence[0]?.lineage.inferred, false);
  assert.notEqual(result.assessment.maturity, 'seeded');
});

test('reviewed maturity drops evidence after its rights authorization expires', async () => {
  const db: ReviewedMaturityPool = {
    async connect() {
      return {
        async query<Row extends Record<string, unknown>>(sql: string) {
          if (sql.includes('assignment.id AS assignment_id'))
            return {
              rows: [
                {
                  claim_id: 'claim-1',
                  claim_version_id: 'claim-1-v1',
                  predicate: 'served_as',
                  object: 'Principal',
                  assignment_id: 'assignment-expired',
                  source_item_id: 'source-item-1',
                  source_url: 'https://example.org/record',
                  capture_id: 'capture-1',
                  lineage_cluster_id: 'lineage-1',
                  lineage_rationale: 'Reviewed source lineage.',
                  exact_text: 'Principal',
                  start_offset: 0,
                  end_offset: 9,
                  preservation_decision: {
                    sourceUrl: 'https://example.org/record',
                    allowTextRetention: true,
                    allowArchive: false,
                    sensitivity: 'public',
                    reviewedBy: 'reviewer',
                    reviewedAt: '2025-01-01T00:00:00.000Z',
                    expiresAt: '2026-01-01T00:00:00.000Z',
                    basis: 'Expired fixture.',
                  },
                },
              ] as Row[],
            };
          if (sql.includes('relationships_without_evidence'))
            return {
              rows: [{ place_receipt: false, relationships_without_evidence: 1 }] as Row[],
            };
          if (
            sql.includes('SELECT DISTINCT need.description') ||
            sql.includes('WITH current_claims AS') ||
            sql.startsWith('BEGIN') ||
            sql === 'COMMIT' ||
            sql === 'ROLLBACK'
          )
            return { rows: [] as Row[] };
          return {
            rows: [
              {
                claim_id: 'claim-1',
                claim_version_id: 'claim-1-v1',
                predicate: 'served_as',
                object: 'Principal',
              },
            ] as Row[],
          };
        },
        release() {},
      };
    },
  };
  const result = await assessReviewedMaturity(
    db,
    { entityId: 'entity-1', kind: 'person', displayName: 'Person', claims: [] },
    '2026-09-18T12:00:00.000Z',
  );
  assert.deepEqual(result.reviewedAssignmentIds, []);
  assert.deepEqual(result.snapshot.claims[0]?.evidence, []);
  assert.equal(result.assessment.maturity, 'seeded');
});

test(
  'Postgres review changes maturity and later revocation or rejection fails closed',
  { skip: !process.env.RESEARCH_TEST_DATABASE_URL },
  async () => {
    const connectionString = process.env.RESEARCH_TEST_DATABASE_URL!;
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname));
    const pool = getOpsPostgresPool({ DATABASE_URL: connectionString });
    const client = await pool.connect();
    const prefix = `reviewed-maturity-${randomUUID()}`;
    const id = (suffix: string) => `${prefix}-${suffix}`;
    const sourceUrl = `https://www.nps.gov/people/${prefix}.htm`;
    const exactText = 'Ada Rivers served as principal of Douglass School.';
    const decision = {
      sourceUrl,
      allowTextRetention: true,
      allowArchive: true,
      sensitivity: 'public',
      reviewedBy: 'rights-reviewer',
      reviewedAt: '2026-09-18T09:00:00.000Z',
      expiresAt: '2027-09-18T09:00:00.000Z',
      basis: 'Synthetic local integration fixture.',
    };
    const released = {
      entityId: id('entity'),
      kind: 'person',
      displayName: 'Ada Rivers',
      claims: [
        {
          id: id('claim'),
          predicate: 'served_as',
          object: 'Principal of Douglass School',
          claimRole: 'evidence',
        },
      ],
    } as const;
    try {
      await client.query('BEGIN');
      const fixtureWrites: readonly [string, readonly unknown[]][] = [
        [
          `INSERT INTO research.research_profiles
           (id,version,schema_version,checksum,profile,active)
           VALUES ($1,'1.0.0','1.0.0',repeat('a',64),'{}',false)`,
          [id('profile')],
        ],
        [
          `INSERT INTO research.cases
           (id,state,candidate_id,title,profile_id,profile_version,risk_class)
           VALUES ($1,'candidate',$1,'Reviewed maturity fixture',$2,'1.0.0','standard')`,
          [id('case'), id('profile')],
        ],
        [
          `INSERT INTO canonical.entities (id,kind,entity_class,display_name)
           VALUES ($1,'person','person','Ada Rivers')`,
          [released.entityId],
        ],
        [
          `INSERT INTO canonical.claims (id,entity_id,claim_class,workflow_status)
           VALUES ($1,$2,'standard','accepted')`,
          [id('claim'), released.entityId],
        ],
        [
          `INSERT INTO canonical.claim_versions
           (id,claim_id,predicate,object,workflow_status)
           VALUES ($1,$2,'served_as',$3::jsonb,'accepted')`,
          [id('version'), id('claim'), JSON.stringify('Principal of Douglass School')],
        ],
        [
          'UPDATE canonical.claims SET current_version_id=$1 WHERE id=$2',
          [id('version'), id('claim')],
        ],
        [
          "INSERT INTO evidence.evidence_sources (id,display_name) VALUES ($1,'NPS fixture')",
          [id('source')],
        ],
        [
          `INSERT INTO evidence.source_items (id,source_id,stable_identifier,url)
           VALUES ($1,$2,$1,$3)`,
          [id('item'), id('source'), sourceUrl],
        ],
        [
          `INSERT INTO evidence.source_captures
           (id,source_item_id,content_hash_algorithm,content_hash_digest,parser_version,snapshot_mode)
           VALUES ($1,$2,'sha256',repeat('b',64),'fixture-v1','selective')`,
          [id('capture'), id('item')],
        ],
        [
          `INSERT INTO evidence.capture_origins
           (capture_id,source_item_id,source_url,final_url,storage_object,observed_at)
           VALUES ($1,$2,$3,$3,jsonb_build_object('preservationDecision',$4::jsonb),clock_timestamp())`,
          [id('capture'), id('item'), sourceUrl, JSON.stringify(decision)],
        ],
        [
          `INSERT INTO evidence.evidence_selectors
           (id,capture_id,source_item_id,selector_type,conforms_to,exact_text,selector_hash)
           VALUES ($1,$2,$3,'TextQuoteSelector','http://www.w3.org/TR/annotation-model/',
                   $4,repeat('c',64))`,
          [id('selector'), id('capture'), id('item'), exactText],
        ],
        [
          `INSERT INTO evidence.lineage_clusters
           (id,root_capture_id,method_version,confidence,rationale)
           VALUES ($1,$2,'reviewed-v1',1,'Reviewed institutional source lineage.')`,
          [id('lineage'), id('capture')],
        ],
        [
          `INSERT INTO canonical.evidence_assignments
           (id,claim_version_id,selector_id,role,fitness,entailment_probability,
            entailment_calibration_version,lineage_cluster_id,reviewer_actor_id,status,created_at)
           VALUES ($1,$2,$3,'supporting','strong',0.9,'fixture-v1',$4,
                   'evidence-reviewer','accepted','2026-09-18T10:00:00Z')`,
          [id('assignment'), id('version'), id('selector'), id('lineage')],
        ],
        [
          `INSERT INTO evidence.retrieval_passages
           (id,capture_id,source_item_id,parser_version,document_text_hash,ordinal,
            start_offset,end_offset,body,body_hash,retention_decision,retention_expires_at)
           VALUES ($1,$2,$3,'fixture-v1',repeat('d',64),0,0,char_length($4),$4,
                   repeat('e',64),$5::jsonb,'2027-09-18T09:00:00Z')`,
          [id('passage'), id('capture'), id('item'), exactText, JSON.stringify(decision)],
        ],
        [
          `INSERT INTO research.runs
           (id,case_id,profile_id,profile_version,policy_version,mode,status,started_at)
           VALUES ($1,$2,$3,'1.0.0','1.0.0','independent-review','succeeded',clock_timestamp())`,
          [id('run'), id('case'), id('profile')],
        ],
        [
          `INSERT INTO research.agent_activities
           (id,run_id,actor_id,actor_type,model_family,activity_type,started_at,ended_at)
           VALUES ($1,$2,'producer-1','human',NULL,'extract',clock_timestamp(),clock_timestamp())`,
          [id('activity'), id('run')],
        ],
        [
          `INSERT INTO research.artifacts
           (id,run_id,activity_id,artifact_type,content_hash,schema_id,schema_version,
            storage_uri,extensions,status,idempotency_key)
           VALUES ($1,$2,$3,'claim-assessment',repeat('f',64),'ClaimStatement','1.0.0',
                   'local://fixture','{}','proposed',$1)`,
          [id('artifact'), id('run'), id('activity')],
        ],
        [
          'INSERT INTO research.artifact_claims (artifact_id,claim_version_id) VALUES ($1,$2)',
          [id('artifact'), id('version')],
        ],
      ];
      for (const [sql, values] of fixtureWrites) await client.query(sql, [...values]);

      const before = await assessReviewedMaturityOnClient(
        client,
        released,
        '2026-09-18T12:00:00.000Z',
      );
      assert.equal(before.assessment.maturity, 'seeded');
      assert.deepEqual(before.reviewedAssignmentIds, []);

      await client.query(
        `INSERT INTO research.review_decisions
          (id,artifact_id,decision,reviewer_actor_id,reviewer_model_family,
           producer_actor_id,producer_model_family,findings,benchmark_version,decided_at)
         VALUES ($1,$2,'approve','reviewer-2',NULL,'producer-1',NULL,'[]','fixture-v1',
                 '2026-09-18T11:00:00Z')`,
        [id('approval'), id('artifact')],
      );
      await client.query("UPDATE research.artifacts SET status='accepted' WHERE id=$1", [
        id('artifact'),
      ]);
      const approved = await assessReviewedMaturityOnClient(
        client,
        released,
        '2026-09-18T12:00:00.000Z',
      );
      assert.notEqual(approved.assessment.maturity, 'seeded');
      assert.deepEqual(approved.reviewedAssignmentIds, [id('assignment')]);

      await client.query(
        'UPDATE evidence.capture_origins SET retention_revoked_at=clock_timestamp() WHERE capture_id=$1 AND source_item_id=$2',
        [id('capture'), id('item')],
      );
      const revoked = await assessReviewedMaturityOnClient(
        client,
        released,
        '2026-09-18T12:00:00.000Z',
      );
      assert.equal(revoked.assessment.maturity, 'seeded');
      assert.deepEqual(revoked.reviewedAssignmentIds, []);

      await client.query(
        `UPDATE evidence.capture_origins SET retention_revoked_at=NULL
         WHERE capture_id=$1 AND source_item_id=$2`,
        [id('capture'), id('item')],
      );
      await client.query(
        `INSERT INTO research.review_decisions
          (id,artifact_id,decision,reviewer_actor_id,reviewer_model_family,
           producer_actor_id,producer_model_family,findings,benchmark_version,decided_at)
         VALUES ($1,$2,'reject','reviewer-3',NULL,'producer-1',NULL,'[]','fixture-v1',
                 '2026-09-18T11:30:00Z')`,
        [id('rejection'), id('artifact')],
      );
      const rejected = await assessReviewedMaturityOnClient(
        client,
        released,
        '2026-09-18T12:00:00.000Z',
      );
      assert.equal(rejected.assessment.maturity, 'seeded');
      assert.deepEqual(rejected.reviewedAssignmentIds, []);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  },
);
