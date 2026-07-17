/**
 * BB-060 red-team scenario runners — deterministic fixtures against real integrity gates.
 */
import {
  advancePromotionRecord,
  advanceToDiscoveryCandidate,
  assertNoIdentityAttributeFraming,
  collapseSupportingEvidence,
  createResearchCase,
  detectDuplicateAndCoordinatedEvidence,
  evaluatePromotionGate,
  evaluatePublicLanguage,
  markResearchCasePublished,
  recalculateConfidence,
  recalculateConfidenceWithSybilSignals,
  routeConsensusReview,
  transitionResearchCase,
  type SourceIndependenceMetadata,
} from '@black-book/domain';
import {
  MASS_ASSIGNMENT_FIXTURE,
} from '../security-gates/fixtures.js';
import {
  assertPublicProjectionSafe,
  createQuarantinedSubmission,
  createSubmissionCampaignDetector,
  redactLocationForPublic,
  type SubmissionInput,
} from '@black-book/security';
import {
  BASE_NOW_ISO,
  claimEvidenceLink,
  promotionClaim,
  promotionEvidence,
  submissionContext,
} from './fixtures.js';
import { summarizeAdversarialScenario, type AdversarialHarnessStep } from './harness.js';
import type { AdversarialIntegrityScenarioId, AdversarialScenarioRunResult } from './types.js';

export type ScenarioRunner = () => AdversarialScenarioRunResult;

function runner(
  scenarioId: AdversarialIntegrityScenarioId,
  execute: () => readonly AdversarialHarnessStep[],
): ScenarioRunner {
  return () => summarizeAdversarialScenario(scenarioId, execute());
}

const FALSE_SOURCE: SubmissionInput = {
  kind: 'contribution',
  title: 'Fabricated archive entry',
  statement:
    'This institution was founded in 1842 according to a newly discovered private blog with no archival backing.',
  sourceUrls: ['https://totally-fabricated-source.example/history'],
};

export const runFalseSourceSubmissionsScenario = runner('false_source_submissions', () => {
  const quarantine = createQuarantinedSubmission(FALSE_SOURCE, submissionContext());
  const steps: AdversarialHarnessStep[] = [];

  if (quarantine.accepted) {
    steps.push({
      attackBlocked: !quarantine.record.canonicalWriteAllowed,
      publicContentMutated: false,
      controls: [
        {
          layer: 'submission_quarantine',
          reason: 'canonical_write_forbidden',
        },
      ],
    });
  } else {
    steps.push({
      attackBlocked: true,
      publicContentMutated: false,
      controls: [
        {
          layer: 'submission_quarantine',
          reason: quarantine.rejection.issues.map((issue) => issue.reason).join(','),
        },
      ],
    });
  }

  const promotion = evaluatePromotionGate({
    claim: promotionClaim({
      confidence: 0.99,
      evidence: [
        promotionEvidence('fabricated', 'fabricated-lineage', {
          reputation: 'unknown',
          quality: 0.2,
        }),
      ],
    }),
    approverId: 'approver-bb060',
  });
  steps.push({
    attackBlocked: !promotion.approved,
    publicContentMutated: false,
    controls: [
      {
        layer: 'promotion_gate',
        reason: promotion.reasons.join(',') || 'promotion_denied',
      },
    ],
  });

  return steps;
});

export const runSourceLaunderingScenario = runner('source_laundering', () => {
  const metadata: SourceIndependenceMetadata[] = [
    {
      lineageRootId: 'mirror_a',
      evidenceId: 'ev_a',
      domain: 'history-blog-a.example',
      rdapRegistrantHash: 'registrant-shared-hash',
    },
    {
      lineageRootId: 'mirror_b',
      evidenceId: 'ev_b',
      domain: 'history-blog-b.example',
      rdapRegistrantHash: 'registrant-shared-hash',
    },
  ];
  const links = [
    claimEvidenceLink('a', 'mirror_a', { sourceClassification: 'reputable_secondary' }),
    claimEvidenceLink('b', 'mirror_b', { sourceClassification: 'reputable_secondary' }),
  ];
  const sybil = recalculateConfidenceWithSybilSignals({
    claimClass: 'standard',
    evidenceLinks: links,
    sourceIndependenceMetadata: metadata,
    calculatedAt: BASE_NOW_ISO,
    referenceDate: BASE_NOW_ISO,
  });

  return [
    {
      attackBlocked: !sybil.passesPublishThreshold,
      publicContentMutated: false,
      lineageInflationPrevented:
        sybil.sourceIndependence.sharedInfrastructureClusters.length > 0 &&
        sybil.topTier.topTierSourcePresent === false,
      controls: [
        {
          layer: 'sybil_signals',
          reason: 'shared_infrastructure_cluster_detected',
        },
        {
          layer: 'top_tier_source_gate',
          reason: sybil.topTier.topTierSourcePresent ? 'top_tier_present' : 'top_tier_missing',
        },
      ],
    },
  ];
});

export const runCoordinatedCitationRepetitionScenario = runner('coordinated_citation_repetition', () => {
  const coordinated = Array.from({ length: 12 }, (_, index) =>
    promotionEvidence(`repeat-${index}`, `lineage-${index}`, {
      coordinatedGroupId: 'citation-ring-1',
      independenceGroupId: `actor-${index}`,
    }),
  );
  const detection = detectDuplicateAndCoordinatedEvidence(coordinated);
  const collapsed = collapseSupportingEvidence(coordinated);
  const gate = evaluatePromotionGate({
    claim: promotionClaim({ confidence: 0.99, evidence: coordinated }),
    approverId: 'approver-bb060',
  });

  return [
    {
      attackBlocked: !gate.approved,
      publicContentMutated: false,
      lineageInflationPrevented:
        gate.rawSupportingEvidenceCount > gate.independentLineageCount &&
        gate.independentLineageCount <= 1,
      controls: [
        {
          layer: 'lineage_collapse',
          reason: `coordinated:${detection.coordinatedEvidenceIds.length},independent:${collapsed.length}`,
        },
        {
          layer: 'promotion_gate',
          reason: gate.reasons.join(','),
        },
      ],
    },
  ];
});

export const runAlteredDocumentsScenario = runner('altered_documents', () => {
  const originals = [
    promotionEvidence('original', 'lineage-archive', { contentFingerprint: 'archive-page-v1' }),
    promotionEvidence('tampered', 'lineage-mirror', { contentFingerprint: 'archive-page-v1' }),
  ];
  const duplicates = detectDuplicateAndCoordinatedEvidence(originals);
  const gate = evaluatePromotionGate({
    claim: promotionClaim({
      evidence: [
        ...originals,
        promotionEvidence('contradiction', 'lineage-contra', {
          role: 'contradicting',
          credible: true,
        }),
      ],
    }),
    approverId: 'approver-bb060',
  });

  return [
    {
      attackBlocked: !gate.approved,
      publicContentMutated: false,
      controls: [
        {
          layer: 'lineage_collapse',
          reason: `duplicate_evidence:${duplicates.duplicateEvidenceIds.join(',')}`,
        },
        {
          layer: 'promotion_gate',
          reason: gate.reasons.join(','),
        },
      ],
    },
  ];
});

export const runMisidentifiedPeopleScenario = runner('misidentified_people', () => {
  const wrongPerson = recalculateConfidence({
    claimClass: 'standard',
    calculatedAt: BASE_NOW_ISO,
    evidenceLinks: [
      claimEvidenceLink('weak-match', 'lineage-a', {
        entityMatchQuality: 0.15,
        sourceClassification: 'reputable_secondary',
      }),
      claimEvidenceLink('weak-match-b', 'lineage-b', {
        entityMatchQuality: 0.2,
        sourceClassification: 'reputable_secondary',
      }),
    ],
  });

  return [
    {
      attackBlocked: !wrongPerson.passesPublishThreshold,
      publicContentMutated: false,
      controls: [
        {
          layer: 'confidence_threshold',
          reason: `score:${wrongPerson.score},threshold:${wrongPerson.threshold}`,
        },
      ],
    },
  ];
});

export const runLivingAddressAttemptsScenario = runner('living_address_attempts', () => {
  const redacted = redactLocationForPublic({
    lat: 40.741895,
    lng: -73.989308,
    geohash: 'dr5ru7',
    precision: 'street_address',
    livingStatus: 'living',
    occupiedPrivateResidence: true,
  });
  if (!redacted) {
    return [
      {
        attackBlocked: true,
        publicContentMutated: false,
        controls: [
          {
            layer: 'public_serialization',
            reason: 'location_fully_redacted',
          },
        ],
      },
    ];
  }
  let serializationBlocked = false;
  try {
    assertPublicProjectionSafe({
      displayName: 'Living person record',
      summary: 'Currently resides at 742 Evergreen Terrace in Springfield.',
      location: redacted,
    });
  } catch {
    serializationBlocked = true;
  }

  return [
    {
      attackBlocked: redacted.precision !== 'street_address' && serializationBlocked,
      publicContentMutated: false,
      controls: [
        {
          layer: 'public_serialization',
          reason: `reduced_precision:${redacted.precision}`,
        },
        {
          layer: 'public_serialization',
          reason: serializationBlocked ? 'address_pattern_rejected' : 'serialization_allowed',
        },
      ],
    },
  ];
});

export const runProceduralStatusInflationScenario = runner('procedural_status_inflation', () => {
  const inflated = evaluatePublicLanguage({
    text: 'The subject was convicted of fraud in 2019.',
    requestedProceduralStatus: 'convicted',
    evidenceProceduralStatus: 'alleged',
  });
  const supported = evaluatePublicLanguage({
    text: 'The subject was alleged to have participated.',
    requestedProceduralStatus: 'alleged',
    evidenceProceduralStatus: 'alleged',
  });

  return [
    {
      attackBlocked: !inflated.allowed,
      publicContentMutated: false,
      publicLanguageConstrained: !inflated.allowed && supported.allowed,
      controls: [
        {
          layer: 'public_language',
          reason: inflated.violations.join(',') || 'procedural_status_exceeds_evidence',
        },
      ],
    },
  ];
});

export const runRaceInferenceScenario = runner('race_inference', () => {
  const adversarialPublicCopy =
    'This person should be flagged because of their ethnicity and skin color in the neighborhood.';
  let identityFramingBlocked = false;
  try {
    assertNoIdentityAttributeFraming(adversarialPublicCopy);
  } catch {
    identityFramingBlocked = true;
  }

  const quarantine = createQuarantinedSubmission(
    {
      kind: 'abuse_report',
      title: 'Flag by identity attribute',
      statement: `${adversarialPublicCopy} Please remove this record immediately.`,
      sourceUrls: ['https://example.org/report'],
    },
    submissionContext(),
  );

  return [
    {
      attackBlocked: identityFramingBlocked,
      publicContentMutated: false,
      publicLanguageConstrained: identityFramingBlocked,
      controls: [
        {
          layer: 'public_language',
          reason: 'identity_attribute_framing_rejected',
        },
        {
          layer: 'submission_quarantine',
          reason: quarantine.accepted ? 'quarantined_not_canonical' : 'submission_rejected',
        },
      ],
    },
  ];
});

export const runRelevanceGamingScenario = runner('relevance_gaming', () => {
  const record = createResearchCase({
    id: 'case-relevance-game',
    candidateId: 'candidate-relevance-game',
    title: 'Attempt to skip relevance review',
    checklist: { items: [] },
    now: BASE_NOW_ISO,
  });
  let skipBlocked = false;
  try {
    transitionResearchCase(record, {
      targetState: 'minimum_record',
      actorId: 'attacker',
      now: BASE_NOW_ISO,
      reasonCode: 'minimum_record_complete',
      reason: 'Skip straight to publication checklist.',
    });
  } catch {
    skipBlocked = true;
  }

  const promotion = evaluatePromotionGate({
    claim: promotionClaim({
      confidence: 0.99,
      evidence: [promotionEvidence('single', 'only-lineage')],
    }),
    approverId: 'approver-bb060',
  });

  return [
    {
      attackBlocked: skipBlocked && !promotion.approved,
      publicContentMutated: false,
      controls: [
        {
          layer: 'research_case_workflow',
          reason: skipBlocked ? 'illegal_state_transition' : 'transition_allowed',
        },
        {
          layer: 'promotion_gate',
          reason: promotion.reasons.join(','),
        },
      ],
    },
  ];
});

export const runModeratorSocialEngineeringScenario = runner('moderator_social_engineering', () => {
  const selfApproval = evaluatePromotionGate({
    claim: promotionClaim(),
    approverId: 'researcher-bb060',
  });
  const massAssignment = createQuarantinedSubmission(MASS_ASSIGNMENT_FIXTURE, submissionContext());
  const consensus = routeConsensusReview(
    'submission-social-engineering',
    [
      {
        reviewId: 'review-1',
        submissionId: 'submission-social-engineering',
        reviewerId: 'reviewer-1',
        verdict: 'legitimate_lead',
        reviewedAt: BASE_NOW_ISO,
      },
    ],
    BASE_NOW_ISO,
  );
  let advanceBlocked = false;
  try {
    advanceToDiscoveryCandidate({
      decision: consensus,
      lead: { submissionId: 'submission-social-engineering', title: 'Social engineering lead' },
      researchCaseId: 'case-social-engineering',
      now: BASE_NOW_ISO,
    });
  } catch {
    advanceBlocked = true;
  }

  return [
    {
      attackBlocked:
        !selfApproval.approved &&
        !massAssignment.accepted &&
        consensus.status !== 'auto_advance' &&
        advanceBlocked,
      publicContentMutated: false,
      controls: [
        {
          layer: 'promotion_gate',
          reason: selfApproval.reasons.join(','),
        },
        {
          layer: 'submission_quarantine',
          reason: massAssignment.accepted ? 'accepted' : 'schema_invalid',
        },
        {
          layer: 'consensus_review',
          reason: `${consensus.status}:${consensus.reason}`,
        },
      ],
    },
  ];
});

export const runUnauthorizedPublicationScenario = runner('unauthorized_publication', () => {
  const candidate = createResearchCase({
    id: 'case-unauthorized',
    candidateId: 'candidate-unauthorized',
    title: 'Unauthorized publish attempt',
    checklist: { items: [] },
    now: BASE_NOW_ISO,
  });
  let publishBlocked = false;
  try {
    markResearchCasePublished(candidate, {
      releaseId: 'release-attacker',
      revision: '1',
      publishedAt: BASE_NOW_ISO,
    });
  } catch {
    publishBlocked = true;
  }

  const sybil = recalculateConfidenceWithSybilSignals({
    claimClass: 'standard',
    calculatedAt: BASE_NOW_ISO,
    evidenceLinks: [
      claimEvidenceLink('low-trust-a', 'lineage-a', { sourceClassification: 'community_oral' }),
      claimEvidenceLink('low-trust-b', 'lineage-b', { sourceClassification: 'self_published' }),
    ],
  });

  let stageSkipBlocked = false;
  try {
    advancePromotionRecord(
      {
        id: 'promotion-unauthorized',
        stage: 'submission_discovery',
        submissionOrDiscoveryId: 'submission-unauthorized',
        updatedAt: BASE_NOW_ISO,
      },
      'release',
      { now: BASE_NOW_ISO, releaseId: 'release-attacker' },
    );
  } catch {
    stageSkipBlocked = true;
  }

  return [
    {
      attackBlocked: publishBlocked && !sybil.passesPublishThreshold && stageSkipBlocked,
      publicContentMutated: false,
      controls: [
        {
          layer: 'research_case_workflow',
          reason: publishBlocked ? 'publication_requirements_unmet' : 'published_without_review',
        },
        {
          layer: 'top_tier_source_gate',
          reason: sybil.topTier.topTierSourcePresent ? 'top_tier_present' : 'top_tier_missing',
        },
        {
          layer: 'promotion_gate',
          reason: stageSkipBlocked ? 'stage_skip_forbidden' : 'stage_skip_allowed',
        },
      ],
    },
  ];
});

export function runAllAdversarialIntegrityScenarios(): readonly {
  readonly scenarioId: AdversarialIntegrityScenarioId;
  readonly result: AdversarialScenarioRunResult;
}[] {
  const runners: ScenarioRunner[] = [
    runFalseSourceSubmissionsScenario,
    runSourceLaunderingScenario,
    runCoordinatedCitationRepetitionScenario,
    runAlteredDocumentsScenario,
    runMisidentifiedPeopleScenario,
    runLivingAddressAttemptsScenario,
    runProceduralStatusInflationScenario,
    runRaceInferenceScenario,
    runRelevanceGamingScenario,
    runModeratorSocialEngineeringScenario,
    runUnauthorizedPublicationScenario,
  ];
  return runners.map((run) => {
    const result = run();
    return { scenarioId: result.scenarioId, result };
  });
}
