/** Read-only research maturity assessment of the released catalog.
 * URL patterns identify limited document types. A host alone cannot establish peer review,
 * primary-source status, independence, or fitness for a particular claim.
 */
import {
  type AssertionClass,
  type ClaimSnapshot,
  type EvidenceSnapshot,
  type RecordSnapshot,
  type ResearchDeficitCode,
  type ResearchMaturity,
  type SourceClass,
  assessResearchMaturity,
  findAttributionMarkers,
  resolveSourceLineage,
} from '@repo/domain';

/** One claim as the released projection stores it. */
export type ReleasedClaim = {
  readonly id?: string;
  readonly predicate?: string;
  readonly object?: string;
  readonly claimRole?: string;
  readonly citationHref?: string;
  readonly citationSource?: string;
  readonly citationLabel?: string;
  readonly confidenceLevel?: string;
};

export type ReleasedEntity = {
  readonly entityId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary?: string | null;
  readonly claims: readonly ReleasedClaim[];
};

function hostOf(url: string | undefined, fallback: string | undefined): string | undefined {
  if (url !== undefined) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
    } catch {
      /* fall through to the stored source label */
    }
  }
  return fallback?.toLowerCase().replace(/^www\./u, '');
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Conservative document hints. Unclassified citations require source-level review. */
export function sourceClassForCitation(
  href: string | undefined,
  source: string | undefined,
): SourceClass {
  const host = hostOf(href, source);
  if (!host) return 'search_result_lead';
  if (hostMatches(host, 'wikipedia.org') || host === 'wikipedia_api') return 'wikipedia_bridge';
  if (hostMatches(host, 'wikidata.org') || host === 'wikidata_api') return 'wikidata_bridge';
  let path = '';
  try {
    path = href ? new URL(href).pathname : '';
  } catch {
    return 'search_result_lead';
  }
  if (
    (hostMatches(host, 'patents.google.com') && path.startsWith('/patent/')) ||
    (hostMatches(host, 'patentimages.storage.googleapis.com') && path.endsWith('.pdf'))
  )
    return 'patent_specification';
  if (hostMatches(host, 'npgallery.nps.gov') && path.startsWith('/NRHP/GetAsset/'))
    return 'government_technical_report';
  // Official pages are institutional accounts until their underlying document is classified.
  if (
    host.endsWith('.gov') ||
    host.endsWith('.mil') ||
    host.endsWith('.edu') ||
    hostMatches(host, 'si.edu')
  )
    return 'institutional_biography';
  return 'search_result_lead';
}

/** Whether a source class is one of the patent record classes — a technical, not a racial, record. */
function isPatentSourceClass(sourceClass: SourceClass): boolean {
  return sourceClass.startsWith('patent_');
}

/** Record verbs whose object is a fact about a document rather than an interpretation. */
const RECORD_PREDICATES = new Set([
  'patented',
  'filed',
  'granted',
  'listed',
  'registered',
  'documented_site',
  'born',
  'died',
]);

/**
 * Infer what a claim is asserting.
 *
 * Attribution language wins: a claim whose object says "the first practical automatic
 * refrigeration system" is a superlative whatever its predicate says. Only when the text
 * carries no marker does the predicate decide.
 */
export function assertionClassForClaim(claim: ReleasedClaim): AssertionClass {
  const text = `${claim.predicate ?? ''} ${claim.object ?? ''}`;
  const markers = findAttributionMarkers(text);
  const superlative = markers.find((m) => m.kind === 'superlative');
  if (superlative !== undefined) return 'superlative';
  const broad = markers.find((m) => m.kind === 'broad_attribution');
  if (broad !== undefined) return 'invention_attribution';
  const commercial = markers.find((m) => m.kind === 'commercial');
  if (commercial !== undefined) return 'commercial_impact';
  const impact = markers.find((m) => m.kind === 'impact');
  if (impact !== undefined) return 'societal_impact';

  // A record predicate wins over a bounded attribution verb, and the order matters. "Patented a
  // device for cooling truck trailers" is a fact about a document, which one patent settles;
  // treating it as an attribution would put the corroboration gate in front of every patent in
  // the catalog and teach operators to ignore it. "Patented the FIRST practical..." never
  // reaches here — the superlative check above already caught it.
  const predicate = (claim.predicate ?? '').toLowerCase().trim();
  if (RECORD_PREDICATES.has(predicate)) return 'record_fact';

  // A bounded verb with no record predicate behind it — "developed the electret microphone" —
  // is still an attribution, just an honest one, and still needs corroboration.
  const bounded = markers.find((m) => m.kind === 'bounded');
  if (bounded !== undefined) return 'invention_attribution';

  if (predicate.includes('locat') || predicate.includes('site')) return 'place';
  return 'biographical_fact';
}

/**
 * Turn a released entity into the snapshot the evaluator reads.
 *
 * WHAT THIS CANNOT SEE, and therefore reports conservatively:
 *  - selectors: the released projection carries a citation href, never a passage, so
 *    `hasSelector` is false everywhere. That is accurate about the released data.
 *  - captures: not represented in the projection, so `captured` is false.
 *  - document dates: no column exists anywhere in evidence, so `documentDate` is undefined.
 *  - assessed dimensions: the publish path defaults three of them, so none are claimed.
 * Each of those produces a real deficit rather than a silent pass, which is the intended
 * behavior: "we have not recorded this" and "this is fine" must not look the same.
 */
export function snapshotForReleasedEntity(entity: ReleasedEntity): RecordSnapshot {
  const claims: ClaimSnapshot[] = entity.claims.map((claim, index) => {
    const sourceClass = sourceClassForCitation(claim.citationHref, claim.citationSource);
    const evidence: EvidenceSnapshot[] = [
      {
        sourceId: claim.citationHref ?? claim.citationSource ?? `claim-${index}-source`,
        url: claim.citationHref,
        sourceClass,
        lineage: resolveSourceLineage({ url: claim.citationHref ?? claim.citationSource }),
        hasSelector: false,
        captured: false,
        documentDate: undefined,
        assessedDimensions: [],
      },
    ];
    return {
      id: claim.id ?? `${entity.entityId}-claim-${index}`,
      text: `${claim.predicate ?? ''} ${claim.object ?? ''}`.trim(),
      assertionClass: assertionClassForClaim(claim),
      // A record_index claim is the catalog restating its own listing, not evidence, and the
      // reader-facing rule already refuses to let a record corroborate itself with it. Only
      // evidence claims are treated as carrying public summary prose.
      inPublicSummary: claim.claimRole !== 'record_index',
      evidence:
        claim.citationHref === undefined && claim.citationSource === undefined ? [] : evidence,
    };
  });

  // Technical identity and Black-history relevance are two separate evidence requirements
  //. An invention record's technical claim needs a technical receipt; a person
  // record whose only cited evidence is a patent needs an independent identity receipt, because
  // the Patent Office never recorded inventor race and a patent cannot answer that question.
  const citesPatentSource = claims.some((claim) =>
    claim.evidence.some((item) => isPatentSourceClass(item.sourceClass)),
  );

  return {
    entityId: entity.entityId,
    entityKind: entity.kind,
    claims,
    // The released catalog has no record of either search having been run for any entity.
    contradictionSearchRun: false,
    priorArtSearchRun: false,
    placeReceipt: undefined,
    relationshipsWithoutEvidence: 0,
    requiresTechnicalReceipt: entity.kind === 'invention',
    requiresCommunityIdentityReceipt: entity.kind === 'person' && citesPatentSource,
    released: true,
  };
}

export type EntityAuditRow = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: string;
  readonly maturity: ResearchMaturity;
  readonly priority: string;
  readonly deficits: readonly ResearchDeficitCode[];
  readonly claimCount: number;
  readonly citedLineages: number;
  readonly corroboratingLineages: number;
  readonly bridgeOnly: boolean;
};

export type ResearchQualityAuditReport = {
  readonly verb: 'research-quality-audit';
  readonly releaseId: string;
  readonly entityCount: number;
  readonly maturityDistribution: Readonly<Record<string, number>>;
  readonly priorityDistribution: Readonly<Record<string, number>>;
  readonly deficitDistribution: Readonly<Record<string, number>>;
  readonly sourceClassDistribution: Readonly<Record<string, number>>;
  readonly lineage: {
    readonly bridgeOnlyEntities: number;
    readonly singleCorroboratingLineageEntities: number;
    readonly zeroCorroboratingLineageEntities: number;
    readonly hostInferredLineageShare: number;
  };
  readonly highImpact: {
    readonly claimsWithHighImpactAssertion: number;
    readonly singleLineageHighImpactClaims: number;
    readonly superlativesWithoutScopedSource: number;
  };
  readonly entities?: readonly EntityAuditRow[];
};

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * Assess a set of released entities.
 *
 * Pure: takes rows, returns a report. The CLI case does the Postgres read so this stays
 * testable without a database.
 */
export function auditReleasedEntities(
  releaseId: string,
  entities: readonly ReleasedEntity[],
  options: { readonly includeEntities?: boolean; readonly evaluatedAt?: string } = {},
): ResearchQualityAuditReport {
  const maturityDistribution: Record<string, number> = {};
  const priorityDistribution: Record<string, number> = {};
  const deficitDistribution: Record<string, number> = {};
  const sourceClassDistribution: Record<string, number> = {};
  const rows: EntityAuditRow[] = [];

  let bridgeOnlyEntities = 0;
  let singleCorroborating = 0;
  let zeroCorroborating = 0;
  let inferredLineages = 0;
  let totalLineages = 0;
  let highImpactClaims = 0;
  let singleLineageHighImpact = 0;
  let superlativesUnscoped = 0;

  for (const entity of entities) {
    const snapshot = snapshotForReleasedEntity(entity);
    const assessment = assessResearchMaturity({
      record: snapshot,
      // Identity resolution is upstream and not represented in the release; a published record
      // is treated as having passed it. Where it did not, that is a different audit.
      identityResolved: true,
      ...(options.evaluatedAt !== undefined ? { evaluatedAt: options.evaluatedAt } : {}),
    });

    bump(maturityDistribution, assessment.maturity);
    bump(priorityDistribution, assessment.priority);
    const deficitCodes = new Set(assessment.evidenceDeficits.map((d) => d.code));
    for (const code of deficitCodes) bump(deficitDistribution, code);

    const allEvidence = snapshot.claims.flatMap((c) => c.evidence);
    for (const item of allEvidence) {
      bump(sourceClassDistribution, item.sourceClass);
      totalLineages += 1;
      if (item.lineage.inferred) inferredLineages += 1;
    }

    const corroborating = new Set(
      allEvidence.filter((e) => !e.lineage.bridge).map((e) => e.lineage.key),
    );
    const bridgeOnly = allEvidence.length > 0 && corroborating.size === 0;
    if (bridgeOnly) bridgeOnlyEntities += 1;
    if (corroborating.size === 1) singleCorroborating += 1;
    if (corroborating.size === 0) zeroCorroborating += 1;

    for (const claim of snapshot.claims) {
      const isHighImpact = (
        [
          'invention_attribution',
          'superlative',
          'commercial_impact',
          'societal_impact',
          'community_identity',
        ] as const
      ).includes(claim.assertionClass as never);
      if (!isHighImpact) continue;
      highImpactClaims += 1;
      const claimLineages = new Set(
        claim.evidence.filter((e) => !e.lineage.bridge).map((e) => e.lineage.key),
      );
      if (claimLineages.size <= 1) singleLineageHighImpact += 1;
    }
    superlativesUnscoped += assessment.evidenceDeficits.filter(
      (d) => d.code === 'superlative_without_institutional_support',
    ).length;

    if (options.includeEntities === true) {
      rows.push({
        entityId: entity.entityId,
        displayName: entity.displayName,
        kind: entity.kind,
        maturity: assessment.maturity,
        priority: assessment.priority,
        deficits: [...deficitCodes],
        claimCount: snapshot.claims.length,
        citedLineages: new Set(allEvidence.map((e) => e.lineage.key)).size,
        corroboratingLineages: corroborating.size,
        bridgeOnly,
      });
    }
  }

  return {
    verb: 'research-quality-audit',
    releaseId,
    entityCount: entities.length,
    maturityDistribution,
    priorityDistribution,
    deficitDistribution,
    sourceClassDistribution,
    lineage: {
      bridgeOnlyEntities,
      singleCorroboratingLineageEntities: singleCorroborating,
      zeroCorroboratingLineageEntities: zeroCorroborating,
      hostInferredLineageShare:
        totalLineages === 0 ? 0 : Math.round((inferredLineages / totalLineages) * 1000) / 1000,
    },
    highImpact: {
      claimsWithHighImpactAssertion: highImpactClaims,
      singleLineageHighImpactClaims: singleLineageHighImpact,
      superlativesWithoutScopedSource: superlativesUnscoped,
    },
    ...(options.includeEntities === true ? { entities: rows } : {}),
  };
}

/**
 * Bound and prioritize a deficit cohort.
 *
 * A caller narrowing by --deficit wants the next N entities carrying that deficit, not the
 * deficit-matching subset of the first N entities by id -- so this filters first, orders by
 * priority (P0 before P1 before P2 before P3, which sorts correctly as plain strings because
 * they are equal length), and only then applies the limit. Callers must audit the full
 * candidate set (no SQL-level LIMIT) before this runs, or the cohort is bounded by the wrong
 * thing again.
 */
export function selectDeficitCohort(
  entities: readonly EntityAuditRow[],
  deficit: ResearchDeficitCode,
  limit?: number,
): readonly EntityAuditRow[] {
  const matching = entities
    .filter((entity) => entity.deficits.includes(deficit))
    .slice()
    .sort((a, b) => a.priority.localeCompare(b.priority));
  return limit === undefined ? matching : matching.slice(0, limit);
}
