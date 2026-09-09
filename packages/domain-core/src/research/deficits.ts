/**
 * Research deficits: what is specifically wrong with a record's evidence.
 *
 * A score cannot be acted on. "0.72" tells an operator nothing about what to go and find,
 * which is why the catalog could sit at 10,572 high-confidence claims while 84% of entities
 * cited exactly one source. A named deficit is a research task.
 *
 * Everything here is deterministic and model-free. Noticing that a high-impact claim rests on
 * one lineage, or that a superlative has no source fit to establish an ordering, is counting
 * and table lookup. Models are for claim extraction, contradiction reconciliation and
 * historical synthesis — not for noticing.
 *
 * THE RULE THAT MATTERS MOST: adding a source must not clear a deficit by itself. Everything
 * here counts lineages, fitness and selectors, never URLs.
 */
import {
  type AssertionClass,
  type SourceClass,
  assessSourceFitness,
  isBridgeSourceClass,
  isHighImpactAssertion,
} from '../claims/source-fitness.js';
import type { SourceLineage } from '../claims/lineage.js';

export const RESEARCH_DEFICIT_CODES = [
  'wikipedia_only_summary_claim',
  'bridge_only_entity',
  'single_lineage_high_impact_claim',
  'superlative_without_institutional_support',
  'superlative_source_does_not_state_scope',
  'no_primary_or_archival_receipt',
  'claim_without_evidence_selector',
  'claim_source_unfit_for_claim',
  'host_based_lineage_suspect',
  'duplicate_upstream_lineage',
  'source_type_monoculture',
  'importer_source_monoculture',
  'broken_source',
  'uncaptured_critical_source',
  'missing_source_provenance',
  'missing_creation_or_publication_date',
  'generic_confidence_dimension',
  'unresolved_contradiction',
  'contradiction_search_not_run',
  'missing_identity_receipt',
  'missing_place_receipt',
  'missing_relationship_evidence',
  'high_impact_attribution_without_prior_art_search',
  'invention_claim_without_technical_receipt',
  'patent_used_as_racial_identity_evidence',
  'inventor_team_or_coinventor_unresolved',
  'invention_scope_broader_than_patent',
  'unsupported_commercial_impact_claim',
  'unsupported_societal_impact_claim',
] as const;
export type ResearchDeficitCode = (typeof RESEARCH_DEFICIT_CODES)[number];

export type ResearchDeficit = {
  readonly code: ResearchDeficitCode;
  /** What is wrong, in a sentence an operator can act on. */
  readonly explanation: string;
  /** The evidence that would resolve it, phrased as something to go and find. */
  readonly remediation: string;
  /** The claim this attaches to, where the deficit is claim-level rather than record-level. */
  readonly claimId?: string;
  /** True when this deficit means published prose is currently overstating its evidence. */
  readonly correctionRisk: boolean;
};

/** One piece of evidence attached to a claim, as the deficit detector needs to see it. */
export type EvidenceSnapshot = {
  readonly sourceId: string;
  readonly url?: string | undefined;
  readonly sourceClass: SourceClass;
  readonly lineage: SourceLineage;
  /** Whether the evidence points at an exact passage rather than at a whole document. */
  readonly hasSelector: boolean;
  /** Whether a durable copy is held. */
  readonly captured: boolean;
  /** Whether the source failed to resolve on last check. */
  readonly broken?: boolean | undefined;
  /** The document's own creation or publication date, where known. ISO-8601. */
  readonly documentDate?: string | undefined;
  /** Which confidence dimensions were actually assessed rather than defaulted. */
  readonly assessedDimensions?: readonly string[] | undefined;
  /** The importer or program that brought this source in, where it was a bulk lane. */
  readonly importerFamily?: string | undefined;
};

export type ClaimSnapshot = {
  readonly id: string;
  /** The claim as a reader would meet it. */
  readonly text: string;
  /** What kind of assertion this is. */
  readonly assertionClass: AssertionClass;
  /** Whether public summary prose depends on this claim. */
  readonly inPublicSummary: boolean;
  readonly evidence: readonly EvidenceSnapshot[];
  /** Contradicting evidence exists and has not been reconciled or disclosed. */
  readonly unresolvedContradiction?: boolean | undefined;
};

export type RecordSnapshot = {
  readonly entityId: string;
  readonly entityKind: string;
  readonly claims: readonly ClaimSnapshot[];
  /** Whether a targeted contradiction search has been run for this record. */
  readonly contradictionSearchRun: boolean;
  /** Whether a prior-art / alternative-attribution search has been run. */
  readonly priorArtSearchRun: boolean;
  /** Whether the record's chronology has an evidence-backed anchor. */
  readonly placeReceipt?: boolean | undefined;
  /** Whether relationships on this record carry their own evidence. */
  readonly relationshipsWithoutEvidence?: number | undefined;
  /** For invention and inventor records: whether a technical receipt is attached. */
  readonly requiresTechnicalReceipt?: boolean | undefined;
  /** For inventor records: whether community identity is separately evidenced. */
  readonly requiresCommunityIdentityReceipt?: boolean | undefined;
  /** Whether this record is in the active public release. */
  readonly released: boolean;
};

const PRIMARY_OR_ARCHIVAL: readonly SourceClass[] = [
  'patent_specification',
  'patent_application',
  'patent_assignment_record',
  'patent_file_wrapper',
  'patent_interference_record',
  'government_technical_report',
  'archival_manuscript',
  'museum_object_record',
  'contemporaneous_newspaper',
  'contemporaneous_trade_press',
  'court_record',
  'census_or_vital_record',
  'oral_history',
];

/**
 * Lineages that can corroborate, which is not the same as lineages that are cited.
 *
 * A bridge may carry a claim and never corroborates one, so it is excluded here while still
 * counting toward "was this assessed at all". This is the same split the reader-facing rule
 * makes between cited and corroborating lineage counts.
 */
export function corroboratingLineageKeys(
  evidence: readonly EvidenceSnapshot[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const item of evidence) {
    if (item.lineage.bridge) continue;
    if (isBridgeSourceClass(item.sourceClass)) continue;
    if (item.broken === true) continue;
    keys.add(item.lineage.key);
  }
  return keys;
}

/** Every distinct lineage cited, bridges included. Answers "was this assessed at all". */
export function citedLineageKeys(evidence: readonly EvidenceSnapshot[]): ReadonlySet<string> {
  return new Set(evidence.map((item) => item.lineage.key));
}

function isBridgeEvidence(item: EvidenceSnapshot): boolean {
  return item.lineage.bridge || isBridgeSourceClass(item.sourceClass);
}

const REQUIRED_DIMENSIONS = [
  'directness',
  'entityMatchQuality',
  'temporalProximity',
  'geographicPrecision',
  'extractionQuality',
] as const;

/**
 * Detect every deficit in a record.
 *
 * Order is stable so that two runs over unchanged data produce identical output, which is what
 * makes the audit diffable across sessions.
 */
export function detectDeficits(record: RecordSnapshot): readonly ResearchDeficit[] {
  const found: ResearchDeficit[] = [];
  const allEvidence = record.claims.flatMap((claim) => claim.evidence);

  // ---- Record-level ----

  if (allEvidence.length > 0 && allEvidence.every(isBridgeEvidence)) {
    found.push({
      code: 'bridge_only_entity',
      correctionRisk: false,
      explanation:
        'Every source on this record is a reference bridge. A bridge may carry a claim and never corroborates one, so nothing here is corroborated.',
      remediation:
        "Follow the bridge's own references to the institution, archive or original work behind them, and cite those.",
    });
  }

  if (
    allEvidence.length > 0 &&
    !allEvidence.some((item) => PRIMARY_OR_ARCHIVAL.includes(item.sourceClass))
  ) {
    found.push({
      code: 'no_primary_or_archival_receipt',
      correctionRisk: false,
      explanation:
        'No primary, archival or period source is attached; the record rests entirely on synthesis and reference material.',
      remediation:
        'Pursue the archival or technical record the secondary sources are themselves working from.',
    });
  }

  const sourceClasses = new Set(allEvidence.map((item) => item.sourceClass));
  if (allEvidence.length >= 3 && sourceClasses.size === 1) {
    const only = [...sourceClasses][0];
    found.push({
      code: 'source_type_monoculture',
      correctionRisk: false,
      explanation: `All ${allEvidence.length} sources are the same kind of document (${only}), so they share the same blind spots.`,
      remediation:
        'Add a different kind of record — a document of a different class, not another of the same.',
    });
  }

  const importers = new Set(
    allEvidence.map((item) => item.importerFamily).filter((f): f is string => f !== undefined),
  );
  if (importers.size === 1 && allEvidence.length >= 2 && importers.size === sourceClasses.size) {
    found.push({
      code: 'importer_source_monoculture',
      correctionRisk: false,
      explanation: `Every source came from one importer (${[...importers][0]}). A bulk import is one source family however many rows it produced.`,
      remediation: 'Research at least one source this record was not handed by its import lane.',
    });
  }

  if (!record.contradictionSearchRun) {
    found.push({
      code: 'contradiction_search_not_run',
      correctionRisk: false,
      explanation:
        'No contradiction search has been run, so disagreement would not have been noticed.',
      remediation: 'Run a targeted contradiction search over the record’s high-impact claims.',
    });
  }

  const hasHighImpact = record.claims.some((claim) => isHighImpactAssertion(claim.assertionClass));
  if (hasHighImpact && !record.priorArtSearchRun) {
    found.push({
      code: 'high_impact_attribution_without_prior_art_search',
      correctionRisk: false,
      explanation:
        'This record makes an attribution or firstness claim and no prior-art or alternative-attribution search has been run.',
      remediation:
        'Search for earlier work, competing claimants, disputes and interference records before the attribution is treated as settled.',
    });
  }

  if (record.requiresTechnicalReceipt === true) {
    const technical = allEvidence.some(
      (item) =>
        assessSourceFitness(item.sourceClass, 'technical_scope').fitness === 'authoritative' ||
        assessSourceFitness(item.sourceClass, 'technical_scope').fitness === 'strong',
    );
    if (!technical) {
      found.push({
        code: 'invention_claim_without_technical_receipt',
        correctionRisk: false,
        explanation:
          'The record describes a technical contribution with no source fit to establish what the mechanism actually was.',
        remediation:
          'Attach the patent specification, technical report, museum object record or equivalent primary technical record — or, where none exists, record that as a blocker.',
      });
    }
  }

  if (record.requiresCommunityIdentityReceipt === true) {
    const identityFit = allEvidence.some((item) => {
      const { fitness } = assessSourceFitness(item.sourceClass, 'community_identity');
      return fitness === 'authoritative' || fitness === 'strong' || fitness === 'conditional';
    });
    if (!identityFit) {
      found.push({
        code: 'missing_identity_receipt',
        correctionRisk: false,
        explanation:
          'Nothing attached establishes that this person belongs in a Black-history corpus. The Patent Office did not record inventor race, so a technical record cannot answer this.',
        remediation:
          'Find an independent historical receipt: a Baker-era compilation, a USPTO or Smithsonian historical biography, an NPS or Library of Congress account, archival correspondence, credible contemporary Black press, or scholarship.',
      });
    }
    const technicalOnly =
      allEvidence.length > 0 &&
      allEvidence.every(
        (item) => assessSourceFitness(item.sourceClass, 'community_identity').fitness === 'unfit',
      );
    if (technicalOnly) {
      found.push({
        code: 'patent_used_as_racial_identity_evidence',
        correctionRisk: true,
        explanation:
          'The only sources on this record are documents that cannot speak to community identity, so inclusion currently rests on inference.',
        remediation:
          'Attach a source fit for community identity, or remove the record from the lane until one exists.',
      });
    }
  }

  if (record.placeReceipt === false) {
    found.push({
      code: 'missing_place_receipt',
      correctionRisk: false,
      explanation:
        'No evidence-backed place anchor. A filing or mailing address is not evidence of where work happened.',
      remediation:
        'Find a documented workshop, laboratory, demonstration site or facility, or record a city-level anchor honestly.',
    });
  }

  const danglingRelationships = record.relationshipsWithoutEvidence ?? 0;
  if (danglingRelationships > 0) {
    found.push({
      code: 'missing_relationship_evidence',
      correctionRisk: false,
      explanation: `${danglingRelationships} relationship(s) on this record carry no evidence for the relationship itself.`,
      remediation:
        'Attach evidence that states the relationship, or withdraw the edge. An edge is a claim.',
    });
  }

  // ---- Claim-level ----

  for (const claim of record.claims) {
    const cited = citedLineageKeys(claim.evidence);
    const corroborating = corroboratingLineageKeys(claim.evidence);
    const bridgeOnly = claim.evidence.length > 0 && claim.evidence.every(isBridgeEvidence);

    if (claim.inPublicSummary && bridgeOnly) {
      found.push({
        code: 'wikipedia_only_summary_claim',
        claimId: claim.id,
        correctionRisk: true,
        explanation:
          'Public summary prose depends on a claim whose only support is a reference bridge.',
        remediation:
          'Cite the underlying work the bridge is itself citing, or remove the assertion from the summary.',
      });
    }

    if (isHighImpactAssertion(claim.assertionClass) && corroborating.size <= 1) {
      found.push({
        code: 'single_lineage_high_impact_claim',
        claimId: claim.id,
        correctionRisk: claim.inPublicSummary,
        explanation: `A ${claim.assertionClass.replace(/_/gu, ' ')} claim rests on ${corroborating.size} independent lineage(s). Copies of one work are not corroboration.`,
        remediation:
          'Find a source that traces to a different underlying work, not another host carrying the same one.',
      });
    }

    if (claim.assertionClass === 'superlative') {
      const scopeFit = claim.evidence.some((item) => {
        const { fitness } = assessSourceFitness(item.sourceClass, 'superlative');
        return fitness === 'authoritative' || fitness === 'strong';
      });
      const anyFit = claim.evidence.some(
        (item) => assessSourceFitness(item.sourceClass, 'superlative').fitness === 'conditional',
      );
      if (!scopeFit && !anyFit) {
        found.push({
          code: 'superlative_without_institutional_support',
          claimId: claim.id,
          correctionRisk: claim.inPublicSummary,
          explanation:
            'A firstness or only-ness claim with no source fit to establish an ordering.',
          remediation:
            'Find an institution or scholar that researched the ordering and states the scope, or bound the claim ("first known" rather than "first").',
        });
      } else if (!scopeFit) {
        found.push({
          code: 'superlative_source_does_not_state_scope',
          claimId: claim.id,
          correctionRisk: false,
          explanation:
            'The strongest source for this superlative can carry it but did not itself research the scope being claimed.',
          remediation:
            'Confirm the source states the same scope the claim asserts, or narrow the claim to match.',
        });
      }
    }

    for (const item of claim.evidence) {
      const { fitness } = assessSourceFitness(item.sourceClass, claim.assertionClass);
      if (fitness === 'unfit') {
        found.push({
          code: 'claim_source_unfit_for_claim',
          claimId: claim.id,
          correctionRisk: claim.inPublicSummary,
          explanation: `A ${item.sourceClass.replace(/_/gu, ' ')} is attached to a ${claim.assertionClass.replace(/_/gu, ' ')} claim, which it cannot support at all.`,
          remediation:
            'Attach a source of a class fit for this kind of assertion, or restate the claim to what this source can carry.',
        });
      }
    }

    if (claim.inPublicSummary && claim.evidence.some((item) => !item.hasSelector)) {
      found.push({
        code: 'claim_without_evidence_selector',
        claimId: claim.id,
        correctionRisk: false,
        explanation:
          'Public summary prose depends on evidence attached at document level rather than at an exact passage.',
        remediation:
          'Record the passage that entails the claim, so a later reader can check it without re-reading the document.',
      });
    }

    if (claim.unresolvedContradiction === true) {
      found.push({
        code: 'unresolved_contradiction',
        claimId: claim.id,
        correctionRisk: claim.inPublicSummary,
        explanation:
          'Fit sources disagree about this claim and the disagreement has been neither reconciled nor disclosed.',
        remediation:
          'Reconcile with better evidence, or present the disagreement. Do not average two sources into one confident answer.',
      });
    }

    if (
      cited.size > corroborating.size + (bridgeOnly ? 0 : 0) &&
      corroborating.size === 0 &&
      cited.size > 0
    ) {
      // Cited but nothing that can corroborate: the record looks sourced and is not.
      found.push({
        code: 'duplicate_upstream_lineage',
        claimId: claim.id,
        correctionRisk: false,
        explanation: 'Every source for this claim traces to the same upstream work or to a bridge.',
        remediation: 'Find a source with a different origin, not another copy of this one.',
      });
    }

    for (const item of claim.evidence) {
      if (item.broken === true) {
        found.push({
          code: 'broken_source',
          claimId: claim.id,
          correctionRisk: claim.inPublicSummary,
          explanation: `A cited source no longer resolves (${item.url ?? item.sourceId}).`,
          remediation: 'Recover it from a durable capture or an archive, or replace it.',
        });
      }
      if (claim.inPublicSummary && !item.captured && item.url !== undefined) {
        found.push({
          code: 'uncaptured_critical_source',
          claimId: claim.id,
          correctionRisk: false,
          explanation: 'Public prose depends on a web source with no durable capture held.',
          remediation:
            'Capture the source where rights allow, so the citation survives the page changing.',
        });
      }
      if (item.lineage.inferred) {
        found.push({
          code: 'host_based_lineage_suspect',
          claimId: claim.id,
          correctionRisk: false,
          explanation: `Lineage for this source was inferred from its host (${item.lineage.basis}) rather than read from a work identifier or recorded provenance.`,
          remediation: 'Record the underlying work so independence stops being a guess.',
        });
      }
      if (item.documentDate === undefined) {
        found.push({
          code: 'missing_creation_or_publication_date',
          claimId: claim.id,
          correctionRisk: false,
          explanation:
            'The source has no recorded creation or publication date, so temporal proximity cannot be assessed.',
          remediation:
            'Record when the document was made; a system capture timestamp is not the document’s date.',
        });
      }
      const assessed = new Set(item.assessedDimensions ?? []);
      const unassessed = REQUIRED_DIMENSIONS.filter((d) => !assessed.has(d));
      if (unassessed.length > 0) {
        found.push({
          code: 'generic_confidence_dimension',
          claimId: claim.id,
          correctionRisk: false,
          explanation: `Confidence dimensions were never assessed for this source (${unassessed.join(', ')}); they carry defaults that read as measurements.`,
          remediation:
            'Assess the dimensions against the selected passage, or mark them unassessed so the score stops implying they were checked.',
        });
      }
      if (item.url === undefined && item.sourceId.trim().length === 0) {
        found.push({
          code: 'missing_source_provenance',
          claimId: claim.id,
          correctionRisk: false,
          explanation: 'A source is attached with neither a locator nor an identifier.',
          remediation: 'Record what the source is and where it was found.',
        });
      }
    }
  }

  return dedupeDeficits(found);
}

/**
 * Collapse repeats of the same finding.
 *
 * Ten sources missing a document date is one deficit about this record's provenance hygiene,
 * not ten tasks. Claim-level deficits stay separate per claim because they are separate tasks.
 */
function dedupeDeficits(deficits: readonly ResearchDeficit[]): readonly ResearchDeficit[] {
  const byKey = new Map<string, ResearchDeficit>();
  for (const deficit of deficits) {
    const key = `${deficit.code}::${deficit.claimId ?? ''}`;
    const existing = byKey.get(key);
    // Keep the correction-risk variant if any instance carries it.
    if (existing === undefined) byKey.set(key, deficit);
    else if (!existing.correctionRisk && deficit.correctionRisk) byKey.set(key, deficit);
  }
  return [...byKey.values()];
}

export type EnrichmentPriority = 'P0' | 'P1' | 'P2' | 'P3';

const P1_CODES: readonly ResearchDeficitCode[] = [
  'wikipedia_only_summary_claim',
  'bridge_only_entity',
  'single_lineage_high_impact_claim',
  'claim_without_evidence_selector',
];

const P2_CODES: readonly ResearchDeficitCode[] = [
  'no_primary_or_archival_receipt',
  'source_type_monoculture',
  'importer_source_monoculture',
  'contradiction_search_not_run',
  'high_impact_attribution_without_prior_art_search',
  'missing_place_receipt',
  'missing_relationship_evidence',
  'duplicate_upstream_lineage',
  'host_based_lineage_suspect',
  'invention_claim_without_technical_receipt',
  'missing_identity_receipt',
];

/**
 * Which bucket a record belongs in.
 *
 * P0 is reserved for records whose PUBLISHED prose currently overstates its evidence — a
 * correction, not an improvement. That is why correctionRisk is computed per deficit against
 * whether the claim reaches public summary prose, rather than being a property of the code.
 */
export function enrichmentPriority(
  deficits: readonly ResearchDeficit[],
  options: { readonly released: boolean },
): EnrichmentPriority {
  if (options.released && deficits.some((d) => d.correctionRisk)) return 'P0';
  if (deficits.some((d) => P1_CODES.includes(d.code))) return 'P1';
  if (deficits.some((d) => P2_CODES.includes(d.code))) return 'P2';
  return 'P3';
}
