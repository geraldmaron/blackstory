/**
 * Versioned predicate-family hints for inferring temporal qualifier property from claim text.
 * Predicates are hints, not schema — treat matches as soft signals only.
 */
export const PREDICATE_TEMPORAL_HINTS_VERSION = 'predicate-temporal-hints.v1' as const;

export type TemporalQualifierProperty = 'point_in_time' | 'start' | 'end';

type PredicateFamily = {
  readonly id: string;
  readonly property: TemporalQualifierProperty;
  readonly test: RegExp;
};

/** Ordered most-specific-first; first match wins. */
export const PREDICATE_TEMPORAL_FAMILIES: readonly PredicateFamily[] = [
  { id: 'birth', property: 'start', test: /\b(birth|born|birth_year|birthdate|date_of_birth)\b/u },
  { id: 'death', property: 'end', test: /\b(death|died|death_year|deathdate|date_of_death|deceased)\b/u },
  {
    id: 'founded',
    property: 'start',
    test: /\b(founded|founded_year|founded_in|co[- ]founded|established|organized|incorporated)\b/u,
  },
  { id: 'closed', property: 'end', test: /\b(closed|dissolved|disbanded|ceased|shut_down|shutdown)\b/u },
  { id: 'demolished', property: 'end', test: /\b(demolished|razed|destroyed|removed)\b/u },
  { id: 'enacted', property: 'start', test: /\b(enacted|passed|signed_into_law|adopted)\b/u },
  { id: 'repealed', property: 'end', test: /\b(repealed|revoked|rescinded|sunset)\b/u },
  {
    id: 'struck_down',
    property: 'end',
    test: /\b(struck_down|overturned|invalidated|ruled_unconstitutional)\b/u,
  },
  { id: 'event_date', property: 'point_in_time', test: /\b(event_date|occurred|occurred_on|occurred_in|held_on)\b/u },
];

/** Infer temporal qualifier property from a claim predicate phrase. Defaults to point_in_time. */
export function inferTemporalProperty(predicate: string): TemporalQualifierProperty {
  const normalized = predicate.toLowerCase().trim();
  for (const family of PREDICATE_TEMPORAL_FAMILIES) {
    if (family.test.test(normalized)) return family.property;
  }
  return 'point_in_time';
}
