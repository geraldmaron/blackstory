/**
 * Tier-1 (federal/state government, courts, official archives) host classification,
 * shared by the auto-promotion gate and the source-corroboration search step so both
 * agree on exactly what counts — one list, not two that can drift apart.
 */
export const TIER1_HOST_PATTERNS: readonly RegExp[] = [
  /\.gov$/iu,
  /\.mil$/iu,
  /(^|\.)nps\.gov$/iu,
  /(^|\.)loc\.gov$/iu,
  /(^|\.)archives\.gov$/iu,
  /(^|\.)si\.edu$/iu,
  /(^|\.)census\.gov$/iu,
];

export function isTier1Host(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return TIER1_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
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

/** Prefer federal place/archive hosts when several Tier-1 links appear on one page. */
const TIER1_HOST_RANK_PATTERNS: readonly RegExp[] = [
  /(^|\.)nps\.gov$/iu,
  /(^|\.)loc\.gov$/iu,
  /planning\.dc\.gov$/iu,
  /(^|\.)archives\.gov$/iu,
  /(^|\.)si\.edu$/iu,
  /(^|\.)census\.gov$/iu,
  /\.gov$/iu,
  /\.mil$/iu,
];

function tier1HostRank(url: string): number {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return -1;
  }
  const index = TIER1_HOST_RANK_PATTERNS.findIndex((pattern) => pattern.test(hostname));
  return index >= 0 ? TIER1_HOST_RANK_PATTERNS.length - index : 0;
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
] as const;

export function isReputableSecondaryHost(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return REPUTABLE_SECONDARY_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

/** Wikipedia/Wikidata are bridge sources only — never corroborating evidence. */
export function isWikipediaHost(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes('wikipedia.org') || hostname.includes('wikidata.org');
  } catch {
    return false;
  }
}
