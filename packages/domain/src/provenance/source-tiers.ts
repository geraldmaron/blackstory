/**
 * Source-quality tier registry.
 *
 * The adapter layer validates shape/volume/drift but not source *quality*. This
 * module classifies a citation URL into a trust tier so gates and the enrichment
 * judge can weight or discard low-quality sources (SEO farms, citation mills,
 * AI-slop laundering) before they create or modify claims.
 *
 * Tiers (highest trust first):
 *   T1 — official statistical agencies + peer-reviewed journals (DOI-resolvable).
 *   T2 — working papers (NBER/Fed), university presses, .edu research centers,
 *        national archives / libraries of record.
 *   T3 — established nonprofits / journalism with a named public methodology.
 *   T4 — everything else (unclassified; treated as untrusted by default).
 *
 * One policy module, consulted by adapter gates, packet/article validate, and
 * the enrichment judge bridge alike — not per-surface copies.
 */
import { normalizeHostname } from './source.js';

export const SOURCE_TIERS = ['T1', 'T2', 'T3', 'T4'] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

/** T1/T2 are the "independent anchor" tiers for the corroboration rule. */
export const ANCHOR_TIERS: readonly SourceTier[] = ['T1', 'T2'];

export type SourceTierRule = {
  /**
   * Registrable-domain suffix, lowercase, no scheme (e.g. "census.gov").
   * Matches the host itself and any subdomain of it. Longest match wins, so a
   * more specific rule (bjs.ojp.gov) overrides a broader one (ojp.gov).
   */
  readonly domain: string;
  readonly tier: SourceTier;
  readonly rationale: string;
};

/**
 * Curated registry. Order does not matter — lookup selects the longest matching
 * domain suffix. Keep entries specific; a bare TLD rule (.gov/.edu) is a
 * deliberate fallback, not a substitute for naming a real statistical agency.
 */
export const SOURCE_TIER_RULES: readonly SourceTierRule[] = [
  // ---- T1: official statistical agencies ----
  { domain: 'census.gov', tier: 'T1', rationale: 'U.S. Census Bureau' },
  { domain: 'bls.gov', tier: 'T1', rationale: 'Bureau of Labor Statistics' },
  { domain: 'bjs.ojp.gov', tier: 'T1', rationale: 'Bureau of Justice Statistics' },
  { domain: 'bjs.gov', tier: 'T1', rationale: 'Bureau of Justice Statistics (legacy host)' },
  { domain: 'cdc.gov', tier: 'T1', rationale: 'Centers for Disease Control (incl. NCHS)' },
  { domain: 'ussc.gov', tier: 'T1', rationale: 'U.S. Sentencing Commission' },
  { domain: 'federalreserve.gov', tier: 'T1', rationale: 'Federal Reserve Board (incl. SCF)' },
  { domain: 'bea.gov', tier: 'T1', rationale: 'Bureau of Economic Analysis' },
  { domain: 'hud.gov', tier: 'T1', rationale: 'HUD (official housing statistics)' },
  { domain: 'huduser.gov', tier: 'T1', rationale: 'HUD User (CHAS, AHS microdata)' },
  { domain: 'eeoc.gov', tier: 'T1', rationale: 'Equal Employment Opportunity Commission' },
  { domain: 'fbi.gov', tier: 'T1', rationale: 'FBI UCR / NIBRS crime statistics' },
  { domain: 'ojp.gov', tier: 'T1', rationale: 'Office of Justice Programs statistical bureaus' },

  // ---- T2: working papers, presses, archives, research libraries ----
  { domain: 'nber.org', tier: 'T2', rationale: 'NBER working papers (pre-peer-review)' },
  {
    domain: 'doi.org',
    tier: 'T2',
    rationale: 'DOI resolver — tier confirmed by DOI check, not host',
  },
  { domain: 'nara.gov', tier: 'T2', rationale: 'National Archives' },
  { domain: 'archives.gov', tier: 'T2', rationale: 'National Archives' },
  { domain: 'loc.gov', tier: 'T2', rationale: 'Library of Congress' },
  { domain: 'si.edu', tier: 'T2', rationale: 'Smithsonian Institution' },
  {
    domain: 'dataverse.harvard.edu',
    tier: 'T2',
    rationale: 'Harvard Dataverse (deposited replication data)',
  },
  { domain: 'openicpsr.org', tier: 'T2', rationale: 'openICPSR replication archive' },
  { domain: 'icpsr.umich.edu', tier: 'T2', rationale: 'ICPSR data archive' },
  {
    domain: 'elloraderenoncourt.com',
    tier: 'T2',
    rationale:
      'Author-hosted replication data for Derenoncourt, Kim, Kuhn & Schularick, "Wealth of Two Nations" (QJE 2024); mirrors the Harvard Dataverse (doi:10.7910/DVN/H6NXUH) and openICPSR 194203 deposits',
  },
  {
    domain: 'fraser.stlouisfed.org',
    tier: 'T2',
    rationale: "FRASER — St. Louis Fed's federal document/economic history archive",
  },
  {
    domain: 'okhistory.org',
    tier: 'T2',
    rationale:
      'Oklahoma Historical Society — state agency archive of record; publisher of the 2001 Tulsa Race Riot Commission report',
  },
  {
    domain: 'supreme.justia.com',
    tier: 'T2',
    rationale: 'Justia Supreme Court — primary case-text archive',
  },
  {
    domain: 'aeaweb.org',
    tier: 'T1',
    rationale: 'American Economic Association — peer-reviewed journal host',
  },
  {
    domain: 'journalofthecivilwarera.org',
    tier: 'T1',
    rationale: 'The Journal of the Civil War Era — peer-reviewed, University of North Carolina Press',
  },
  {
    domain: 'cambridge.org',
    tier: 'T1',
    rationale: 'Cambridge University Press — peer-reviewed journals and academic monographs',
  },
  {
    domain: 'theodorerooseveltcenter.org',
    tier: 'T2',
    rationale: 'Theodore Roosevelt Center, Dickinson State University — digital primary-document archive',
  },
  {
    domain: 'about.usps.com',
    tier: 'T2',
    rationale:
      'United States Postal Service official historian — federal agency history published on a .com host',
  },
  {
    domain: 'forbeslibrary.org',
    tier: 'T2',
    rationale: 'Forbes Library — Calvin Coolidge Presidential Library and Museum, holder of the Coolidge papers',
  },
  {
    domain: 'millercenter.org',
    tier: 'T2',
    rationale:
      'Miller Center, University of Virginia — nonpartisan presidential scholarship; hosts the primary text of presidential speeches and messages',
  },
  {
    domain: 'masshist.org',
    tier: 'T2',
    rationale: 'Massachusetts Historical Society — primary-document archive of record',
  },
  {
    domain: 'fdrlibrary.org',
    tier: 'T2',
    rationale: 'Franklin D. Roosevelt Presidential Library and Museum (NARA presidential library)',
  },
  {
    domain: 'history.army.mil',
    tier: 'T2',
    rationale:
      'U.S. Army Center of Military History — official service history (.mil is not covered by the .gov fallback)',
  },
  {
    domain: 'mil',
    tier: 'T2',
    rationale: 'U.S. military host (unspecified service or command)',
  },

  // Historic sites, state humanities councils and university-published reference works.
  // T3 rather than T2: these are edited, citation-bearing secondary sources with named
  // scholarly programs, not archives holding the primary record themselves.
  {
    domain: 'whitehousehistory.org',
    tier: 'T3',
    rationale:
      'White House Historical Association — Rubenstein Center scholarship on the enslaved households of the presidents',
  },
  {
    domain: 'encyclopediavirginia.org',
    tier: 'T3',
    rationale: 'Encyclopedia Virginia — Virginia Humanities, editorially reviewed and cited entries',
  },
  {
    domain: 'montpelier.org',
    tier: 'T3',
    rationale: "James Madison's Montpelier — museum research program and descendant-community scholarship",
  },
  {
    domain: 'highland.org',
    tier: 'T3',
    rationale: "James Monroe's Highland — historic site research program (William & Mary)",
  },
  {
    domain: 'thehermitage.com',
    tier: 'T3',
    rationale: "Andrew Jackson's Hermitage — museum research and site archaeology",
  },
  {
    domain: 'scencyclopedia.org',
    tier: 'T3',
    rationale: 'South Carolina Encyclopedia — USC Institute for Southern Studies',
  },
  {
    domain: 'philadelphiaencyclopedia.org',
    tier: 'T3',
    rationale: 'Encyclopedia of Greater Philadelphia — Rutgers University-Camden',
  },
  {
    domain: 'factcheck.org',
    tier: 'T3',
    rationale: 'FactCheck.org — Annenberg Public Policy Center, University of Pennsylvania',
  },
  {
    domain: 'civilrights.org',
    tier: 'T3',
    rationale: 'The Leadership Conference on Civil and Human Rights — published research reports',
  },
  { domain: 'pbs.org', tier: 'T3', rationale: 'PBS — public broadcaster, documented sourcing' },
  {
    domain: 'ncpedia.org',
    tier: 'T3',
    rationale: 'NCpedia — State Library of North Carolina, edited and cited reference work',
  },
  {
    domain: 'gilderlehrman.org',
    tier: 'T3',
    rationale: 'Gilder Lehrman Institute of American History — curated primary sources with scholarly essays',
  },
  {
    domain: 'tshaonline.org',
    tier: 'T3',
    rationale: 'Texas State Historical Association — Handbook of Texas, edited and cited entries',
  },

  // ---- T3: established nonprofits / journalism with named methodology ----
  { domain: 'vera.org', tier: 'T3', rationale: 'Vera Institute of Justice' },
  { domain: 'sentencingproject.org', tier: 'T3', rationale: 'The Sentencing Project' },
  { domain: 'evictionlab.org', tier: 'T3', rationale: 'Eviction Lab (Princeton)' },
  { domain: 'brennancenter.org', tier: 'T3', rationale: 'Brennan Center for Justice' },
  { domain: 'propublica.org', tier: 'T3', rationale: 'ProPublica (documented methodology)' },
  { domain: 'pewresearch.org', tier: 'T3', rationale: 'Pew Research Center' },
  { domain: 'urban.org', tier: 'T3', rationale: 'Urban Institute' },
  {
    domain: 'crmvet.org',
    tier: 'T3',
    rationale: 'Civil Rights Movement Archive (primary-document archive)',
  },
  {
    domain: 'tulsahistory.org',
    tier: 'T3',
    rationale: 'Tulsa Historical Society & Museum (named collections, primary-document archive)',
  },

  // ---- generic fallbacks (least specific; longest-match keeps these last) ----
  { domain: 'gov', tier: 'T2', rationale: 'U.S. government host (unspecified agency)' },
  { domain: 'edu', tier: 'T2', rationale: 'Academic institution (unspecified)' },
];

export type SourceTierResult = {
  readonly tier: SourceTier;
  readonly rationale: string;
  /** The rule domain that matched, or null when nothing matched (defaulted to T4). */
  readonly matchedDomain: string | null;
  readonly hostname: string;
};

/** A rule matches when the host equals its domain or is a subdomain of it. */
function ruleMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Classify a citation URL into a source-quality tier. Unmatched hosts default to
 * T4 (untrusted). Throws only on an unparseable/empty URL — callers that must
 * tolerate junk should catch and treat failures as T4.
 */
export function lookupSourceTier(url: string): SourceTierResult {
  const hostname = normalizeHostname(url);
  let best: SourceTierRule | null = null;
  for (const rule of SOURCE_TIER_RULES) {
    if (!ruleMatches(hostname, rule.domain)) continue;
    if (best === null || rule.domain.length > best.domain.length) best = rule;
  }
  if (best === null) {
    return { tier: 'T4', rationale: 'unclassified host', matchedDomain: null, hostname };
  }
  return { tier: best.tier, rationale: best.rationale, matchedDomain: best.domain, hostname };
}

/** True when the URL resolves to a tier eligible to serve as an independent anchor (T1/T2). */
export function isAnchorTierUrl(url: string): boolean {
  try {
    return ANCHOR_TIERS.includes(lookupSourceTier(url).tier);
  } catch {
    return false;
  }
}
