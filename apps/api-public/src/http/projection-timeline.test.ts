/**
 * repo-n7p6.6 item 2 — the API must serve the same timeline the website renders.
 *
 * Before this, `mapProjectionToEntityV1` hard-coded `timeline: []`, so a record with a full
 * status history read as having no history at all over the API while the web page showed one.
 * These tests pin the wire DTO to the projection's own evidence-backed time records.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PublicEntityProjectionDoc } from '@repo/ops-data';
import { mapProjectionToEntityV1 } from './projection-mapping.ts';

function projection(overrides: Partial<PublicEntityProjectionDoc>): PublicEntityProjectionDoc {
  return {
    id: 'ent_law_civil_rights_act_1991',
    releaseId: 'rel_test_001',
    kind: 'law',
    displayName: 'Civil Rights Act of 1991',
    nameLower: 'civil rights act of 1991',
    summary: 'S'.repeat(140),
    claimIds: [],
    topicTags: [],
    topicIds: [],
    mentionedEntityIds: [],
    keywords: [],
    campaignIds: [],
    ...overrides,
  } as PublicEntityProjectionDoc;
}

describe('mapProjectionToEntityV1 timeline', () => {
  it('carries status-history records through to the wire DTO', () => {
    const entity = mapProjectionToEntityV1(
      projection({
        statusHistory: [
          {
            status: 'in_force',
            validFrom: '1971',
            datePrecision: 'year',
            basisClaimIds: ['claim_a', 'claim_b'],
          },
        ],
      }),
    );
    assert.equal(entity?.timeline.length, 1);
    const [entry] = entity!.timeline;
    assert.equal(entry?.atLabel, '1971');
    assert.equal(entry?.datePrecision, 'year');
    assert.equal(entry?.title, 'Status: In Force');
    assert.match(entry?.body ?? '', /Basis: claim_a, claim_b\./u);
    // Year precision must not be reported as a precise instant.
    assert.equal(entry?.at, undefined);
  });

  it('drops undated records instead of showing a guessed date', () => {
    const entity = mapProjectionToEntityV1(
      projection({
        statusHistory: [{ status: 'in_force', datePrecision: 'year', basisClaimIds: [] }],
      }),
    );
    assert.deepEqual(entity?.timeline, []);
  });

  it('stays empty for a projection with no time records at all', () => {
    assert.deepEqual(mapProjectionToEntityV1(projection({}))?.timeline, []);
  });

  it('serves a record whose historical context has not been written yet', () => {
    // Regression: `historicalContext` was `nonEmptyText`, so the mapper's deliberate `''` failed
    // contract validation and the handler served a 404 — for 2,667 of the 4,094 entities in the
    // active release. An unwritten context is a real state, not a missing record.
    const entity = mapProjectionToEntityV1(projection({ kind: 'place' }));
    assert.ok(entity, 'a record with no written historical context must still be servable');
    assert.equal(entity.historicalContext, '');
  });

  it('emits a DTO that still validates against the published entity contract', () => {
    // mapProjectionToEntityV1 parses through entityV1Schema, so a malformed timeline entry would
    // surface as undefined here rather than as a bad payload on the wire.
    const entity = mapProjectionToEntityV1(
      projection({
        statusHistory: [
          {
            status: 'demolished',
            validFrom: '1977-06-14',
            datePrecision: 'day',
            basisClaimIds: ['claim_x'],
          },
        ],
      }),
    );
    assert.ok(entity, 'expected a valid EntityV1');
    assert.equal(entity.timeline[0]?.at, new Date('1977-06-14').toISOString());
  });
});
