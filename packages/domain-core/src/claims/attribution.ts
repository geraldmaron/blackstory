/**
 * Attribution language: what a sentence claims, versus what its receipt covers.
 *
 * "Lewis Latimer invented the light bulb" and "Lewis Latimer patented an improved process for
 * manufacturing carbon conductors used in incandescent lamps" cite the same patent. One of them
 * is false. Nothing in a confidence score can tell them apart, because the difference is not in
 * the evidence — it is in the verb and the noun the sentence attaches to it.
 *
 * This module is deterministic and cheap on purpose. Noticing that a sentence says "invented the
 * X" while its only receipt is a patent titled "Improvement in Y" does not need a model, and a
 * model is the wrong instrument for a rule that must never drift.
 *
 * It reports; it does not rewrite. A finding here is a research task or a correction, not a
 * license to auto-edit published prose.
 */
import {
  type AssertionClass,
  type SourceClass,
  assessSourceFitness,
  isHighImpactAssertion,
} from './source-fitness.js';

/**
 * Verbs that claim origination of a whole thing.
 *
 * These are high-impact because they are unbounded: "invented the traffic light" claims the
 * category, not the contribution. Longer phrases come first so "inventor of" is not reported
 * as a bare "invent".
 */
export const BROAD_ATTRIBUTION_TERMS: readonly string[] = [
  'inventor of',
  'invented',
  'invents',
  'invent',
  'originated',
  'pioneered',
  'revolutionized',
  'revolutionised',
  'created the',
  'father of',
  'mother of',
];

/**
 * Verbs that state a bounded contribution.
 *
 * Every one of these can be true of a person who did not originate the category, which is what
 * makes them safe: they describe the act the evidence records.
 */
export const BOUNDED_ATTRIBUTION_TERMS: readonly string[] = [
  'patented',
  'co-invented',
  'co invented',
  'improved',
  'developed',
  'designed',
  'worked on',
  'led development of',
  'led the development of',
  'commercialized',
  'commercialised',
  'documented',
  'adapted',
  'created a process for',
  'created an improvement to',
  'contributed to',
];

/** Words that assert a place in an ordering, which needs a source that researched the ordering. */
export const SUPERLATIVE_TERMS: readonly string[] = [
  'first-ever',
  'first ever',
  'the first',
  'first black',
  'first african american',
  'earliest',
  'the only',
  'only person',
  'largest',
  'oldest',
  'sole inventor',
  'never before',
];

/** Words that assert consequence, which needs evidence of the consequence and not of the thing. */
export const IMPACT_TERMS: readonly string[] = [
  'led to',
  'gave rise to',
  'changed the world',
  'transformed',
  'made possible',
  'paved the way',
  'caused',
  'sparked',
];

/** Words that assert uptake, which needs commercial or trade evidence rather than a grant. */
export const COMMERCIAL_TERMS: readonly string[] = [
  'widely adopted',
  'mass-produced',
  'mass produced',
  'best-selling',
  'made a fortune',
  'industry standard',
  'used worldwide',
  'sold millions',
];

export type AttributionMarker = {
  readonly term: string;
  readonly kind: 'broad_attribution' | 'superlative' | 'impact' | 'commercial' | 'bounded';
  readonly assertionClass: AssertionClass;
};

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[‘’]/gu, "'").replace(/\s+/gu, ' ')} `;
}

/**
 * Whether a normalized haystack contains a term as a phrase.
 *
 * Matching is on word boundaries built from the surrounding characters rather than a regular
 * expression over the raw text, so "reinvented" does not report as "invented" and a long
 * sentence cannot become a pathological pattern input.
 *
 * A hyphen counts as a word character here, which is the difference between reading
 * "co-invented" as the bounded verb it is and reading it as a broad claim of origination. The
 * hyphenated forms that ARE terms ("first-ever", "co-invented") carry their own entries, so
 * nothing is lost by treating the hyphen as internal.
 */
function containsPhrase(haystack: string, term: string): boolean {
  let index = haystack.indexOf(term);
  while (index !== -1) {
    const before = haystack[index - 1];
    const after = haystack[index + term.length];
    const boundedLeft = before === undefined || !/[a-z0-9-]/u.test(before);
    const boundedRight = after === undefined || !/[a-z0-9-]/u.test(after);
    if (boundedLeft && boundedRight) return true;
    index = haystack.indexOf(term, index + 1);
  }
  return false;
}

const MARKER_GROUPS: readonly {
  readonly terms: readonly string[];
  readonly kind: AttributionMarker['kind'];
  readonly assertionClass: AssertionClass;
}[] = [
  {
    terms: BROAD_ATTRIBUTION_TERMS,
    kind: 'broad_attribution',
    assertionClass: 'invention_attribution',
  },
  { terms: SUPERLATIVE_TERMS, kind: 'superlative', assertionClass: 'superlative' },
  { terms: IMPACT_TERMS, kind: 'impact', assertionClass: 'societal_impact' },
  { terms: COMMERCIAL_TERMS, kind: 'commercial', assertionClass: 'commercial_impact' },
  { terms: BOUNDED_ATTRIBUTION_TERMS, kind: 'bounded', assertionClass: 'invention_attribution' },
];

/**
 * Every attribution marker in a sentence.
 *
 * A sentence can carry several: "was the first to invent and widely commercialize X" is a
 * superlative, an attribution and a commercial claim, and each needs its own receipt.
 */
export function findAttributionMarkers(text: string): readonly AttributionMarker[] {
  const haystack = normalize(text);
  const found: AttributionMarker[] = [];
  const claimed = new Set<string>();
  for (const group of MARKER_GROUPS) {
    for (const term of group.terms) {
      if (!containsPhrase(haystack, term)) continue;
      // A longer phrase already reported covers the shorter one inside it: "inventor of"
      // should not also report as "invented".
      if ([...claimed].some((seen) => seen.includes(term) || term.includes(seen))) continue;
      claimed.add(term);
      found.push({ term, kind: group.kind, assertionClass: group.assertionClass });
    }
  }
  return found;
}

/** The assertion classes a sentence is making, from its language alone. */
export function assertionClassesInText(text: string): readonly AssertionClass[] {
  const classes = new Set<AssertionClass>();
  for (const marker of findAttributionMarkers(text)) {
    // A bounded verb is still an attribution; it is just an honest one.
    classes.add(marker.assertionClass);
  }
  return [...classes];
}

/** True when a sentence claims origination of a whole category rather than a contribution. */
export function makesBroadAttribution(text: string): boolean {
  return findAttributionMarkers(text).some((m) => m.kind === 'broad_attribution');
}

export function makesSuperlativeClaim(text: string): boolean {
  return findAttributionMarkers(text).some((m) => m.kind === 'superlative');
}

/**
 * Bounded wording that says what the evidence actually shows.
 *
 * Suggestions only. A sentence is rewritten by a person or by the prose lane working from
 * accepted evidence, never by this function.
 */
export function boundedAlternativesFor(term: string): readonly string[] {
  switch (term) {
    case 'invented':
    case 'invents':
    case 'inventor of':
      return ['patented', 'co-invented', 'developed', 'created a process for', 'improved'];
    case 'created the':
      return ['created an improvement to', 'designed', 'developed'];
    case 'originated':
    case 'pioneered':
      return ['developed', 'led development of', 'worked on'];
    case 'revolutionized':
    case 'revolutionised':
      return ['improved', 'commercialized'];
    case 'father of':
    case 'mother of':
      return ['an early contributor to', 'developed'];
    default:
      return [];
  }
}

/**
 * A patent title that describes an improvement rather than an origination.
 *
 * Nineteenth and early twentieth century US patents say this in the title as a matter of
 * drafting convention — "Improvement in Lubricators", "Process of Manufacturing Carbons" —
 * which makes the title a usable, if partial, signal about scope. It is a signal, not a proof:
 * a title without one of these words does not mean the patent covers a whole category, which
 * is why the finding this produces is a research prompt and not a verdict.
 */
const IMPROVEMENT_TITLE_TERMS: readonly string[] = [
  'improvement',
  'improvements',
  'improved',
  'process of',
  'process for',
  'method of',
  'method for',
  'attachment',
  'device for',
  'apparatus for',
];

export function patentTitleSuggestsImprovement(title: string): boolean {
  const haystack = normalize(title);
  return IMPROVEMENT_TITLE_TERMS.some((term) => containsPhrase(haystack, term));
}

export type AttributionFinding = {
  readonly code:
    | 'invention_scope_broader_than_patent'
    | 'superlative_without_institutional_support'
    | 'unsupported_commercial_impact_claim'
    | 'unsupported_societal_impact_claim'
    | 'patent_used_as_racial_identity_evidence'
    | 'inventor_team_or_coinventor_unresolved';
  readonly explanation: string;
  /** What would resolve it, phrased as the evidence to go and find. */
  readonly remediation: string;
  readonly marker?: string;
};

export type AttributionCheckInput = {
  /** The public-facing sentence or claim object being checked. */
  readonly statement: string;
  /** The source classes actually attached to this statement. */
  readonly supportingSourceClasses: readonly SourceClass[];
  /** Patent title, where a patent is the technical receipt. */
  readonly patentTitle?: string | undefined;
  /** Inventor names exactly as the patent publishes them. */
  readonly patentInventorNames?: readonly string[] | undefined;
  /** Whether this statement names a single person as the contributor. */
  readonly attributesToSinglePerson?: boolean | undefined;
};

/**
 * Check a public statement against what its receipts can carry.
 *
 * Every finding names the evidence that would settle it, because the point is to direct
 * research rather than to score prose.
 */
export function checkAttribution(input: AttributionCheckInput): readonly AttributionFinding[] {
  const findings: AttributionFinding[] = [];
  const markers = findAttributionMarkers(input.statement);
  const sources = input.supportingSourceClasses;

  const fitFor = (assertion: AssertionClass): boolean =>
    sources.some((source) => {
      const { fitness } = assessSourceFitness(source, assertion);
      return fitness === 'authoritative' || fitness === 'strong' || fitness === 'conditional';
    });

  /**
   * A claim to have invented a whole category is a claim about PRIORITY, and a patent grant
   * does not adjudicate priority — it records what one applicant filed. So a broad attribution
   * needs a source that is strong or better for attribution: a file wrapper, an interference
   * record, a court record, or scholarship. A bare patent specification sits at `conditional`,
   * which is enough to say "patented" and not enough to say "invented the traffic light".
   */
  const settlesAttribution = sources.some((source) => {
    const { fitness } = assessSourceFitness(source, 'invention_attribution');
    return fitness === 'authoritative' || fitness === 'strong';
  });

  for (const marker of markers) {
    if (marker.kind === 'broad_attribution') {
      const improvementPatent =
        input.patentTitle !== undefined && patentTitleSuggestsImprovement(input.patentTitle);
      if (improvementPatent) {
        findings.push({
          code: 'invention_scope_broader_than_patent',
          marker: marker.term,
          explanation: `The statement says "${marker.term}" while its patent receipt is titled "${input.patentTitle}", which describes a bounded improvement or process rather than origination of the category.`,
          remediation: `State the bounded contribution the patent records. Candidates: ${boundedAlternativesFor(marker.term).join(', ')}. Widening beyond the patent needs a scholarly or institutional source that researched priority.`,
        });
      } else if (!settlesAttribution) {
        findings.push({
          code: 'invention_scope_broader_than_patent',
          marker: marker.term,
          explanation: `The statement says "${marker.term}", which claims origination of the whole thing, and no attached source can settle priority. A patent grant records what one applicant filed; it does not establish that nobody else got there first.`,
          remediation: `Attach a patent file wrapper, an interference record, a court record or peer-reviewed scholarship on priority — or state the bounded contribution instead: ${boundedAlternativesFor(marker.term).join(', ')}.`,
        });
      }
    }

    if (marker.kind === 'superlative' && !fitFor('superlative')) {
      findings.push({
        code: 'superlative_without_institutional_support',
        marker: marker.term,
        explanation: `The statement claims "${marker.term}" and no attached source is fit to establish an ordering. A patent grant, a bridge and a modern secondary retelling all fail this.`,
        remediation:
          'Find an institution or scholar that states the scope of the superlative itself, or bound the claim to what is documented (for example "first known" rather than "first").',
      });
    }

    if (marker.kind === 'commercial' && !fitFor('commercial_impact')) {
      findings.push({
        code: 'unsupported_commercial_impact_claim',
        marker: marker.term,
        explanation: `The statement claims adoption ("${marker.term}") with no trade, company or period source attached.`,
        remediation:
          'Attach contemporaneous trade press, a company record, or an assignment record.',
      });
    }

    if (marker.kind === 'impact' && !fitFor('societal_impact')) {
      findings.push({
        code: 'unsupported_societal_impact_claim',
        marker: marker.term,
        explanation: `The statement claims consequence ("${marker.term}") with no source fit to establish it.`,
        remediation:
          'Attach scholarship or curatorial history that argues the consequence, or drop the claim.',
      });
    }
  }

  // A patent that names more than one inventor cannot support a sole-inventor sentence.
  // This is the West/Sessler, Sampson/Miley, Brown/Brown and Jones/Numero case.
  const inventors = input.patentInventorNames ?? [];
  if (inventors.length > 1 && input.attributesToSinglePerson === true) {
    findings.push({
      code: 'inventor_team_or_coinventor_unresolved',
      explanation: `The patent names ${inventors.length} inventors (${inventors.join(', ')}) and the statement attributes the work to one person.`,
      remediation:
        'State co-invention and model every named inventor, including those outside this catalog. Centring one contributor is editorial; erasing the others is an error.',
    });
  }

  return findings;
}

/**
 * Whether a set of sources can support a community-identity claim.
 *
 * Separated from checkAttribution because it is asked about a person rather than a sentence,
 * and because the failure it detects — reaching for a technical record to answer a question the
 * technical record cannot answer — is the single most important guard in this module.
 */
export function checkCommunityIdentityEvidence(
  supportingSourceClasses: readonly SourceClass[],
): readonly AttributionFinding[] {
  if (supportingSourceClasses.length === 0) return [];
  const anyFit = supportingSourceClasses.some((source) => {
    const { fitness } = assessSourceFitness(source, 'community_identity');
    return fitness === 'authoritative' || fitness === 'strong' || fitness === 'conditional';
  });
  if (anyFit) return [];

  const technicalOnly = supportingSourceClasses.every(
    (source) => assessSourceFitness(source, 'community_identity').fitness === 'unfit',
  );
  return [
    {
      code: 'patent_used_as_racial_identity_evidence',
      explanation: technicalOnly
        ? 'The only sources attached are records that cannot establish community identity. The Patent Office did not record inventor race.'
        : 'No attached source is fit to establish that this person belongs in a Black-history corpus.',
      remediation:
        'Find an independent historical receipt: a Baker-era compilation, a USPTO or Smithsonian historical biography, an NPS or Library of Congress account, archival correspondence, credible contemporary Black press, or scholarship.',
    },
  ];
}

/** Assertion classes present in a statement that need more than one independent lineage. */
export function highImpactAssertionsInText(text: string): readonly AssertionClass[] {
  return assertionClassesInText(text).filter(isHighImpactAssertion);
}
