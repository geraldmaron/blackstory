/**
 * Deterministic obscurity scoring for discovery candidates.
 *
 * Goal: surface catalog-relative "obscure" leads (local, thinly attested, not already matched)
 * without claiming historical importance, completeness, or underrepresentation as fact.
 *
/**
 * Score ∈ [0, 1]. Higher = more obscure *relative to the supplied reference corpus and
 * optional catalogMatch*. Methodology version is stamped on every result for audit replay.
 *
 *   S = clip01(
 *         w_n·N + w_i·I + w_r·R + w_g·G + w_a·A + w_d·D − w_v·V − w_b·B
 *       )
 *
 * N=catalog novelty, I=identifier sparseness, R=name rarity (smooth IDF),
 * G=geographic specificity, A=low-authority discovery boost, D=history-day framing boost,
 * V=high-visibility name penalty, B=brand/commerce framing penalty.
 */
import { isTrustedIdentifierNamespace } from '../naming.js';
import { isLowAuthoritySourceTier } from '../relevance/gates.js';
import type { DiscoveryCandidateRecord } from './types.js';

export const OBSCURITY_METHODOLOGY_VERSION = 'obscurity.v1' as const;

/** Public-safe disclaimer — not folded into DISCLAIMER_CLASSES (constitution-locked set). */
export const OBSCURITY_METHODOLOGY_DISCLAIMER = {
  id: 'methodology_obscurity_heuristic_v1',
  title: 'About obscurity scores',
  reviewDate: '2026-07-18',
  body:
    'Obscurity scores are a relative, catalog-conditioned heuristic. A high score means a lead ' +
    'is less attested in our current catalog and reference name corpus — not that the subject ' +
    'is more important, more true, more complete, or “hidden history” validated. Scores can ' +
    'change as the catalog grows. They never authorize publication by themselves.',
} as const;

/**
 * Default weights (sum = 1). Documented so operators can audit the equation:
 *
 *   S = clip01(
 *         w_n · N  +  w_i · I  +  w_r · R  +  w_g · G  +  w_a · A  −  w_v · V
 *       )
 *
 * where N=catalog novelty, I=identifier sparseness, R=name rarity (IDF),
 * G=geographic specificity, A=small low-authority discovery boost,
 * V=high-visibility name penalty.
 */
export const OBSCURITY_WEIGHTS = {
  catalogNovelty: 0.3,
  identifierSparseness: 0.14,
  nameRarity: 0.22,
  geographicSpecificity: 0.1,
  lowAuthorityBoost: 0.06,
  historyDayBoost: 0.08,
  highVisibilityPenalty: 0.22,
  brandCommercePenalty: 0.2,
} as const;

/** Names that are widely attested in US Black-history education surfaces (penalty corpus). */
export const HIGH_VISIBILITY_NAME_PHRASES = [
  'rosa parks',
  'martin luther king',
  'mlk',
  'malcolm x',
  'harriet tubman',
  'frederick douglass',
  'buffalo soldiers',
  'tuskegee airmen',
  'emmett till',
  'ida b wells',
  'ida b. wells',
  'w.e.b. du bois',
  'web du bois',
  'booker t washington',
  'booker t. washington',
] as const;

/** Title patterns that look like brand/commerce storytelling rather than place-history leads. */
export const BRAND_COMMERCE_TITLE_PATTERNS = [
  /\bblack bags\b/i,
  /\bvol\.?\s*\d+/i,
  /\bshop\b/i,
  /\bbrand storytelling\b/i,
  /\bintroducing\b/i,
] as const;

/** ABS-style dated history-day titles — weak positive for place/person history framing. */
export const HISTORY_DAY_TITLE_PATTERN = /^day\s+\d+/i;

export type ObscurityFactorId =
  | 'catalog_novelty'
  | 'identifier_sparseness'
  | 'name_rarity'
  | 'geographic_specificity'
  | 'low_authority_boost'
  | 'history_day_boost'
  | 'high_visibility_penalty'
  | 'brand_commerce_penalty';

export type ObscurityFactorBreakdown = {
  readonly factor: ObscurityFactorId;
  /** Contribution after weight (can be negative for penalties). */
  readonly weighted: number;
  /** Raw factor in [0, 1] before weight (penalty raw is also [0,1]). */
  readonly raw: number;
  readonly rationale: string;
};

export type ObscurityAssessment = {
  readonly methodologyVersion: typeof OBSCURITY_METHODOLOGY_VERSION;
  readonly candidateId: string;
  /** Final clipped score in [0, 1]. */
  readonly score: number;
  /** Discrete band for UI / queue routing. */
  readonly band: 'common' | 'notable' | 'obscure' | 'highly_obscure';
  readonly factors: readonly ObscurityFactorBreakdown[];
  readonly disclaimerId: typeof OBSCURITY_METHODOLOGY_DISCLAIMER.id;
  readonly assessedAt: string;
};

export type ObscurityReferenceCorpus = {
  /** Display names / titles from the active catalog (or a gold subset) for IDF. */
  readonly catalogTitles: readonly string[];
};

export type ScoreObscurityInput = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly corpus: ObscurityReferenceCorpus;
  readonly assessedAt: string;
};

const TOKEN_RE = /[a-z0-9]+/g;

function clip01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function tokenize(text: string): readonly string[] {
  const normalized = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
  return normalized.match(TOKEN_RE) ?? [];
}

function candidateText(candidate: DiscoveryCandidateRecord): string {
  const summary =
    typeof candidate.adapterRecord.payload?.summary === 'string'
      ? candidate.adapterRecord.payload.summary
      : '';
  return `${candidate.adapterRecord.title ?? ''} ${summary}`;
}

/**
 * Catalog novelty N ∈ [0,1]:
 *   proposed_match with confidence c → 1 − c
 *   review_required → 0.55
 *   no_match / missing → 1.0
 */
export function catalogNoveltyRaw(candidate: DiscoveryCandidateRecord): {
  readonly raw: number;
  readonly rationale: string;
} {
  const match = candidate.catalogMatch;
  if (!match) {
    return {
      raw: 1,
      rationale: 'No catalogMatch attached — treat as fully novel pending catalog blocking.',
    };
  }
  if (match.outcome === 'no_match') {
    return { raw: 1, rationale: 'Catalog blocking returned no_match.' };
  }
  if (match.outcome === 'review_required') {
    return { raw: 0.55, rationale: 'Catalog blocking requires human review (ambiguous/low confidence).' };
  }
  const confidence = match.topMatches[0]?.confidence ?? 0.9;
  const raw = clip01(1 - confidence);
  return {
    raw,
    rationale: `Proposed catalog match confidence ${confidence.toFixed(3)} → novelty ${raw.toFixed(3)}.`,
  };
}

/**
 * Identifier sparseness I ∈ [0,1]:
 *   I = 1 − min(1, trustedIdCount / 2)
 */
export function identifierSparsenessRaw(candidate: DiscoveryCandidateRecord): {
  readonly raw: number;
  readonly rationale: string;
} {
  const identifiers = candidate.adapterRecord.payload?.identifiers;
  let trusted = 0;
  if (identifiers && typeof identifiers === 'object' && !Array.isArray(identifiers)) {
    for (const [namespace, value] of Object.entries(identifiers)) {
      if (typeof value === 'string' && value.trim() && isTrustedIdentifierNamespace(namespace)) {
        trusted += 1;
      }
    }
  }
  const raw = clip01(1 - Math.min(1, trusted / 2));
  return {
    raw,
    rationale:
      trusted === 0
        ? 'No trusted-namespace identifiers on the candidate payload.'
        : `${trusted} trusted identifier(s) → sparseness ${raw.toFixed(3)}.`,
  };
}

/**
 * Smooth IDF name rarity R ∈ [0,1].
 *
 * For each token t in the candidate title/summary:
 *   idf(t) = ln((N + 1) / (df(t) + 1)) + 1
 * R = mean(idf(t)) / idf_max, where idf_max = ln(N+1) + 1 (token unseen in corpus).
 */
export function nameRarityRaw(
  candidate: DiscoveryCandidateRecord,
  corpus: ObscurityReferenceCorpus,
): { readonly raw: number; readonly rationale: string } {
  const tokens = tokenize(candidateText(candidate));
  if (tokens.length === 0) {
    return { raw: 0.5, rationale: 'No tokens to score — neutral rarity.' };
  }

  const docs = corpus.catalogTitles.map((title) => new Set(tokenize(title)));
  const n = Math.max(docs.length, 1);
  const df = new Map<string, number>();
  for (const token of new Set(tokens)) {
    let count = 0;
    for (const doc of docs) {
      if (doc.has(token)) count += 1;
    }
    df.set(token, count);
  }

  const idfMax = Math.log(n + 1) + 1;
  let sum = 0;
  for (const token of tokens) {
    const documentFrequency = df.get(token) ?? 0;
    const idf = Math.log((n + 1) / (documentFrequency + 1)) + 1;
    sum += idf;
  }
  const meanIdf = sum / tokens.length;
  const raw = clip01(meanIdf / idfMax);
  return {
    raw,
    rationale: `Mean smooth-IDF ${meanIdf.toFixed(3)} / max ${idfMax.toFixed(3)} over ${tokens.length} token(s), corpus N=${n}.`,
  };
}

/**
 * Geographic specificity G ∈ [0,1]:
 *   city/region hint → 0.85, state → 0.45, country/unknown-only → 0.2, none → 0.35
 * (Local place detail raises obscurity potential nationally; absence is mid — many obscure
 * leads also lack geo.)
 */
export function geographicSpecificityRaw(candidate: DiscoveryCandidateRecord): {
  readonly raw: number;
  readonly rationale: string;
} {
  const hints = candidate.geographicHints;
  if (hints.length === 0) {
    return { raw: 0.35, rationale: 'No geographic hints — mid specificity.' };
  }
  if (hints.some((hint) => hint.kind === 'city' || hint.kind === 'region')) {
    return { raw: 0.85, rationale: 'City/region geographic hint present.' };
  }
  if (hints.some((hint) => hint.kind === 'state')) {
    return { raw: 0.45, rationale: 'State-level geographic hint only.' };
  }
  return { raw: 0.2, rationale: 'Only country/unknown geographic hints.' };
}

export function lowAuthorityBoostRaw(candidate: DiscoveryCandidateRecord): {
  readonly raw: number;
  readonly rationale: string;
} {
  const classification = candidate.adapterRecord.classification;
  if (isLowAuthoritySourceTier(classification)) {
    return {
      raw: 1,
      rationale: `Low-authority tier (${classification}) — small discovery boost only.`,
    };
  }
  return { raw: 0, rationale: 'Not a low-authority source tier.' };
}

/**
 * High-visibility penalty V ∈ [0,1]: 1 if title/summary contains a curated high-visibility phrase.
 */
export function highVisibilityPenaltyRaw(candidate: DiscoveryCandidateRecord): {
  readonly raw: number;
  readonly rationale: string;
} {
  const text = candidateText(candidate).toLowerCase();
  for (const phrase of HIGH_VISIBILITY_NAME_PHRASES) {
    if (text.includes(phrase)) {
      return {
        raw: 1,
        rationale: `Matched high-visibility phrase “${phrase}”.`,
      };
    }
  }
  return { raw: 0, rationale: 'No high-visibility phrase match.' };
}

export function historyDayBoostRaw(candidate: DiscoveryCandidateRecord): {
  readonly raw: number;
  readonly rationale: string;
} {
  const title = candidate.adapterRecord.title ?? '';
  if (HISTORY_DAY_TITLE_PATTERN.test(title.trim())) {
    return { raw: 1, rationale: 'Title matches history-day framing (Day N — …).' };
  }
  return { raw: 0, rationale: 'No history-day title framing.' };
}

export function brandCommercePenaltyRaw(candidate: DiscoveryCandidateRecord): {
  readonly raw: number;
  readonly rationale: string;
} {
  const title = candidate.adapterRecord.title ?? '';
  for (const pattern of BRAND_COMMERCE_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return {
        raw: 1,
        rationale: `Title matched brand/commerce pattern ${pattern}.`,
      };
    }
  }
  return { raw: 0, rationale: 'No brand/commerce title pattern.' };
}

export function obscurityBand(score: number): ObscurityAssessment['band'] {
  if (score >= 0.72) return 'highly_obscure';
  if (score >= 0.55) return 'obscure';
  if (score >= 0.35) return 'notable';
  return 'common';
}

/**
 * Score a discovery candidate for catalog-relative obscurity.
 * Pure function — no I/O, no publish side effects.
 */
export function scoreObscurity(input: ScoreObscurityInput): ObscurityAssessment {
  const novelty = catalogNoveltyRaw(input.candidate);
  const identifiers = identifierSparsenessRaw(input.candidate);
  const rarity = nameRarityRaw(input.candidate, input.corpus);
  const geo = geographicSpecificityRaw(input.candidate);
  const authority = lowAuthorityBoostRaw(input.candidate);
  const historyDay = historyDayBoostRaw(input.candidate);
  const visibility = highVisibilityPenaltyRaw(input.candidate);
  const brand = brandCommercePenaltyRaw(input.candidate);

  const factors: ObscurityFactorBreakdown[] = [
    {
      factor: 'catalog_novelty',
      raw: novelty.raw,
      weighted: OBSCURITY_WEIGHTS.catalogNovelty * novelty.raw,
      rationale: novelty.rationale,
    },
    {
      factor: 'identifier_sparseness',
      raw: identifiers.raw,
      weighted: OBSCURITY_WEIGHTS.identifierSparseness * identifiers.raw,
      rationale: identifiers.rationale,
    },
    {
      factor: 'name_rarity',
      raw: rarity.raw,
      weighted: OBSCURITY_WEIGHTS.nameRarity * rarity.raw,
      rationale: rarity.rationale,
    },
    {
      factor: 'geographic_specificity',
      raw: geo.raw,
      weighted: OBSCURITY_WEIGHTS.geographicSpecificity * geo.raw,
      rationale: geo.rationale,
    },
    {
      factor: 'low_authority_boost',
      raw: authority.raw,
      weighted: OBSCURITY_WEIGHTS.lowAuthorityBoost * authority.raw,
      rationale: authority.rationale,
    },
    {
      factor: 'history_day_boost',
      raw: historyDay.raw,
      weighted: OBSCURITY_WEIGHTS.historyDayBoost * historyDay.raw,
      rationale: historyDay.rationale,
    },
    {
      factor: 'high_visibility_penalty',
      raw: visibility.raw,
      weighted: -OBSCURITY_WEIGHTS.highVisibilityPenalty * visibility.raw,
      rationale: visibility.rationale,
    },
    {
      factor: 'brand_commerce_penalty',
      raw: brand.raw,
      weighted: -OBSCURITY_WEIGHTS.brandCommercePenalty * brand.raw,
      rationale: brand.rationale,
    },
  ];

  const score = clip01(Number(factors.reduce((sum, factor) => sum + factor.weighted, 0).toFixed(4)));

  return {
    methodologyVersion: OBSCURITY_METHODOLOGY_VERSION,
    candidateId: input.candidate.id,
    score,
    band: obscurityBand(score),
    factors,
    disclaimerId: OBSCURITY_METHODOLOGY_DISCLAIMER.id,
    assessedAt: input.assessedAt,
  };
}

export function rankByObscurity(
  assessments: readonly ObscurityAssessment[],
): readonly ObscurityAssessment[] {
  return [...assessments].sort(
    (left, right) =>
      right.score - left.score || left.candidateId.localeCompare(right.candidateId),
  );
}
