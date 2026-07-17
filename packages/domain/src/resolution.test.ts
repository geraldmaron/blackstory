/**
 * Gold-fixture and safety tests for entity and historical-location resolution.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { DiscoveryCandidateRecord } from './discovery/types.js';
import type { CanonicalEntity } from './entity.js';
import type { EntityLocation, Jurisdiction } from './geography/location.js';
import {
  applyResolutionDecision,
  createDuplicateReviewQueueItem,
  nameSimilarity,
  normalizeAlias,
  parseAddress,
  resolveEntityCandidate,
  resolutionCandidateFromDiscovery,
  reverseResolutionDecision,
  type ResolutionCandidate,
  type ResolutionDecision,
  type ResolutionProfile,
} from './resolution/index.js';

const NOW = '2026-07-17T00:00:00.000Z';

function entity(
  id: string,
  kind: CanonicalEntity['kind'],
  displayName: string,
  extra: Partial<CanonicalEntity> = {},
): CanonicalEntity {
  return { id, kind, displayName, createdAt: NOW, updatedAt: NOW, ...extra };
}

const historicalSchoolLocation: EntityLocation = {
  id: 'location-school-1961',
  entityId: 'school-1',
  role: 'historical',
  geometry: { type: 'Point', coordinates: [-84.39, 33.75] },
  precision: 'neighborhood',
  validFrom: '1924',
  validTo: '1971',
  jurisdictionIds: ['city-atlanta-1950'],
  label: '45 History Ave, Atlanta, GA',
};

const profiles: readonly ResolutionProfile[] = [
  {
    entity: entity('school-1', 'school', 'Washington Heritage Academy', {
      school: {
        names: [
          { name: 'Booker T. Washington High School', validFrom: '1924', validTo: '1971' },
          { name: 'Washington Heritage Academy', validFrom: '1972', primary: true },
        ],
        campuses: [],
        milestones: [],
      },
    }),
    locations: [historicalSchoolLocation],
  },
  {
    entity: entity('person-alex-a', 'person', 'Alex Johnson', {
      person: { livingStatus: 'unknown', birthYear: 1930 },
    }),
  },
  {
    entity: entity('person-alex-b', 'person', 'Alex Johnson', {
      person: { livingStatus: 'unknown', birthYear: 1932 },
    }),
  },
  {
    entity: entity('org-1', 'organization', 'Freedom League', {
      identifiers: [{ system: 'archives', value: 'FL-77' }],
      organization: { foundedYear: 1940 },
    }),
  },
];

const jurisdictions: readonly Jurisdiction[] = [
  {
    id: 'city-atlanta-1950',
    kind: 'city',
    name: 'Atlanta',
    validFrom: '1950',
    validTo: '1970',
  },
  {
    id: 'city-atlanta-current',
    kind: 'city',
    name: 'Atlanta',
    validFrom: '1971',
  },
];

type GoldFixture = {
  readonly cases: readonly {
    readonly id: string;
    readonly candidate: ResolutionCandidate;
    readonly expectedOutcome: string;
    readonly expectedEntityId?: string;
  }[];
};

const fixturePath = fileURLToPath(
  new URL('./resolution/fixtures/gold-resolution.v1.json', import.meta.url),
);
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as GoldFixture;

test('normalizes aliases and parses deterministic US addresses', () => {
  assert.equal(normalizeAlias('  St. Mary’s & Ácademy  '), 'st marys and academy');
  assert.ok(nameSimilarity('Booker T Washington', 'Booker T. Washington') > 0.98);
  assert.deepEqual(parseAddress('45 History Ave, Atlanta, GA 30303'), {
    raw: '45 History Ave, Atlanta, GA 30303',
    street: '45 History Ave',
    city: 'Atlanta',
    state: 'GA',
    postalCode: '30303',
    countryCode: 'US',
  });
});

for (const goldCase of fixture.cases) {
  test(`gold resolution: ${goldCase.id}`, () => {
    const result = resolveEntityCandidate(goldCase.candidate, profiles, { jurisdictions });
    assert.equal(result.outcome, goldCase.expectedOutcome);
    assert.equal(result.selectedEntityId, goldCase.expectedEntityId);
    assert.ok(result.rankedMatches.every((match) => match.factors.length === 5));
  });
}

test('ambiguous duplicate matches enter review and never select silently', () => {
  const candidate = fixture.cases[1]!.candidate;
  const result = resolveEntityCandidate(candidate, profiles, { jurisdictions });
  assert.equal(result.outcome, 'review_required');
  assert.equal(result.selectedEntityId, undefined);
  const queueItem = createDuplicateReviewQueueItem(candidate, result, NOW);
  assert.equal(queueItem.reason, 'ambiguous_match');
  assert.deepEqual(queueItem.proposedEntityIds.slice(0, 2), ['person-alex-a', 'person-alex-b']);
});

test('converts BB-039 discovery candidates with stable source references', () => {
  const discoveryCandidate: DiscoveryCandidateRecord = {
    schemaVersion: 'discovery-candidate.v1',
    id: 'discovery-1',
    identity: {
      identityKey: 'identity-1',
      stableIdentifier: 'record-1',
      contentHash: { algorithm: 'sha256', digest: 'a'.repeat(64) },
      sourceReferences: [
        {
          sourceId: 'archive',
          adapterId: 'archive-v1',
          parserVersion: '1.0.0',
          registryEntryId: 'registry-1',
          runId: 'run-1',
          capturedAt: NOW,
          stableIdentifier: 'record-1',
        },
      ],
    },
    adapterRecord: {
      stableIdentifier: 'record-1',
      title: 'Freedom League',
      payload: {
        name: 'Freedom League',
        kind: 'organization',
        identifiers: { archives: 'FL-77' },
      },
      provenance: {
        sourceId: 'archive',
        adapterId: 'archive-v1',
        parserVersion: '1.0.0',
        registryEntryId: 'registry-1',
        runId: 'run-1',
        capturedAt: NOW,
        schemaVersion: 'candidate-record.v1',
      },
    },
    status: 'accepted',
    ingestMode: 'bulk',
    signals: {
      strength: 'strong',
      outcome: 'promotable',
      matchedClasses: [],
      matchedTerms: [],
      reasons: [],
    },
    geographicHints: [],
    retryCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const candidate = resolutionCandidateFromDiscovery(discoveryCandidate);
  assert.equal(candidate.kind, 'organization');
  assert.deepEqual(candidate.identifiers, { archives: 'FL-77' });
  assert.deepEqual(candidate.sourceReferenceIds, ['archive:record-1']);
});

test('historically invalid locations and impossible lifespans reduce confidence', () => {
  const candidate: ResolutionCandidate = {
    id: 'candidate-impossible',
    name: 'Alex Johnson',
    kind: 'person',
    year: 1900,
    geographicHints: ['Atlanta, GA'],
    sourceReferenceIds: ['archive:impossible'],
  };
  const result = resolveEntityCandidate(candidate, profiles, { jurisdictions });
  assert.notEqual(result.outcome, 'proposed_match');
  assert.match(
    result.rankedMatches[0]!.factors.find((factor) => factor.factor === 'temporal')!.rationale,
    /outside person lifespan/,
  );
});

test('resolution decisions are auditable and reversible', () => {
  const proposed: ResolutionDecision = {
    id: 'decision-1',
    candidateId: 'candidate-school-1961',
    selectedEntityId: 'school-1',
    status: 'proposed',
    confidence: 0.9,
    rationale: ['historical name and location agree'],
    decidedBy: 'researcher-1',
    decidedAt: NOW,
    sourceReferenceIds: ['nara:1001'],
  };
  const applied = applyResolutionDecision(proposed, '2026-07-17T00:01:00.000Z');
  const reversed = reverseResolutionDecision(applied, {
    reversedAt: '2026-07-17T00:02:00.000Z',
    reversedBy: 'reviewer-1',
    reason: 'new contradictory evidence',
  });
  assert.equal(reversed.status, 'reversed');
  assert.equal(reversed.selectedEntityId, 'school-1');
  assert.equal(reversed.reverseReason, 'new contradictory evidence');
});
