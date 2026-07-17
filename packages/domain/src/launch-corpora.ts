/**
 * Named launch corpora for the BB-094 vetted bulk-import lane (BB-094 acceptance criteria 4, 5,
 * 7). These are vetting-record REGISTRATIONS ONLY — corpus metadata (licensing, custodian,
 * provenance fields, expected precision, notability basis) — never live-ingested data. No
 * network call, no fabricated sample record, happens anywhere in this file.
 *
 * Seven corpora, six license-cleared, one deliberately deferred:
 *  - `nrhp`                  — NPS National Register of Historic Places (public domain)
 *  - `habs-haer`             — Library of Congress HABS/HAER survey (public domain)
 *  - `nypl-green-book`       — NYPL Green Book digitizations + extracted listing data
 *                              (public-domain marks, verified per derivative)
 *  - `documented-massacres-riots` — EJI-linked, NPS/state-archive corroborated (link+attribute)
 *  - `hbcu-list`             — NCES/ED Historically Black Colleges and Universities list
 *                              (public domain)
 *  - `rosenwald-schools`     — Fisk University Rosenwald Fund Card File database — DEFERRED,
 *                              terms not yet verified; see `licenseVerdict: 'deferred-unverified'`
 *  - `mapping-inequality-holc` — Univ. of Richmond DSL HOLC redlining maps, sourced from NARA
 *                              (public domain) — first launch corpus requiring real polygon
 *                              geometry (BB-094 acceptance criterion 7); see the module doc note
 *                              at the bottom of this file for the BB-070 map-tile follow-up.
 *
 * Boundary rules (BB-094 acceptance criterion 5): statutes/cases (BB-087's legal corpus) and
 * Tougaloo sundown-town data (BB-082's exclusion-infrastructure lane) are deliberately absent
 * from this list — `registerCorpusVetting` / `assertCorpusVettingRecordValid` would reject them
 * outright via `assertCorpusNotInExcludedLane` if anyone tried to add them here.
 */
import {
  registerCorpusVetting,
  type CorpusVettingRecord,
  type CorpusVettingStore,
  type RegisterCorpusVettingInput,
} from './corpus-vetting.js';
import type { SourceRegistryStore } from './adapters/registry.js';
import type { RightsPolicy } from './provenance/rights.js';

const PUBLIC_DOMAIN_GOVERNMENT_RIGHTS: RightsPolicy = {
  defaultStatus: 'public_domain',
  publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt'],
  prohibitedUses: ['biometric_extraction', 'commercial_reuse'],
};

const PUBLIC_DOMAIN_ARCHIVAL_RIGHTS: RightsPolicy = {
  defaultStatus: 'public_domain',
  publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt'],
  prohibitedUses: ['biometric_extraction', 'full_text_republication'],
};

/** Attribution-required derivative rights (NYPL public-domain marks, EJI link+attribute terms). */
const ATTRIBUTION_REQUIRED_RIGHTS: RightsPolicy = {
  defaultStatus: 'licensed',
  publicationPermissions: ['cite', 'short_excerpt'],
  prohibitedUses: ['full_text_republication', 'unattributed_reuse', 'commercial_reuse'],
};

/** Rosenwald: terms not yet verified — no publication permission is granted pending review. */
const UNVERIFIED_TERMS_RIGHTS: RightsPolicy = {
  defaultStatus: 'unknown',
  publicationPermissions: [],
  prohibitedUses: ['full_text_republication', 'unattributed_reuse', 'commercial_reuse'],
};

/**
 * Launch-corpus vetting inputs, keyed by corpus slug. `vettedBy`/`vettedAt` are supplied by the
 * caller (the operator running registration) rather than hard-coded here, so a real registration
 * always carries a real accountable identity and timestamp rather than a baked-in placeholder.
 */
export function buildLaunchCorpusVettingInputs(input: {
  readonly vettedBy: string;
  readonly vettedAt: string;
}): readonly RegisterCorpusVettingInput[] {
  const { vettedBy, vettedAt } = input;
  return [
    {
      corpus: 'nrhp',
      corpusDisplayName: 'National Register of Historic Places (weekly list)',
      custodian: 'National Park Service (NPS)',
      licenseVerdict: 'public-domain',
      licenseNotes:
        'U.S. federal government work; public domain per 17 U.S.C. §105. The weekly NRHP list ' +
        'includes coordinates, also covers National Historic Landmarks, and many documented ' +
        'plantation sites carry an NRHP listing.',
      authorityTier: 'federal_government',
      provenanceFieldsRetained: [
        'nrhpReferenceNumber',
        'listingDate',
        'stateOrTerritory',
        'county',
        'coordinates',
        'retrievalDate',
        'sourceUrl',
      ],
      precisionExpectation: 'exact-site',
      refreshCadence: 'weekly',
      notabilityCriterion: 'landmark_or_national_register',
      classification: 'government_record',
      rights: PUBLIC_DOMAIN_GOVERNMENT_RIGHTS,
      permittedClaimClasses: ['geographic_fact', 'institutional_fact', 'biographical_fact'],
      stableIdScheme: 'nps-nrhp-ref',
      organizationId: 'org_nps',
      citationRequirements: 'Cite the NPS NRHP database entry and reference number; link to the nps.gov listing page.',
      vettedBy,
      vettedAt,
    },
    {
      corpus: 'habs-haer',
      corpusDisplayName: 'Historic American Buildings Survey / Historic American Engineering Record',
      custodian: 'Library of Congress (LoC), Prints & Photographs Division',
      licenseVerdict: 'public-domain',
      licenseNotes: 'U.S. federal government survey record; public domain per 17 U.S.C. §105.',
      authorityTier: 'federal_government',
      provenanceFieldsRetained: [
        'habsOrHaerNumber',
        'surveyDate',
        'locationDescription',
        'coordinates',
        'retrievalDate',
        'sourceUrl',
      ],
      precisionExpectation: 'exact-site',
      refreshCadence: 'quarterly',
      notabilityCriterion: 'landmark_or_national_register',
      classification: 'primary_archival',
      rights: PUBLIC_DOMAIN_ARCHIVAL_RIGHTS,
      permittedClaimClasses: ['geographic_fact', 'institutional_fact'],
      stableIdScheme: 'loc-habs-haer-number',
      organizationId: 'org_loc',
      citationRequirements: 'Cite the LoC HABS/HAER survey number; link to the loc.gov item page.',
      vettedBy,
      vettedAt,
    },
    {
      corpus: 'nypl-green-book',
      corpusDisplayName: 'NYPL Green Book Digitizations + Navigating the Green Book extracted data',
      custodian: 'New York Public Library (NYPL), Schomburg Center / NYPL Labs',
      licenseVerdict: 'restricted-attribution-required',
      licenseNotes:
        'NYPL public-domain marks apply per item/per derivative — each digitized Green Book ' +
        'edition and the "Navigating the Green Book" extracted-listing dataset must be verified ' +
        'individually before use, and attributed per NYPL\'s terms.',
      authorityTier: 'established_nonprofit',
      provenanceFieldsRetained: [
        'greenBookEdition',
        'listingYear',
        'businessNameAsListed',
        'addressAsListed',
        'nyplItemId',
        'retrievalDate',
        'sourceUrl',
      ],
      precisionExpectation: 'exact-site',
      refreshCadence: 'static',
      notabilityCriterion: 'documented_site',
      classification: 'primary_archival',
      rights: ATTRIBUTION_REQUIRED_RIGHTS,
      permittedClaimClasses: ['geographic_fact', 'institutional_fact'],
      stableIdScheme: 'nypl-digital-collections-id',
      organizationId: 'org_nypl',
      citationRequirements:
        'Cite the NYPL digital collections item and Green Book edition/year; attribute per NYPL ' +
        'public-domain marks terms.',
      vettedBy,
      vettedAt,
    },
    {
      corpus: 'documented-massacres-riots',
      corpusDisplayName: 'Documented Massacres and Riots (EJI-linked, NPS/state-archive corroborated)',
      custodian:
        'Equal Justice Initiative (EJI) reports (link + attribute only); National Park Service ' +
        'and state archives for corroborating primary records',
      licenseVerdict: 'restricted-attribution-required',
      licenseNotes:
        'EJI report content is link+attribute only per EJI\'s citation terms — never bulk-' +
        'reproduced. Underlying NPS/state-archive records are public domain / government record ' +
        'and may be cited directly.',
      authorityTier: 'established_nonprofit',
      provenanceFieldsRetained: [
        'ejiReportUrl',
        'eventDate',
        'locationDescription',
        'coordinates',
        'corroboratingSourceUrl',
        'retrievalDate',
      ],
      precisionExpectation: 'locality',
      refreshCadence: 'ad_hoc',
      notabilityCriterion: 'documented_site',
      classification: 'reputable_secondary',
      rights: ATTRIBUTION_REQUIRED_RIGHTS,
      permittedClaimClasses: ['geographic_fact', 'institutional_fact'],
      stableIdScheme: 'eji-report-ref',
      organizationId: 'org_eji',
      citationRequirements:
        'Link + attribute the EJI report per EJI\'s terms; never reproduce EJI report text beyond ' +
        'a short citation excerpt; corroborate with an NPS/state-archive primary record where one ' +
        'exists.',
      vettedBy,
      vettedAt,
    },
    {
      corpus: 'hbcu-list',
      corpusDisplayName: 'Historically Black Colleges and Universities (HBCU) list',
      custodian: 'National Center for Education Statistics (NCES) / U.S. Department of Education',
      licenseVerdict: 'public-domain',
      licenseNotes: 'U.S. federal government work; public domain per 17 U.S.C. §105.',
      authorityTier: 'federal_government',
      provenanceFieldsRetained: [
        'ncesInstitutionId',
        'institutionName',
        'stateOrTerritory',
        'foundingYear',
        'retrievalDate',
        'sourceUrl',
      ],
      precisionExpectation: 'exact-site',
      refreshCadence: 'annual',
      notabilityCriterion: 'community_anchor',
      classification: 'government_record',
      rights: PUBLIC_DOMAIN_GOVERNMENT_RIGHTS,
      permittedClaimClasses: ['institutional_fact'],
      stableIdScheme: 'nces-institution-id',
      organizationId: 'org_nces',
      citationRequirements: 'Cite the NCES/ED HBCU list entry and institution id.',
      vettedBy,
      vettedAt,
    },
    {
      corpus: 'rosenwald-schools',
      corpusDisplayName: 'Rosenwald Schools Database',
      custodian: 'Fisk University, Rosenwald Fund Card File Database',
      // DEFERRED, not rejected: Fisk's database terms of use have not yet been verified as
      // compatible with bulk import. `registerCorpusVetting` will register this corpus's
      // vetting record and BB-037 registry entry but will NOT approve the registry entry, so
      // `assertCorpusVettedForBulkImport` fails closed on it exactly like an unvetted corpus
      // until a real license verdict replaces this one.
      licenseVerdict: 'deferred-unverified',
      licenseNotes:
        'Fisk\'s Rosenwald Fund Card File Database terms of use have not yet been verified as ' +
        'compatible with bulk import. DO NOT bulk-import until a license verdict (public domain, ' +
        'permissive, or restricted-attribution-required) replaces this deferred entry.',
      authorityTier: 'academic_institution',
      provenanceFieldsRetained: [
        'rosenwaldCardId',
        'schoolName',
        'county',
        'stateOrTerritory',
        'constructionYear',
        'retrievalDate',
        'sourceUrl',
      ],
      precisionExpectation: 'exact-site',
      refreshCadence: 'static',
      notabilityCriterion: 'community_anchor',
      classification: 'reputable_secondary',
      rights: UNVERIFIED_TERMS_RIGHTS,
      permittedClaimClasses: ['institutional_fact'],
      stableIdScheme: 'fisk-rosenwald-card-id',
      organizationId: 'org_fisk',
      citationRequirements: 'Deferred pending Fisk terms-of-use verification — do not cite for publication yet.',
      vettedBy,
      vettedAt,
    },
    {
      corpus: 'mapping-inequality-holc',
      corpusDisplayName: 'Mapping Inequality: HOLC Residential Security Maps',
      custodian: 'University of Richmond Digital Scholarship Lab (DSL); source records held by NARA',
      licenseVerdict: 'public-domain',
      licenseNotes:
        'Underlying HOLC Residential Security Maps are U.S. federal government records held by ' +
        'NARA — public domain per 17 U.S.C. §105. DSL\'s digitized/vectorized boundary+grade ' +
        'dataset derives directly from that public-domain federal record; cite both DSL and the ' +
        'NARA record id.',
      authorityTier: 'academic_institution',
      provenanceFieldsRetained: [
        'holcCityId',
        'holcAreaGrade',
        'boundaryGeometrySource',
        'naraRecordId',
        'retrievalDate',
        'sourceUrl',
      ],
      precisionExpectation: 'locality',
      // BB-094 acceptance criterion 7: the first launch corpus requiring real polygon geometry
      // (graded neighborhood boundaries), never point+radius.
      requiresPolygonGeometry: true,
      refreshCadence: 'static',
      notabilityCriterion: 'documented_site',
      classification: 'primary_archival',
      rights: PUBLIC_DOMAIN_ARCHIVAL_RIGHTS,
      permittedClaimClasses: ['geographic_fact'],
      stableIdScheme: 'dsl-mapping-inequality-area-id',
      organizationId: 'org_richmond_dsl',
      citationRequirements:
        'Cite Mapping Inequality (Univ. of Richmond DSL) and the underlying NARA record id; grade, ' +
        'boundary geometry, and retrieval date are recorded per record (BB-094 acceptance ' +
        'criterion 7).',
      boundaryNotes:
        'Feeds the BB-082 exclusion-infrastructure layer as corroborating historical evidence — ' +
        'registered ONCE here (BB-094 acceptance criterion 5) and referenced by BB-082, never ' +
        're-ingested by BB-082 as a second copy. Actual polygon ingestion into map tile assets ' +
        'integrates with BB-070\'s map data platform (packages/domain/src/map/) — building that ' +
        'tile-compilation step is explicit, documented follow-up, not part of BB-094\'s scope: ' +
        'BB-070\'s `buildMapSource` (packages/domain/src/map/map-source.ts) already accepts ' +
        '`GeoGeometry` (`Point | Polygon | BBox`, packages/domain/src/geography/location.ts) — ' +
        'the follow-up is calling it with this corpus\'s vetted Polygon records the same way ' +
        'the "INTEGRATION POINT" comments in map-source.ts and completeness-gate.ts document for ' +
        'their own release-coupled builds.',
      vettedBy,
      vettedAt,
    },
  ];
}

/**
 * Registers every launch corpus's vetting record and BB-037 registry entry. Returns the records
 * in the same order as `buildLaunchCorpusVettingInputs`. Idempotent per corpus in the sense that
 * re-running with the same `vettedAt` replaces (not duplicates) each corpus's stored vetting
 * record — `CorpusVettingStore.save` and `registerSource`'s underlying map are keyed by corpus /
 * registry-entry id — though re-registering an already-registered BB-037 entry a second time
 * will throw (`registerSource` rejects a duplicate id) unless the caller passes a fresh store, so
 * callers that truly need "re-run the whole registration" idempotency should pass the store from
 * the first run rather than a blank one.
 */
export function registerLaunchCorpora(
  registryStore: SourceRegistryStore,
  vettingStore: CorpusVettingStore,
  input: { readonly vettedBy: string; readonly vettedAt: string },
): readonly CorpusVettingRecord[] {
  return buildLaunchCorpusVettingInputs(input).map((corpusInput) =>
    registerCorpusVetting(registryStore, vettingStore, corpusInput),
  );
}

/** Stable list of launch corpus slugs, for tests and reporting. */
export const LAUNCH_CORPUS_SLUGS: readonly string[] = [
  'nrhp',
  'habs-haer',
  'nypl-green-book',
  'documented-massacres-riots',
  'hbcu-list',
  'rosenwald-schools',
  'mapping-inequality-holc',
];

/** Slugs deliberately excluded from this bead's corpus list (BB-094 acceptance criterion 5). */
export const BOUNDARY_EXCLUDED_CORPUS_SLUGS: readonly { readonly slug: string; readonly ownerBead: string }[] = [
  { slug: 'statutes', ownerBead: 'BB-087' },
  { slug: 'cases', ownerBead: 'BB-087' },
  { slug: 'tougaloo-sundown-data', ownerBead: 'BB-082' },
];
