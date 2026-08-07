/**
 * repo-n7p6.6 item 2 — the precision/ISO behaviour the public timeline contract depends on.
 *
 * The chronological-ordering and sentence-composition behaviour this builder inherited from
 * `apps/web/src/data/entity-graph-seed.ts` is still covered by that module's own test, which
 * imports through the re-export. These tests cover what is new here: date precision and the rule
 * that `at` is never fabricated.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGraphTimeline,
  inferDatePrecision,
  isUndatedTimelineEntry,
  type TimelineSourceEntity,
} from './timeline.js';

const NO_NEIGHBORS = new Map<string, { readonly displayName: string }>();

function statusEntity(
  validFrom: string | undefined,
  datePrecision: 'day' | 'month' | 'year' | 'decade' | 'circa',
): TimelineSourceEntity {
  return {
    id: 'ent_x_001',
    displayName: 'Test Record',
    statusHistory: [
      {
        status: 'in_force',
        ...(validFrom !== undefined ? { validFrom } : {}),
        datePrecision,
        basisClaimIds: ['claim_1'],
      },
    ],
  };
}

describe('inferDatePrecision', () => {
  it('reads precision off the shape of a bare date string', () => {
    assert.equal(inferDatePrecision('1975-06-14'), 'day');
    assert.equal(inferDatePrecision('1975-06'), 'month');
    assert.equal(inferDatePrecision('1975'), 'year');
    assert.equal(inferDatePrecision('1970s'), 'decade');
  });

  it('degrades an unrecognized string to year rather than claiming day precision', () => {
    assert.equal(inferDatePrecision('sometime after the war'), 'year');
  });
});

describe('buildGraphTimeline date honesty', () => {
  it('never fabricates an ISO timestamp from a year-precision date', () => {
    const [entry] = buildGraphTimeline(statusEntity('1971', 'year'), NO_NEIGHBORS);
    assert.equal(entry?.time, '1971');
    assert.equal(entry?.datePrecision, 'year');
    assert.equal(entry?.at, undefined, '"1971" must not become 1971-01-01T00:00:00.000Z');
  });

  it('emits at only for day precision', () => {
    const [entry] = buildGraphTimeline(statusEntity('1975-06-14', 'day'), NO_NEIGHBORS);
    assert.equal(entry?.datePrecision, 'day');
    assert.equal(entry?.at, new Date('1975-06-14').toISOString());
  });

  it('labels a record with no validFrom Undated, with no timestamp', () => {
    const [entry] = buildGraphTimeline(statusEntity(undefined, 'year'), NO_NEIGHBORS);
    assert.equal(entry?.time, 'Undated');
    assert.equal(entry?.at, undefined);
    assert.equal(isUndatedTimelineEntry(entry!), true);
  });

  it('trusts the record precision over the string shape when they disagree', () => {
    // A circa-1968 record stored as a full date is still approximate — the record says so.
    const [entry] = buildGraphTimeline(statusEntity('1968-04-04', 'circa'), NO_NEIGHBORS);
    assert.equal(entry?.datePrecision, 'circa');
    assert.equal(entry?.at, undefined);
  });

  it('infers precision for dated graph edges, which carry no precision field', () => {
    const [entry] = buildGraphTimeline(
      {
        id: 'ent_a_001',
        displayName: 'Dunbar School',
        related: [
          {
            id: 'ent_b_001',
            type: 'located_at',
            direction: 'outgoing',
            timespan: { validFrom: '1870' },
          },
        ],
      },
      new Map([['ent_b_001', { displayName: '15th Street Church' }]]),
    );
    assert.equal(entry?.datePrecision, 'year');
    assert.equal(entry?.at, undefined);
    assert.match(entry?.body ?? '', /Dunbar School is located at 15th Street Church\./u);
  });

  it('falls back to the neighbor id rather than dropping an edge it cannot name', () => {
    const [entry] = buildGraphTimeline(
      {
        id: 'ent_a_001',
        displayName: 'A',
        related: [
          {
            id: 'ent_unresolved_001',
            type: 'part_of',
            direction: 'outgoing',
            timespan: { validFrom: '1920' },
          },
        ],
      },
      NO_NEIGHBORS,
    );
    assert.match(entry?.body ?? '', /ent_unresolved_001/u);
  });
});
