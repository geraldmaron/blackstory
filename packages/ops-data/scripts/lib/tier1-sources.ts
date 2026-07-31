/**
 * Tier-1 (federal/state government, courts, official archives) host classification,
 * shared by the auto-promotion gate and the source-corroboration search step so both
 * agree on exactly what counts — one list, not two that can drift apart.
 */
/**
 * Host classification is string comparison against a parsed hostname, not regular expressions.
 *
 * These used to be patterns like `/\.gov$/iu` tested against `new URL(url).hostname`, which was
 * correct but unprovable: an unanchored expression tested against a URL matches anywhere, so
 * CodeQL flagged every one of them (js/regex/missing-regexp-anchor) and a reader had to check
 * the call site to know the input was already a hostname. `hostMatches` says the rule outright:
 * the host IS the domain, or it is a subdomain of it. Nothing else counts, and
 * `evil-nps.gov.example.com` is not a subdomain of `nps.gov`.
 */
function normalizeHostname(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    // Trailing dot is the DNS root and is not part of the name for comparison purposes.
    return new URL(url).hostname.toLowerCase().replace(/\.$/u, '');
  } catch {
    return undefined;
  }
}

/** True when `hostname` is exactly `domain` or a subdomain of it. */
function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** True when `hostname` sits under a top-level domain such as `gov` or `mil`. */
function hostUnderTld(hostname: string, tld: string): boolean {
  return hostname.endsWith(`.${tld}`);
}

/** Top-level domains that are Tier-1 by themselves: US government and military. */
export const TIER1_TLDS: readonly string[] = ['gov', 'mil'];

/** Named Tier-1 domains that do not sit under a Tier-1 TLD, plus the federal ones worth naming. */
export const TIER1_DOMAINS: readonly string[] = [
  'nps.gov',
  'loc.gov',
  'archives.gov',
  'si.edu',
  'census.gov',
];

export function isTier1Host(url: string | undefined): boolean {
  const hostname = normalizeHostname(url);
  if (hostname === undefined) return false;
  return (
    TIER1_TLDS.some((tld) => hostUnderTld(hostname, tld)) ||
    TIER1_DOMAINS.some((domain) => hostMatches(hostname, domain))
  );
}

/** Hostname used as lineageRootId in the confidence engine — lowercase, no trailing dot. */
export function hostLineageKey(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** True when two URLs share the same hostname lineage (copies, not independent corroboration). */
export function isSameLineageHost(a: string | undefined, b: string | undefined): boolean {
  const aKey = hostLineageKey(a);
  const bKey = hostLineageKey(b);
  return aKey !== undefined && aKey === bKey;
}

/**
 * Prefer federal place/archive hosts when several Tier-1 links appear on one page. Most specific
 * first: a named domain outranks the bare TLD it sits under, so nps.gov beats a generic .gov.
 */
const TIER1_HOST_RANKING: readonly { readonly kind: 'domain' | 'tld'; readonly value: string }[] = [
  { kind: 'domain', value: 'nps.gov' },
  { kind: 'domain', value: 'loc.gov' },
  { kind: 'domain', value: 'planning.dc.gov' },
  { kind: 'domain', value: 'archives.gov' },
  { kind: 'domain', value: 'si.edu' },
  { kind: 'domain', value: 'census.gov' },
  { kind: 'tld', value: 'gov' },
  { kind: 'tld', value: 'mil' },
];

function tier1HostRank(url: string): number {
  const hostname = normalizeHostname(url);
  if (hostname === undefined) return -1;
  const index = TIER1_HOST_RANKING.findIndex((entry) =>
    entry.kind === 'tld' ? hostUnderTld(hostname, entry.value) : hostMatches(hostname, entry.value),
  );
  return index >= 0 ? TIER1_HOST_RANKING.length - index : 0;
}

export function rankTier1Links(links: readonly string[]): readonly string[] {
  return [...links].sort((left, right) => tier1HostRank(right) - tier1HostRank(left));
}

/** Curated heritage/education hosts — same list as confidence.ts reputable_secondary mapping. */
export const REPUTABLE_SECONDARY_HOST_SUFFIXES = [
  'dcpreservation.org',
  'hmdb.org',
  'dclibrary.org',
  'blackpast.org',
  // Source review 2026-07-28 (operator, session notes in repo-bmmo):
  // - baseballhall.org — official site of the National Baseball Hall of Fame
  //   and Museum, Cooperstown NY (verified via /about-the-hall). Accredited
  //   museum + research library; the canonical registry of inductees.
  // - sabr.org — Society for American Baseball Research (verified via
  //   /about/): scholarly body whose BioProject publishes peer-edited player
  //   biographies and which runs the Jerry Malloy Negro League Conference.
  'baseballhall.org',
  'sabr.org',
  // - The nine NPHC (Divine Nine) domains below — each verified 2026-07-28 as
  //   the organization's official national site (homepage title carries the
  //   incorporated org name; domain embeds the founding year). Century-old
  //   national institutions, authoritative for their own founding history
  //   (dates, campuses, founder rosters). Corroboration still requires an
  //   independent second host before any of this publishes.
  'apa1906.net',
  'aka1908.com',
  'kappaalphapsi1911.com',
  'oppf.org',
  'deltasigmatheta.org',
  'phibetasigma1914.org',
  'zphib1920.org',
  'sgrho1922.org',
  'iotaphitheta.org',
  // Source review 2026-07-28 (operator, repo-jy6k.1 local/regional civil
  // rights leaders lane):
  // - floridastateparks.org — Florida Park Service's official site, a
  //   division of the Florida Department of Environmental Protection
  //   (verified via homepage banner + floridadep.gov link); not on the
  //   .gov TLD so it cannot match TIER1_TLDS or TIER1_DOMAINS, but it is the state
  //   agency's own record of a park's namesake history.
  // - floridacivilrightsmuseum.org — Florida Civil Rights Museum, Inc.,
  //   incorporated May 2021 (verified via /about/), backed by a Tallahassee
  //   CRA-funded civil rights memorial project; a dedicated civil-rights
  //   history institution, same evidentiary class as baseballhall.org above.
  'floridastateparks.org',
  'floridacivilrightsmuseum.org',
  // Source review 2026-07-29 (operator, repo-jy6k.1 civil rights leaders
  // lane, second batch — Eula Johnson, Dr. James Sistrunk, Dr. Calvin
  // Shirley, W. George Allen):
  // - thewestsidegazette.com — The Westside Gazette, "Broward County's
  //   oldest and largest African American owned and operated newspaper"
  //   (verified via /about-us/), publishing continuously since 1971.
  // - wlrn.org — WLRN Public Media, South Florida's NPR/PBS member
  //   station, licensed to the Miami-Dade County School Board (verified
  //   via /about); editorially independent public broadcaster, not a
  //   blog or aggregator.
  'thewestsidegazette.com',
  'wlrn.org',
] as const;

export function isReputableSecondaryHost(url: string | undefined): boolean {
  const hostname = normalizeHostname(url);
  if (hostname === undefined) return false;
  return REPUTABLE_SECONDARY_HOST_SUFFIXES.some((suffix) => hostMatches(hostname, suffix));
}

/**
 * Wikipedia/Wikidata are bridge sources only — never corroborating evidence.
 *
 * `hostMatches`, not `hostname.includes('wikipedia.org')`: a substring test also accepts
 * `wikipedia.org.attacker.example`, which would let an unrelated host be quietly demoted to a
 * bridge source, or a hostile one be treated as the encyclopedia
 * (CodeQL js/incomplete-url-substring-sanitization).
 */
export function isWikipediaHost(url: string | undefined): boolean {
  const hostname = normalizeHostname(url);
  if (hostname === undefined) return false;
  return hostMatches(hostname, 'wikipedia.org') || hostMatches(hostname, 'wikidata.org');
}
