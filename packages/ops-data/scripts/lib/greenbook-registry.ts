/**
 * Locate one Green Book listing in its NYPL source file and build the claim and summary a
 * listing-tier record carries. Shared by the stager and the registry-exact reviewer so both read
 * the source the same way.
 *
 * Two source shapes exist (see provenance.sourceUrl on lane=greenbook rows):
 *   1947  geojson, each feature's properties read  "name": "X", "address": "Y", ... "year": 1947,
 *         "city": "C", "state": "S", "category": "K"
 *   1956  {"rows": [["X", "Y, City, ST ZIP", "K", "1956", [lat, lng]], ...]}
 * Anything that does not match exactly once returns null, so the caller fails closed.
 */
export type ListingFacts = {
  readonly name: string;
  readonly address: string;
  readonly category: string;
  readonly year: number;
  readonly city: string;
  readonly state: string;
};

const STATE_NAMES: Readonly<Record<string, string>> = {
  MI: 'Michigan',
  IL: 'Illinois',
  PA: 'Pennsylvania',
  NJ: 'New Jersey',
  WI: 'Wisconsin',
  CA: 'California',
};

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export function stateName(raw: string): string {
  const trimmed = raw.trim();
  return STATE_NAMES[trimmed.toUpperCase()] ?? trimmed;
}

// The same two source files are searched once per listing, so keep their collapsed form.
const normalizedCache = new Map<string, string>();
function normalized(raw: string): string {
  let hit = normalizedCache.get(raw);
  if (hit === undefined) {
    if (normalizedCache.size >= 4) normalizedCache.clear();
    hit = raw.replace(/\s+/gu, ' ');
    normalizedCache.set(raw, hit);
  }
  return hit;
}

/** Verbatim passages from `source` that together state name, address, category, year and city. */
export function listingQuotes(rawSource: string, facts: ListingFacts): string[] | null {
  // The ledger compares quotes with whitespace runs collapsed, and the 1947 file is pretty-printed.
  const source = normalized(rawSource);
  const name = JSON.stringify(facts.name);
  const category = JSON.stringify(facts.category);
  if (facts.year === 1947) {
    const first = `"name": ${name}, "address": ${JSON.stringify(facts.address)}`;
    if (source.split(first).length !== 2) return null;
    const rest = source.slice(source.indexOf(first) + first.length, source.indexOf(first) + 2000);
    const second = new RegExp(
      `"year": 1947, "city": ${escape(JSON.stringify(facts.city.toUpperCase()))}, "state": "[^"]*", "category": ${escape(category)}`,
      'u',
    ).exec(rest);
    return second ? [first, second[0]] : null;
  }
  if (facts.year === 1956) {
    const pattern = new RegExp(
      `\\[${escape(name)}, "${escape(facts.address.replace(/"/gu, '\\"'))}[^"]*", ${escape(category)}, "1956"`,
      'gu',
    );
    const hits = source.match(pattern);
    return hits?.length === 1 ? [hits[0] as string] : null;
  }
  return null;
}

export function listingClaim(facts: ListingFacts): string {
  return (
    `Listed in the ${facts.year} edition of the Negro Motorist Green Book as a ` +
    `${facts.category.toLowerCase()} at ${facts.address}, ${facts.city}, ${stateName(facts.state)}.`
  );
}

export function listingSummary(facts: ListingFacts): string {
  return `${facts.name} was ${listingClaim(facts).replace(/^Listed/u, 'listed')}`;
}

/** The listing facts as imported from the NYPL file; the only input every Green Book check reads. */
export function listingFactsFromRow(
  displayName: string,
  provenance: Readonly<Record<string, unknown>>,
): ListingFacts {
  return {
    name: displayName,
    address: String(provenance.historicAddress ?? '')
      .split(',')[0]!
      .trim(),
    category: String(provenance.sourceCategory ?? ''),
    year: Number(provenance.editionYear),
    city: String(provenance.sourceCity ?? '').trim(),
    state: stateName(String(provenance.sourceState ?? '')),
  };
}

/**
 * True when the public text is nothing but the verified listing restated: the summary is exactly
 * the generated sentence and the record carries exactly the one generated claim. Any extra word
 * or claim returns false, so that text goes to the model reviewer instead.
 */
export function isRestatedListing(input: {
  readonly displayName: string;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly summary: string;
  readonly historicalContext?: string | undefined;
  readonly impactStatement?: string | undefined;
  readonly claims: readonly { readonly object: unknown }[];
}): boolean {
  const facts = listingFactsFromRow(input.displayName, input.provenance);
  return (
    input.summary.trim() === listingSummary(facts) &&
    (input.historicalContext ?? '').trim() === '' &&
    (input.impactStatement ?? '').trim() === '' &&
    input.claims.length === 1 &&
    input.claims[0]?.object === listingClaim(facts)
  );
}
