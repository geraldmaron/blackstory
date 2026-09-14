/**
 * Finds `first_to_do_x` / `only_or_oldest` notability-basis rows whose ONLY supporting evidence
 * is Wikipedia — the exact defect repo-z97f exists to catch (repo-wqtq: William F. Penn's record
 * asserted "First African American to graduate from Yale Medical School (1897)" on Wikipedia's
 * authority alone, and Yale says the actual first was Cortlandt Van Rensselaer Creed, MD 1857).
 *
 * docs/research/citation-standard.md is unambiguous: Wikipedia may carry a claim but never
 * corroborates one and is never sufficient for a superlative. This module answers, for the
 * published catalog, which `first_to_do_x`/`only_or_oldest` basis records violate that — so each
 * can be corroborated institutionally, softened, or withdrawn, per the standard.
 *
 * NOT the general research-quality audit (packages/operator-cli/src/research-quality-audit.ts).
 * That tool flags every `superlative`-class claim regardless of criterion or citation, and does
 * not know whether the superlative reached the published summary. This is narrower and
 * criterion-scoped, matching exactly what the bead asks for: the two criteria whose text is a
 * public "why this is here" ranking claim, and whether it is corroborated, and whether the
 * uncorroborated version is what a reader actually sees.
 *
 * Pure and read-only: takes rows already fetched from `bb_public.release_entities`, returns
 * findings. The DB read lives in the sibling CLI script so this stays testable without Postgres.
 */
import { makesSuperlativeClaim } from '@repo/domain-core';

/** The two criteria whose text is itself a superlative ranking claim (entity-status.ts). */
export const TARGET_CRITERIA = ['first_to_do_x', 'only_or_oldest'] as const;
export type TargetCriterion = (typeof TARGET_CRITERIA)[number];

function isTargetCriterion(criterion: string): criterion is TargetCriterion {
  return (TARGET_CRITERIA as readonly string[]).includes(criterion);
}

export type AuditClaim = {
  readonly id: string;
  readonly predicate?: string;
  readonly object?: string;
  readonly citationHref?: string;
  readonly citationSource?: string;
};

export type AuditNotabilityBasis = {
  readonly criterion: string;
  readonly note: string;
  readonly evidenceIds: readonly string[];
};

export type AuditEntity = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: string;
  readonly summary?: string | null;
  readonly claims: readonly AuditClaim[];
  readonly notabilityBasis: readonly AuditNotabilityBasis[];
};

export type SuperlativeAuditFinding = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: string;
  readonly criterion: TargetCriterion;
  readonly note: string;
  readonly evidenceIds: readonly string[];
  /** evidenceIds that resolved to a real claim on this entity's `claims` array. */
  readonly resolvedClaimIds: readonly string[];
  /** evidenceIds naming no claim on this entity — a data-integrity gap, distinct from the finding. */
  readonly danglingEvidenceIds: readonly string[];
  /** Deduped citation hosts behind the resolved claims (all wikipedia.org for every finding here). */
  readonly citedHosts: readonly string[];
  /** Whether the entity carries a non-Wikipedia claim ANYWHERE, not just on this basis record. */
  readonly entityHasNonWikipediaClaimElsewhere: boolean;
  /** Whether the published summary text itself makes a superlative-language claim. */
  readonly summaryCarriesSuperlative: boolean;
  readonly summaryExcerpt?: string;
};

/** Host a claim's citation resolves to, lower-cased and stripped of a leading www. */
export function hostOfClaim(claim: AuditClaim): string | undefined {
  const href = claim.citationHref;
  if (href !== undefined) {
    try {
      return new URL(href).hostname.toLowerCase().replace(/^www\./u, '');
    } catch {
      /* fall through to the free-text source label */
    }
  }
  const source = claim.citationSource?.trim().toLowerCase();
  return source && source.length > 0 ? source.replace(/^www\./u, '') : undefined;
}

/**
 * Strictly wikipedia.org — NOT the same question as `isWikipediaHost` in `tier1-sources.ts`,
 * which also matches wikidata.org (both are bridges for corroboration-search purposes) and takes
 * a URL rather than an already-extracted host. The bead this audit implements names the citation
 * host explicitly: "criterion = 'first_to_do_x' ... whose claims cite only wikipedia.org". Folding
 * wikidata.org in here would silently widen that scope.
 */
export function isWikipediaHost(host: string | undefined): boolean {
  return host !== undefined && (host === 'wikipedia.org' || host.endsWith('.wikipedia.org'));
}

const SUMMARY_EXCERPT_LENGTH = 300;

/**
 * Audit a set of released entities for `first_to_do_x` / `only_or_oldest` basis records whose
 * resolved evidence is Wikipedia and nothing else.
 *
 * A basis record with zero resolvable evidence (every evidenceId dangling, or none at all) is
 * NOT reported here — the publish gate already refuses to release a basis record with zero
 * evidenceIds (release-builder.ts), and a wholly dangling reference is a different defect (a
 * data-integrity bug) from "cited, but only to Wikipedia". `danglingEvidenceIds` still surfaces
 * that gap on any finding that has both resolved and dangling ids, so it is not silently lost.
 */
export function auditSuperlativeWikipediaOnly(
  entities: readonly AuditEntity[],
): readonly SuperlativeAuditFinding[] {
  const findings: SuperlativeAuditFinding[] = [];

  for (const entity of entities) {
    const claimsById = new Map(entity.claims.map((claim) => [claim.id, claim] as const));
    const entityHasNonWikipediaClaimElsewhere = entity.claims.some((claim) => {
      const host = hostOfClaim(claim);
      return host !== undefined && !isWikipediaHost(host);
    });
    const summaryCarriesSuperlative = makesSuperlativeClaim(entity.summary ?? '');

    for (const basis of entity.notabilityBasis) {
      if (!isTargetCriterion(basis.criterion)) continue;

      const resolvedClaims: AuditClaim[] = [];
      const danglingEvidenceIds: string[] = [];
      for (const id of basis.evidenceIds) {
        const claim = claimsById.get(id);
        if (claim) resolvedClaims.push(claim);
        else danglingEvidenceIds.push(id);
      }
      if (resolvedClaims.length === 0) continue;

      const hosts = [
        ...new Set(
          resolvedClaims
            .map((claim) => hostOfClaim(claim))
            .filter((host): host is string => host !== undefined),
        ),
      ];
      const wikipediaOnly = hosts.length > 0 && hosts.every(isWikipediaHost);
      if (!wikipediaOnly) continue;

      findings.push({
        entityId: entity.entityId,
        displayName: entity.displayName,
        kind: entity.kind,
        criterion: basis.criterion,
        note: basis.note,
        evidenceIds: basis.evidenceIds,
        resolvedClaimIds: resolvedClaims.map((claim) => claim.id),
        danglingEvidenceIds,
        citedHosts: hosts,
        entityHasNonWikipediaClaimElsewhere,
        summaryCarriesSuperlative,
        ...(summaryCarriesSuperlative && entity.summary
          ? { summaryExcerpt: entity.summary.slice(0, SUMMARY_EXCERPT_LENGTH) }
          : {}),
      });
    }
  }

  return findings;
}

export type SuperlativeAuditSummary = {
  readonly totalFindingRows: number;
  readonly distinctEntities: number;
  readonly byCriterion: Readonly<Record<TargetCriterion, number>>;
  readonly noNonWikipediaClaimAtAll: number;
  readonly reachesPublishedSummary: number;
};

export function summarizeFindings(
  findings: readonly SuperlativeAuditFinding[],
): SuperlativeAuditSummary {
  const byCriterion = { first_to_do_x: 0, only_or_oldest: 0 } as Record<TargetCriterion, number>;
  const entities = new Set<string>();
  let noNonWiki = 0;
  let reachesSummary = 0;
  for (const finding of findings) {
    byCriterion[finding.criterion] += 1;
    entities.add(finding.entityId);
    if (!finding.entityHasNonWikipediaClaimElsewhere) noNonWiki += 1;
    if (finding.summaryCarriesSuperlative) reachesSummary += 1;
  }
  return {
    totalFindingRows: findings.length,
    distinctEntities: entities.size,
    byCriterion,
    noNonWikipediaClaimAtAll: noNonWiki,
    reachesPublishedSummary: reachesSummary,
  };
}
