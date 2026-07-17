/**
 * `FactRecord.claimType` vocabulary drives which geo/time fields a fact requires and
 * which schema.org type its JSON-LD `about` entry emits (see `../facts/jsonld.ts`). Closed
 * vocabulary, same discipline as `../entity-kinds.ts` and `../relationship.ts`'s
 * `RELATIONSHIP_TYPES`: add a new claim type here, in one place, rather than letting call sites
 * invent ad hoc strings.
 */

export const FACT_CLAIM_TYPES = [
  'event',
  'person-fact',
  'law',
  'place-designation',
  'quantity',
  'quote-attribution',
] as const;

export type FactClaimType = (typeof FACT_CLAIM_TYPES)[number];

export function isFactClaimType(value: string): value is FactClaimType {
  return (FACT_CLAIM_TYPES as readonly string[]).includes(value);
}

/**
 * Whether a `geo` + `geoPrecision` pair is required for a given claim type. `place-designation`
 * and `event` facts are inherently about a location; the others are not (a `quote-attribution`
 * or `quantity` fact may still carry an optional geo anchor, but it is never required).
 */
export const CLAIM_TYPE_REQUIRES_GEO: Readonly<Record<FactClaimType, boolean>> = {
  event: true,
  'person-fact': false,
  law: false,
  'place-designation': true,
  quantity: false,
  'quote-attribution': false,
};

/**
 * Whether a `when` + `datePrecision` pair is required. Every claim type except a pure
 * `quantity` fact (e.g. a population count with no single dateable moment) is anchored to a
 * point or span in time.
 */
export const CLAIM_TYPE_REQUIRES_WHEN: Readonly<Record<FactClaimType, boolean>> = {
  event: true,
  'person-fact': true,
  law: true,
  'place-designation': true,
  quantity: false,
  'quote-attribution': true,
};

/**
 * schema.org type hint for the JSON-LD `about` entry (never the fact's own `@type`, which is
 * always `Article` see `./jsonld.ts`). Chosen from stable, widely-supported schema.org types;
 * `quantity` and `place-designation` map to the closest fit rather than inventing a bespoke type.
 */
export const CLAIM_TYPE_ABOUT_SCHEMA_TYPE: Readonly<Record<FactClaimType, string>> = {
  event: 'Event',
  'person-fact': 'Person',
  law: 'Legislation',
  'place-designation': 'Place',
  quantity: 'QuantitativeValue',
  'quote-attribution': 'Quotation',
};

export function assertFactClaimTypeValid(value: string): void {
  if (!isFactClaimType(value)) {
    throw new Error(
      `Unknown FactRecord claimType "${value}" — expected one of: ${FACT_CLAIM_TYPES.join(', ')}`,
    );
  }
}

export function claimTypeRequiresGeo(claimType: FactClaimType): boolean {
  return CLAIM_TYPE_REQUIRES_GEO[claimType];
}

export function claimTypeRequiresWhen(claimType: FactClaimType): boolean {
  return CLAIM_TYPE_REQUIRES_WHEN[claimType];
}
