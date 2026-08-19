/**
 * Tests for deterministic catalog status derivation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveCatalogEntityStatus } from './derive-catalog-status.js';

test('events remain statusless', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_event_1',
    kind: 'event',
    summary: 'A sit-in at a lunch counter in 1960.',
  });
  assert.equal(derived.statusHistory, undefined);
  assert.equal(derived.status, undefined);
});

test('laws default to in_force unless text says otherwise', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_law_1',
    kind: 'law',
    displayName: 'Civil Rights Act of 1964',
    summary: 'Passed in 1964, the Act outlawed discrimination.',
    eraBuckets: ['1960s'],
    claims: [{ id: 'c1', predicate: 'enacted_on', object: 'July 2, 1964' }],
  });
  assert.equal(derived.status, 'in_force');
  assert.equal(derived.statusHistory?.[0]?.status, 'in_force');
  assert.equal(derived.statusHistory?.[0]?.validFrom, '1960');
});

test('struck-down language yields struck_down', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_law_2',
    kind: 'law',
    summary: 'The Court struck down the ordinance in 1883.',
  });
  assert.equal(derived.status, 'struck_down');
});

test('place-like historic cues yield historic', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_1',
    kind: 'place',
    displayName: 'Fort Mose',
    summary: 'A former free Black settlement; archaeological ruins remain.',
    eraBuckets: ['1730s'],
  });
  assert.equal(derived.status, 'historic');
});

test('a place-like kind is active on a positive cue, not on being a university', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_school_1',
    kind: 'school',
    summary: 'Howard University remains a working research university in Washington, D.C.',
    eraBuckets: ['1860s'],
  });
  assert.equal(derived.status, 'active');
});

/**
 * The catalog's single largest assertion used to be a guess: any text mentioning a church,
 * school, park, district or town fell through to `active`, as did everything else reaching the
 * end of derivePlaceLike. Measured on release rel_20260723_authority_net_001, that put `active`
 * on 2,344 NRHP places, 2,337 of which contain no claim of present existence.
 */
test('an unresearched listing is unknown, not active', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'nrhp-example',
    kind: 'place',
    displayName: 'St. Paul AME Zion Church',
    summary:
      'St. Paul AME Zion Church is a building in Johnson City, Washington County, Tennessee ' +
      'listed on the National Register of Historic Places on April 12, 2001 for its significance ' +
      'in architecture, Black heritage, and social history.',
    researchCoverage: 'minimal',
  });
  assert.equal(derived.status, 'unknown');
  assert.equal(
    derived.statusHistory,
    undefined,
    'a lifecycle span is a dated assertion the record cannot make',
  );
});

test('an unknown standing still yields no span even when the record has a datable year', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'nrhp-example-2',
    kind: 'place',
    displayName: 'Block Unit #1 Historic District',
    summary: 'A district listed on the National Register in 2000.',
    eraBuckets: ['1920s'],
    researchCoverage: 'minimal',
  });
  assert.equal(derived.status, 'unknown');
  assert.equal(derived.statusHistory, undefined);
});

/**
 * The suppression is scoped to unresearched listings on purpose. Dropping the cue-free default
 * for every record was measured against the live catalog first and stripped `active` from 564
 * curated records — the DuSable Museum, Ebenezer Baptist Church — because ACTIVE_RE does not
 * match plain present tense.
 */
test('a researched record keeps the active default even with no explicit present-tense cue', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_aamlo_oakland_001',
    kind: 'institution',
    summary:
      'AAMLO is a museum and non-circulating reference library operated by the Oakland Public ' +
      'Library.',
    historicalContext: 'Opened in 1965 as the Oakland Public Library Black history collection.',
    researchCoverage: 'partial',
  });
  assert.equal(derived.status, 'active');
});

test('narrative context alone is enough to keep the default on a single-sourced record', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_single_source',
    kind: 'place',
    summary: 'A meeting hall in Selma.',
    historicalContext: 'Organizers met here through the 1965 voting-rights campaign.',
    researchCoverage: 'minimal',
  });
  assert.equal(derived.status, 'active');
});

/**
 * basisClaimIds used to synthesize `${entry.id}_claim_${i}` for claims arriving without an id,
 * but claims are minted as `claim_<entityId>_<nn>`. That published 3,270 records whose stated
 * evidential basis resolved to no claim on the record.
 */
test('basisClaimIds cites real claim ids only and never invents one', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_basis',
    kind: 'place',
    summary: 'A meeting hall that still stands and continues to host the congregation.',
    claims: [
      { id: 'claim_ent_place_basis_01', predicate: 'founded', object: 'Built in 1888.' },
      { predicate: 'listing', object: 'Listed on the National Register in 2001.' },
    ],
  });
  assert.deepEqual(derived.statusHistory?.[0]?.basisClaimIds, ['claim_ent_place_basis_01']);
});

test('a status resting on no citeable claim reports an empty basis rather than a fabricated one', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_nobasis',
    kind: 'place',
    summary: 'A former school; the building was demolished in 1974.',
    claims: [{ predicate: 'listing', object: 'Listed in 1998.' }],
  });
  assert.equal(derived.status, 'historic');
  assert.deepEqual(derived.statusHistory?.[0]?.basisClaimIds, []);
});

test('persons derive livingStatus from death cues', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_person_1',
    kind: 'person',
    summary: 'She died in 1913 after a long career as an educator.',
  });
  assert.equal(derived.livingStatus, 'deceased');
  assert.equal(derived.status, 'deceased');
  assert.equal(derived.statusHistory, undefined);
});

test('was lynched by a white mob yields deceased', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'lynching_isaac_mcghie_duluth_minnesota',
    kind: 'person',
    summary: 'Isaac McGhie was lynched by a white mob in Duluth, Minnesota, in 1920.',
  });
  assert.equal(derived.livingStatus, 'deceased');
  assert.equal(derived.status, 'deceased');
});

test('parenthetical life range yields deceased', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_person_life_range',
    kind: 'person',
    summary: 'Mary Church Terrell (1885–1952) organized for suffrage and civil rights.',
  });
  assert.equal(derived.livingStatus, 'deceased');
  assert.equal(derived.status, 'deceased');
});

test('Lynch surname alone does not yield deceased', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_person_lynch_surname',
    kind: 'person',
    summary: 'Loretta Lynch argued the case before the Court.',
  });
  assert.equal(derived.livingStatus, 'unknown');
  assert.equal(derived.status, 'unknown');
});

test('explicit livingStatus unknown publishes status unknown never living', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_person_unknown',
    kind: 'person',
    summary: 'An educator whose later life is not yet established from evidence.',
    livingStatus: 'unknown',
  });
  assert.equal(derived.livingStatus, 'unknown');
  assert.equal(derived.status, 'unknown');
});

test('authored statusHistory is preserved', () => {
  const history = [
    {
      status: 'active' as const,
      validFrom: '1841',
      datePrecision: 'year' as const,
      basisClaimIds: ['c1'],
    },
  ];
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_2',
    kind: 'place',
    statusHistory: history,
  });
  assert.equal(derived.statusHistory, history);
  assert.equal(derived.status, 'active');
});

test('a dated closure beats a generic present-day cue (repo-rlq1)', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_closed_dated',
    kind: 'place',
    summary:
      'Cherokee State Park was Kentucky’s only all-Black state park, opened in 1952 and closed in 1963 as segregated recreation became politically untenable. A marker stands at the site today.',
  });
  assert.equal(derived.status, 'historic');
});

test('demolition language wins over a commemorative today-clause (repo-rlq1)', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_demolished',
    kind: 'place',
    summary:
      'Mill Creek Valley was demolished by the city beginning in 1959, destroying 5,600 housing units; today the site is remembered as one of the largest acts of urban-renewal displacement.',
  });
  assert.equal(derived.status, 'historic');
});

test('operated-until phrasing yields historic (repo-rlq1)', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_operated_until',
    kind: 'school',
    summary:
      'Twenty-eight students enrolled in its first year, and it operated until 1952. The building currently houses apartments.',
  });
  assert.equal(derived.status, 'historic');
});

test('a closure followed by reopening is not terminal (repo-rlq1)', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_reopened',
    kind: 'place',
    summary:
      'The theater closed in 1978 after decades of decline, was restored by a community trust, and reopened in 1994; it still operates as a performance venue today.',
  });
  assert.equal(derived.status, 'active');
});

test('a razed predecessor building does not close an active congregation (repo-rlq1)', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_razed_predecessor',
    kind: 'place',
    summary:
      'Following the thwarted rebellion the original church was razed to the ground and the congregation was forced to meet in secret until after the Civil War. It remains an active congregation today.',
  });
  assert.equal(derived.status, 'active');
});

test('an undated demolition of a different subject stays active (repo-rlq1)', () => {
  const derived = deriveCatalogEntityStatus({
    id: 'ent_place_predecessor_demolished',
    kind: 'place',
    summary:
      'Federally funded public housing built for African American families on the site of a Black neighborhood largely demolished for it; the complex still serves residents today.',
  });
  assert.equal(derived.status, 'active');
});
