import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { querySourceLibrary } from './source-library.js';

test(
  'populated library filters, pagination, schema rejection, authorization and immutable policy versions',
  {
    skip: !process.env.RESEARCH_TEST_DATABASE_URL,
  },
  async () => {
    const connectionString = process.env.RESEARCH_TEST_DATABASE_URL!;
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname));
    const db = new pg.Client({ connectionString });
    await db.connect();
    try {
      await db.query('BEGIN');
      const all = await querySourceLibrary(db, { limit: 3 });
      assert.ok(all.total >= 10);
      assert.equal(all.items.length, 3);
      assert.equal(all.nextOffset, 3);
      const next = await querySourceLibrary(db, { limit: 3, offset: 3 });
      assert.ok(
        next.items.every((item) => !all.items.some((first) => first.policyId === item.policyId)),
      );
      const empty = await querySourceLibrary(db, { subject: 'no-collection-matches-this-phrase' });
      assert.equal(empty.total, 0);
      assert.equal(empty.nextOffset, null);
      const school = await querySourceLibrary(db, {
        question: 'school buildings',
        assertionClass: 'chronology',
        geography: 'Missouri',
      });
      assert.ok(school.items.some((item) => item.policyId === 'collection-missouri-nominations'));
      assert.ok(
        school.items.every((item) => item.guidance.suitableEvidenceNeeds.includes('chronology')),
      );
      const law = await querySourceLibrary(db, {
        question: 'enacted federal law',
        assertionClass: 'legal_status',
      });
      assert.ok(law.items.some((item) => item.policyId === 'collection-govinfo-legal'));
      assert.ok(
        law.items.every((item) => item.claimFitness.every((f) => f.sourceClass !== 'court_record')),
      );
      const g = all.items[0]!.guidance;
      for (const malformed of [
        { ...g, extra: true },
        { ...g, reviewedAt: '2026-02-30T10:00:00Z' },
        { ...g, provenance: ['not a URI'] },
        { ...g, provenance: ['https://invalid host.test/'] },
        { ...g, provenance: ['https://example.test/%zz'] },
        { ...g, subjects: ['duplicate', 'duplicate'] },
        { ...g, reviewStatus: 'reviewed', reviewedBy: null },
      ]) {
        const result = await db.query(
          'SELECT evidence.valid_collection_guidance($1::jsonb) AS valid',
          [JSON.stringify(malformed)],
        );
        assert.equal(result.rows[0].valid, false);
      }
      const rejected = async (sql: string) => {
        await db.query('SAVEPOINT refused');
        await assert.rejects(db.query(sql));
        await db.query('ROLLBACK TO SAVEPOINT refused');
      };
      await rejected(
        "UPDATE evidence.source_policies SET display_name='Changed' WHERE id='collection-govinfo-legal'",
      );
      await rejected("DELETE FROM evidence.source_policies WHERE id='collection-govinfo-legal'");
      await rejected(
        "UPDATE evidence.source_policy_claim_fitness SET fitness='unfit' WHERE source_policy_id='collection-govinfo-legal'",
      );
      await rejected(
        "INSERT INTO evidence.source_policy_claim_fitness(source_policy_id,source_policy_version,claim_class,fitness) VALUES ('collection-govinfo-legal','1','invented','strong')",
      );
      await db.query('SET LOCAL ROLE research_worker');
      const research = await querySourceLibrary(db, { assertionClass: 'chronology', limit: 3 });
      assert.equal(research.items.length, 3);
      await rejected(
        "UPDATE evidence.source_policies SET display_name='Forbidden' WHERE id='collection-govinfo-legal'",
      );
      await db.query('SET LOCAL ROLE anon');
      await rejected('SELECT * FROM evidence.source_policies');
    } finally {
      await db.query('ROLLBACK');
      await db.end();
    }
  },
);
