/**
 * Community Knowledge Holder Partnerships — proactive human-discovery methodology.
 *
 * Structured research intake from identified local knowledge holders (county historical
 * societies, local NAACP chapters, Black churches with archives, HBCU faculty) in priority
 * geographic areas. NOT open crowdsourcing: every submission arrives through a campaign
 * brief with named-role holders, passes the SAME deterministic relevance gates as adapter
 * discovery, and is scored with the obscurity methodology (low-authority boost applies to
 * `community_oral` / `self_published`).
 *
 * Invariants (ADR-009 and constitution):
 * - Research-side only. Nothing here writes public projections or release tables; every
 *   assessment routes to the human-gated `relevance_review` research-case state.
 * - `signals.outcome` is always `candidate_only`, so `deriveProvisionalDecision` can never
 *   return `include` — community intake is structurally incapable of self-including.
 * - `cannotPublishAlone` is stamped on every brief and assessment (curated-feeds extra-care
 *   pattern, `../adapters/rss/curated-feeds.ts`).
 * - Evidence before assertion: a submission without a source citation or an oral-history
 *   reference is rejected before scoring.
 * - Dignity / living persons: unknown living status is treated as living
 *   (`../living.ts`); submission guidance forbids collecting living-person addresses.
 *
 * Self-contained module: does not modify discovery/adapter barrels. The intake payload
 * shape (`CommunitySubmissionPayload`) structurally mirrors `SubmissionInput` from
 * `@repo/security` (see `apps/api-submissions/src/corrections/correction-intake.ts`) so a
 * campaign submission can be quarantined through the existing api-submissions surface.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProductConstitution } from '@repo/schemas';
import { hashUtf8 } from '../provenance/hashes.js';
import { evaluateCandidateRelevance } from '../relevance/engine.js';
import {
  enforceLowAuthorityTierCannotIncludeIndependently,
  isLowAuthoritySourceTier,
} from '../relevance/gates.js';
import type { RelevanceAssessment } from '../relevance/types.js';
import {
  scoreObscurity,
  type ObscurityAssessment,
  type ObscurityReferenceCorpus,
} from '../discovery/obscurity.js';
import type {
  DiscoveryCandidateRecord,
  GeographicHint,
  SourceReference,
} from '../discovery/types.js';
import type { ResearchCaseState, ResearchReviewQueue } from '../research-case/model.js';
import type { TermClass } from '../query-packs/types.js';

export const COMMUNITY_CAMPAIGN_BRIEF_SCHEMA_VERSION = 'community-campaign-brief.v1' as const;
export const COMMUNITY_SUBMISSION_SCHEMA_VERSION = 'community-submission.v1' as const;
export const COMMUNITY_SUBMISSION_ASSESSMENT_SCHEMA_VERSION =
  'community-submission-assessment.v1' as const;
export const COMMUNITY_HOLDER_REGISTRY_SCHEMA_VERSION = 'community-holder-registry.v1' as const;

/** Provenance identity for candidates minted from community partnership intake. */
export const COMMUNITY_PARTNERSHIP_ADAPTER_ID = 'community-partnership' as const;
export const COMMUNITY_PARTNERSHIP_PARSER_VERSION = 'community-partnership.v1' as const;
export const COMMUNITY_PARTNERSHIP_REGISTRY_ENTRY_ID = 'reg_community_partnership' as const;

/**
 * Role-based local knowledge holder types. These are institution ROLES, never named
 * individuals — outreach rosters with real contacts stay in private operator tooling.
 */
export const COMMUNITY_HOLDER_TYPES = [
  'county_historical_society',
  'local_naacp_chapter',
  'black_church_archive',
  'hbcu_faculty',
  'public_library_local_history',
  'community_elder_circle',
  'funeral_home_records',
  'black_greek_letter_chapter',
] as const;

export type CommunityHolderType = (typeof COMMUNITY_HOLDER_TYPES)[number];

export function isCommunityHolderType(value: unknown): value is CommunityHolderType {
  return (
    typeof value === 'string' && (COMMUNITY_HOLDER_TYPES as readonly string[]).includes(value)
  );
}

/** Source classifications a community holder may carry — low-authority tiers only. */
export type CommunityHolderClassification = 'community_oral' | 'self_published';

export type CommunityKnowledgeHolder = {
  readonly holderType: CommunityHolderType;
  /** Role-based label (e.g. "County Historical Society") — never a person's name. */
  readonly displayLabel: string;
  readonly classification: CommunityHolderClassification;
  /** What this holder type is best positioned to attest (guides the outreach ask). */
  readonly intakeNotes?: string;
};

export type CommunityCampaignCounty = {
  readonly countyName: string;
  /** Two-letter USPS state code. */
  readonly stateCode: string;
  /** 5-digit county FIPS when known. */
  readonly fipsCode?: string;
  readonly priorityRationale?: string;
};

/** One field of the structured submission guide handed to a knowledge holder. */
export type CommunitySubmissionFieldSpec = {
  readonly field:
    | 'personName'
    | 'role'
    | 'place'
    | 'year'
    | 'sourceCitation'
    | 'oralHistoryRef';
  readonly label: string;
  readonly required: boolean;
  readonly guidance: string;
};

/**
 * The six structured intake fields. Mirrors the api-submissions posture: contributors
 * describe evidence, they do not author public prose.
 */
export const COMMUNITY_SUBMISSION_FIELD_SPECS: readonly CommunitySubmissionFieldSpec[] = [
  {
    field: 'personName',
    label: 'Person name',
    required: true,
    guidance:
      'Full name as locally known, with variant spellings if any. If the person may still ' +
      'be living (or you are unsure), say so — unknown is treated as living and handled ' +
      'with living-person protections.',
  },
  {
    field: 'role',
    label: 'Role or occupation',
    required: true,
    guidance:
      'What the person did or was known for locally (e.g. midwife, pastor, teacher, ' +
      'business owner, organizer).',
  },
  {
    field: 'place',
    label: 'Place',
    required: true,
    guidance:
      'The connected place: church, school, business, neighborhood, or town. Historic ' +
      'place addresses are welcome; NEVER submit a living person’s current address.',
  },
  {
    field: 'year',
    label: 'Year or decade',
    required: false,
    guidance: 'Approximate year, range, or decade (e.g. "1948", "1930s", "1902–1911").',
  },
  {
    field: 'sourceCitation',
    label: 'Source citation',
    required: false,
    guidance:
      'Where this is written down: church minute book, county deed index, funeral program, ' +
      'newspaper issue, yearbook, family bible. Cite what exists — do not transcribe full ' +
      'copyrighted documents.',
  },
  {
    field: 'oralHistoryRef',
    label: 'Oral history reference',
    required: false,
    guidance:
      'If the knowledge is oral: who holds the account (role, not private contact info), ' +
      'when it was recorded or shared, and any recording/transcript identifier. At least ' +
      'one of source citation or oral history reference is required.',
  },
] as const;

/**
 * Extra-care policy for community partnership intake — modeled on
 * `CommunityFeedCarePolicy` (`../adapters/rss/curated-feeds.ts`, The American Blackstory).
 */
export type CommunityPartnershipCarePolicy = {
  /** Low-authority tier stamped on minted candidates when the holder omits one. */
  readonly defaultClassification: CommunityHolderClassification;
  /** Submissions land in research quarantine/review lanes, never canonical tables. */
  readonly quarantineFirst: true;
  /** Must attempt catalog propose-match before a research case advances. */
  readonly preferCatalogMatch: true;
  /** Evidence before assertion — citation or oral-history ref required to score. */
  readonly requireCitationOrOralHistoryRef: true;
  /** A community submission alone can never satisfy publish gates. */
  readonly cannotPublishAlone: true;
  /** Unknown living status is treated as living; living addresses never public. */
  readonly livingPersonProtections: true;
  readonly operatorCaution: string;
};

export const COMMUNITY_PARTNERSHIP_CARE_POLICY: CommunityPartnershipCarePolicy = {
  defaultClassification: 'community_oral',
  quarantineFirst: true,
  preferCatalogMatch: true,
  requireCitationOrOralHistoryRef: true,
  cannotPublishAlone: true,
  livingPersonProtections: true,
  operatorCaution:
    'Treat community partnership submissions as private research leads from identified ' +
    'local knowledge holders. They carry low-authority source tiers (community_oral / ' +
    'self_published) and can never publish alone: corroborate against archival or ' +
    'government records before any claim advances. Unknown living status is living. ' +
    'Never store or surface a living person’s address or private contact details.',
} as const;

export function assertCommunityPartnershipCarePolicy(
  care: CommunityPartnershipCarePolicy,
): void {
  if (
    !care.quarantineFirst ||
    !care.preferCatalogMatch ||
    !care.requireCitationOrOralHistoryRef ||
    !care.cannotPublishAlone ||
    !care.livingPersonProtections
  ) {
    throw new Error('Community partnership care policy missing required extra-care flags');
  }
  if (!isLowAuthoritySourceTier(care.defaultClassification)) {
    throw new Error('Community partnership default classification must be a low-authority tier');
  }
  if (!care.operatorCaution.trim()) {
    throw new Error('Community partnership care policy requires operatorCaution text');
  }
}

/** Structured submission guide for one priority county's outreach campaign. */
export type CommunityCampaignBrief = {
  readonly schemaVersion: typeof COMMUNITY_CAMPAIGN_BRIEF_SCHEMA_VERSION;
  /** Deterministic id: camp_community_<STATE>_<county-slug>. */
  readonly campaignId: string;
  readonly county: CommunityCampaignCounty;
  readonly holders: readonly CommunityKnowledgeHolder[];
  readonly fields: readonly CommunitySubmissionFieldSpec[];
  readonly care: CommunityPartnershipCarePolicy;
  /** Contributor-facing privacy and dignity notice included in every intake packet. */
  readonly privacyNotice: string;
};

const CONTRIBUTOR_PRIVACY_NOTICE =
  'We research documented Black history connected to place, with dignity. Do not submit a ' +
  'living person’s current address or private contact details. If you are unsure whether ' +
  'someone is living, we treat them as living and apply additional protections. Submitting ' +
  'does not publish: every lead is reviewed by a human researcher against our evidence ' +
  'standards before anything becomes public.';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Build the structured submission guide for a priority county and its identified local
 * knowledge holders. Pure and deterministic — no I/O, no timestamps.
 */
export function buildCommunityCampaignBrief(
  county: CommunityCampaignCounty,
  localHolders: readonly CommunityKnowledgeHolder[],
): CommunityCampaignBrief {
  if (!county.countyName.trim() || !/^[A-Z]{2}$/.test(county.stateCode)) {
    throw new Error('Community campaign county requires countyName and 2-letter stateCode');
  }
  if (localHolders.length === 0) {
    throw new Error('Community campaign requires at least one identified local knowledge holder');
  }
  for (const holder of localHolders) {
    if (!isCommunityHolderType(holder.holderType)) {
      throw new Error(`Unknown community holder type: ${String(holder.holderType)}`);
    }
    if (!holder.displayLabel.trim()) {
      throw new Error('Community knowledge holder requires a role-based displayLabel');
    }
    if (!isLowAuthoritySourceTier(holder.classification)) {
      throw new Error(
        `Community holder classification must be a low-authority tier, got: ${holder.classification}`,
      );
    }
  }
  assertCommunityPartnershipCarePolicy(COMMUNITY_PARTNERSHIP_CARE_POLICY);

  return {
    schemaVersion: COMMUNITY_CAMPAIGN_BRIEF_SCHEMA_VERSION,
    campaignId: `camp_community_${county.stateCode}_${slugify(county.countyName)}`,
    county,
    holders: localHolders,
    fields: COMMUNITY_SUBMISSION_FIELD_SPECS,
    care: COMMUNITY_PARTNERSHIP_CARE_POLICY,
    privacyNotice: CONTRIBUTOR_PRIVACY_NOTICE,
  };
}

/**
 * A structured submission received from a knowledge holder through a campaign brief.
 * Field set matches `COMMUNITY_SUBMISSION_FIELD_SPECS` exactly.
 */
export type CommunitySubmission = {
  readonly schemaVersion: typeof COMMUNITY_SUBMISSION_SCHEMA_VERSION;
  readonly submissionId: string;
  readonly campaignId: string;
  readonly holderType: CommunityHolderType;
  readonly county: CommunityCampaignCounty;
  readonly personName: string;
  readonly role: string;
  readonly place: string;
  readonly year?: string;
  readonly sourceCitation?: string;
  readonly oralHistoryRef?: string;
  /** Unknown/omitted is treated as living (constitution livingPersonRules). */
  readonly subjectLivingStatus?: 'living' | 'deceased' | 'unknown';
  /** Defaults to the care policy's `community_oral`. */
  readonly classification?: CommunityHolderClassification;
  readonly submittedAt: string;
};

/**
 * Wire payload structurally identical to `SubmissionInput` (`@repo/security`), so a
 * community submission can flow through the api-submissions quarantine service unchanged.
 * Kept as a local structural type: `@repo/domain` does not depend on `@repo/security`.
 */
export type CommunitySubmissionPayload = {
  readonly kind: 'contribution';
  readonly title: string;
  readonly statement: string;
  readonly sourceUrls: readonly string[];
  readonly targetRecordId?: string;
  readonly submitterContact?: string;
};

/** Compose the api-submissions intake payload for a community submission. */
export function toCommunitySubmissionPayload(
  submission: CommunitySubmission,
): CommunitySubmissionPayload {
  const lines = [
    `Campaign: ${submission.campaignId}`,
    `Knowledge holder type: ${submission.holderType}`,
    `County: ${submission.county.countyName}, ${submission.county.stateCode}`,
    `Person name: ${submission.personName}`,
    `Role: ${submission.role}`,
    `Place: ${submission.place}`,
    ...(submission.year !== undefined ? [`Year: ${submission.year}`] : []),
    ...(submission.sourceCitation !== undefined
      ? [`Source citation: ${submission.sourceCitation}`]
      : []),
    ...(submission.oralHistoryRef !== undefined
      ? [`Oral history reference: ${submission.oralHistoryRef}`]
      : []),
    `Living status stated: ${submission.subjectLivingStatus ?? 'unknown (treated as living)'}`,
  ];
  return {
    kind: 'contribution',
    title: `Community lead: ${submission.personName} (${submission.county.countyName}, ${submission.county.stateCode})`,
    statement: lines.join('\n'),
    sourceUrls: [],
  };
}

function assertHasEvidenceReference(submission: CommunitySubmission): void {
  const hasCitation = Boolean(submission.sourceCitation?.trim());
  const hasOralRef = Boolean(submission.oralHistoryRef?.trim());
  if (!hasCitation && !hasOralRef) {
    throw new Error(
      'Community submission requires a source citation or an oral history reference ' +
        '(evidence before assertion).',
    );
  }
}

function submissionClassification(
  submission: CommunitySubmission,
): CommunityHolderClassification {
  return submission.classification ?? COMMUNITY_PARTNERSHIP_CARE_POLICY.defaultClassification;
}

function submissionGeographicHints(submission: CommunitySubmission): readonly GeographicHint[] {
  return [
    { text: submission.place, kind: 'city', confidence: 0.8 },
    {
      text: `${submission.county.countyName}, ${submission.county.stateCode}`,
      kind: 'region',
      confidence: 0.75,
    },
    { text: submission.county.stateCode, kind: 'state', confidence: 0.9 },
  ];
}

/**
 * Mint a private discovery candidate from a structured community submission so it can run
 * through the SAME relevance gates and obscurity methodology as adapter discovery.
 *
 * `signals.outcome` is hard-coded `candidate_only`: `deriveProvisionalDecision` therefore
 * can never return `include`, so a community submission cannot self-include no matter how
 * strong its structured fields look.
 */
export function communitySubmissionToDiscoveryCandidate(
  submission: CommunitySubmission,
): DiscoveryCandidateRecord {
  assertHasEvidenceReference(submission);
  const classification = submissionClassification(submission);
  const stableIdentifier = `community:${submission.campaignId}:${submission.submissionId}`;
  const contentHash = hashUtf8(
    JSON.stringify({
      campaignId: submission.campaignId,
      personName: submission.personName,
      role: submission.role,
      place: submission.place,
      year: submission.year ?? null,
      sourceCitation: submission.sourceCitation ?? null,
      oralHistoryRef: submission.oralHistoryRef ?? null,
    }),
  );

  const sourceReference: SourceReference = {
    sourceId: `src_${COMMUNITY_PARTNERSHIP_ADAPTER_ID}_${submission.campaignId}`,
    adapterId: COMMUNITY_PARTNERSHIP_ADAPTER_ID,
    parserVersion: COMMUNITY_PARTNERSHIP_PARSER_VERSION,
    registryEntryId: COMMUNITY_PARTNERSHIP_REGISTRY_ENTRY_ID,
    runId: `run_${submission.submissionId}`,
    capturedAt: submission.submittedAt,
    stableIdentifier,
  };

  const matchedTerms = [submission.personName, submission.role, submission.place].filter(
    (term) => term.trim().length > 0,
  );
  const matchedClasses: TermClass[] = ['geographic'];
  if (submission.year !== undefined && submission.year.trim().length > 0) {
    matchedClasses.push('historical');
  }
  if (submission.sourceCitation?.trim() || submission.oralHistoryRef?.trim()) {
    matchedClasses.push('positive');
  }
  const hasCitation = Boolean(submission.sourceCitation?.trim());
  const strength = hasCitation && submission.year !== undefined ? 'medium' : 'weak';

  return {
    schemaVersion: 'discovery-candidate.v1',
    id: `cand_${submission.submissionId}`,
    identity: {
      identityKey: `${COMMUNITY_PARTNERSHIP_ADAPTER_ID}:${stableIdentifier}`,
      stableIdentifier,
      contentHash,
      sourceReferences: [sourceReference],
    },
    adapterRecord: {
      stableIdentifier,
      title: `${submission.personName} — ${submission.role} (${submission.place})`,
      classification,
      payload: {
        summary:
          `${submission.personName}, ${submission.role}, ${submission.place}` +
          (submission.year !== undefined ? `, ${submission.year}` : ''),
        holderType: submission.holderType,
        ...(submission.sourceCitation !== undefined
          ? { sourceCitation: submission.sourceCitation }
          : {}),
        ...(submission.oralHistoryRef !== undefined
          ? { oralHistoryRef: submission.oralHistoryRef }
          : {}),
      },
      provenance: {
        sourceId: sourceReference.sourceId,
        adapterId: COMMUNITY_PARTNERSHIP_ADAPTER_ID,
        parserVersion: COMMUNITY_PARTNERSHIP_PARSER_VERSION,
        registryEntryId: COMMUNITY_PARTNERSHIP_REGISTRY_ENTRY_ID,
        runId: sourceReference.runId,
        capturedAt: submission.submittedAt,
        schemaVersion: COMMUNITY_SUBMISSION_SCHEMA_VERSION,
      },
    },
    status: 'accepted',
    ingestMode: 'api',
    signals: {
      strength,
      outcome: 'candidate_only',
      matchedClasses,
      matchedTerms,
      reasons: [
        'Structured community partnership intake — fields supplied by an identified local knowledge holder.',
        hasCitation
          ? 'Source citation provided by holder.'
          : 'Oral-history reference only — weak signal pending corroboration.',
      ],
    },
    geographicHints: submissionGeographicHints(submission),
    retryCount: 0,
    createdAt: submission.submittedAt,
    updatedAt: submission.submittedAt,
  };
}

/** Routing recommendation: always the human-gated relevance review lane. */
export type CommunitySubmissionRouting = {
  readonly targetState: Extract<ResearchCaseState, 'relevance_review'>;
  readonly queue: Extract<ResearchReviewQueue, 'relevance'>;
  readonly rationale: string;
};

export type CommunitySubmissionAssessment = {
  readonly schemaVersion: typeof COMMUNITY_SUBMISSION_ASSESSMENT_SCHEMA_VERSION;
  readonly submissionId: string;
  readonly candidate: DiscoveryCandidateRecord;
  readonly relevance: RelevanceAssessment;
  readonly obscurity: ObscurityAssessment;
  readonly routing: CommunitySubmissionRouting;
  /** Unknown living = living; posture carried so downstream lanes apply protections. */
  readonly livingPersonPosture: 'treat_as_living' | 'documented_deceased';
  readonly cannotPublishAlone: true;
};

export type ScoreCommunitySubmissionOptions = {
  /** Reference corpus for obscurity IDF; defaults to an empty catalog. */
  readonly catalogTitles?: readonly string[];
  readonly assessedAt?: string;
  readonly policy?: ProductConstitution;
};

/**
 * Score a community submission through the deterministic relevance engine and the
 * obscurity methodology. Pure — no I/O, no publish side effects. Every result routes to
 * the `relevance_review` research-case state for human review; the additive low-authority
 * guard (`enforceLowAuthorityTierCannotIncludeIndependently`) is applied on top of the
 * engine decision exactly as adapter campaigns apply it.
 */
export function scoreCommunitySubmission(
  submission: CommunitySubmission,
  options: ScoreCommunitySubmissionOptions = {},
): CommunitySubmissionAssessment {
  const candidate = communitySubmissionToDiscoveryCandidate(submission);
  const assessedAt = options.assessedAt ?? submission.submittedAt;

  const engineAssessment = evaluateCandidateRelevance({
    candidate,
    assessedAt,
    ...(options.policy !== undefined ? { policy: options.policy } : {}),
  });
  const guardedDecision = enforceLowAuthorityTierCannotIncludeIndependently(
    candidate,
    engineAssessment.decision,
  );
  const relevance: RelevanceAssessment =
    guardedDecision === engineAssessment.decision
      ? engineAssessment
      : { ...engineAssessment, decision: guardedDecision };

  const corpus: ObscurityReferenceCorpus = { catalogTitles: options.catalogTitles ?? [] };
  const obscurity = scoreObscurity({ candidate, corpus, assessedAt });

  return {
    schemaVersion: COMMUNITY_SUBMISSION_ASSESSMENT_SCHEMA_VERSION,
    submissionId: submission.submissionId,
    candidate,
    relevance,
    obscurity,
    routing: {
      targetState: 'relevance_review',
      queue: 'relevance',
      rationale:
        'Community partnership submissions always require human relevance review: ' +
        `engine decision was “${relevance.decision}” on a low-authority ` +
        `(${candidate.adapterRecord.classification ?? 'unknown'}) structured intake lead.`,
    },
    livingPersonPosture:
      submission.subjectLivingStatus === 'deceased' ? 'documented_deceased' : 'treat_as_living',
    cannotPublishAlone: true,
  };
}

// --- Priority-county holder registry fixture -------------------------------------------

export type CommunityHolderRegistryCounty = CommunityCampaignCounty & {
  readonly holders: readonly CommunityKnowledgeHolder[];
};

export type CommunityHolderRegistry = {
  readonly schemaVersion: typeof COMMUNITY_HOLDER_REGISTRY_SCHEMA_VERSION;
  readonly description: string;
  readonly counties: readonly CommunityHolderRegistryCounty[];
};

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export const COMMUNITY_HOLDER_REGISTRY_PATH = join(
  FIXTURES_DIR,
  'community-holder-registry.v1.json',
);

export function parseCommunityHolderRegistry(raw: unknown): CommunityHolderRegistry {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Community holder registry must be an object.');
  }
  const value = raw as Partial<CommunityHolderRegistry>;
  if (value.schemaVersion !== COMMUNITY_HOLDER_REGISTRY_SCHEMA_VERSION) {
    throw new Error(`Unsupported community holder registry schema: ${String(value.schemaVersion)}`);
  }
  if (!value.description || !Array.isArray(value.counties) || value.counties.length === 0) {
    throw new Error('Community holder registry requires description and non-empty counties.');
  }
  for (const county of value.counties) {
    if (!Array.isArray(county.holders) || county.holders.length < 3) {
      throw new Error(
        `Registry county ${county.countyName ?? '(unnamed)'} requires at least 3 holder types.`,
      );
    }
    for (const holder of county.holders) {
      if (!isCommunityHolderType(holder.holderType)) {
        throw new Error(`Registry holder has unknown holderType: ${String(holder.holderType)}`);
      }
      if (!isLowAuthoritySourceTier(holder.classification)) {
        throw new Error(
          `Registry holder ${holder.displayLabel ?? ''} must carry a low-authority classification.`,
        );
      }
    }
  }
  return value as CommunityHolderRegistry;
}

/** Load the seeded priority-county holder registry (role-based placeholders only). */
export function loadCommunityHolderRegistry(): CommunityHolderRegistry {
  const raw = JSON.parse(readFileSync(COMMUNITY_HOLDER_REGISTRY_PATH, 'utf8')) as unknown;
  return parseCommunityHolderRegistry(raw);
}
