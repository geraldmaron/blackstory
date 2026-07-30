/**
 * Unit tests for same-event co-participation inference.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoParticipationLinks,
  coParticipationNeighborsForEntity,
  formatCoParticipationSummary,
  type EventParticipationRow,
} from './co-participation.js';

const MARCH: EventParticipationRow[] = [
  { eventId: 'ent_march_1963', participantId: 'ent_king', role: 'speaker' },
  { eventId: 'ent_march_1963', participantId: 'ent_rustin', role: 'organizer' },
  { eventId: 'ent_march_1963', participantId: 'ent_bscp', role: 'participant' },
  { eventId: 'ent_boycott', participantId: 'ent_king', role: 'leader' },
  { eventId: 'ent_boycott', participantId: 'ent_abernathy', role: 'leader' },
];

test('buildCoParticipationLinks pairs every co-participant at the same event', () => {
  const links = buildCoParticipationLinks(MARCH);
  assert.equal(links.length, 4);
  const marchPairs = links.filter((link) => link.eventId === 'ent_march_1963');
  assert.equal(marchPairs.length, 3);
  assert.ok(
    marchPairs.some(
      (link) =>
        link.entityAId === 'ent_king' &&
        link.entityBId === 'ent_rustin' &&
        link.rolesA.includes('speaker') &&
        link.rolesB.includes('organizer'),
    ),
  );
});

test('buildCoParticipationLinks filters to person and organization kinds when map provided', () => {
  const kinds = new Map<string, string>([
    ['ent_king', 'person'],
    ['ent_rustin', 'person'],
    ['ent_bscp', 'organization'],
    ['ent_place', 'place'],
  ]);
  const withPlace: EventParticipationRow[] = [
    ...MARCH,
    { eventId: 'ent_march_1963', participantId: 'ent_place', role: 'location' },
  ];
  const links = buildCoParticipationLinks(withPlace, { participantKinds: kinds });
  for (const link of links) {
    assert.notEqual(link.entityAId, 'ent_place');
    assert.notEqual(link.entityBId, 'ent_place');
  }
});

test('coParticipationNeighborsForEntity returns through-event stubs for one entity', () => {
  const names = new Map([
    ['ent_march_1963', 'March on Washington'],
    ['ent_boycott', 'Montgomery Bus Boycott'],
  ]);
  const neighbors = coParticipationNeighborsForEntity('ent_king', MARCH, names);
  assert.ok(neighbors.length >= 2);
  const rustin = neighbors.find((n) => n.neighborId === 'ent_rustin');
  assert.ok(rustin);
  assert.equal(rustin.eventDisplayName, 'March on Washington');
});

test('formatCoParticipationSummary renders through-event copy', () => {
  assert.equal(
    formatCoParticipationSummary('Bayard Rustin', 'March on Washington'),
    'Connected through March on Washington with Bayard Rustin.',
  );
});
