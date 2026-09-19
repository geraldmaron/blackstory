"""Generated from the canonical research-kernel JSON Schema. Do not edit."""

from __future__ import annotations

from typing import Any, Literal, TypeAlias

from .validation import ContractModel

class Budget(ContractModel):
    queries: int
    candidateUrls: int
    fullCaptures: int
    relationshipHops: int
    durationMinutes: int
    paidModelUsd: float

class RiskClassPolicy(ContractModel):
    id: str
    description: str
    budgetClass: Literal["standard", "highImpact"]
    escalationTriggers: list[str]

class SourceFitnessRule(ContractModel):
    sourceClass: str
    claimClass: str
    fitness: Literal["authoritative", "strong", "conditional", "leadOnly", "unfit"]
    limitations: list[str]

class ModelPolicy(ContractModel):
    mode: Literal["deterministic", "local-triage", "free-batch", "paid-research", "quality-prose", "independent-review", "trusted-session"]
    modelIds: list[str]
    authority: list[str]
    requiresBenchmark: bool
    mayApprove: bool

class RetentionPolicy(ContractModel):
    acceptedProvenanceDays: int | None
    searchCacheDays: int
    failedModelPayloadDays: int
    deadLetterDraftDays: int
    holdExemptions: list[Literal["case", "audit", "rights", "legal"]]

class PublicationPolicy(ContractModel):
    automaticPublicPromotion: bool
    requireDistinctActor: bool
    requireDistinctModelFamily: bool
    claimPrecisionLowerBound: float
    highImpactPrecisionLowerBound: float
    entityFalseMergeUpperBound: float
    confidenceEceMaximum: float
    unsupportedSentenceRateMaximum: float

class StoppingPolicy(ContractModel):
    frontierScoreThreshold: float
    consecutiveTasksBelowThreshold: int
    requireMandatoryNeedsComplete: bool
    requireContradictionSearch: bool
    escalationTriggers: list[str]

class ResearchProfile(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    version: str
    name: str
    scope: dict[str, Any]
    vocabulary: dict[str, list[str]]
    sensitivityRules: list[str]
    sourceFitness: list[SourceFitnessRule]
    queryPacks: dict[str, list[str]]
    riskClasses: list[RiskClassPolicy]
    budgets: dict[str, Any]
    modelPolicies: list[ModelPolicy]
    retention: RetentionPolicy
    publication: PublicationPolicy
    stopping: StoppingPolicy

class SourcePolicy(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    version: str
    displayName: str
    sourceClass: str
    rights: dict[str, Any]
    retrieval: dict[str, Any]
    claimFitness: list[SourceFitnessRule]

class SourceItem(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    sourcePolicyId: str
    stableIdentifier: str
    canonicalUrl: str | None
    title: str | None
    publishedAt: str | None
    upstreamSourceIds: list[str]
    metadata: dict[str, Any] | None = None

class Capture(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    sourceItemId: str
    capturedAt: str
    contentHashAlgorithm: Literal["sha256", "sha512"]
    contentHashDigest: str
    mediaType: str
    storageUri: str
    parserVersion: str | None
    rightsStatus: Literal["open", "licensed", "restricted", "unknown", "prohibited"]
    dedupOfCaptureId: str | None | None = None

class EvidenceSelector(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    captureId: str
    selectorType: Literal["TextQuoteSelector", "TextPositionSelector", "FragmentSelector", "PageSelector", "TimeSelector"]
    conformsTo: str
    exact: str | None
    prefix: str | None
    suffix: str | None
    start: int | None | None = None
    end: int | None | None = None
    page: int | None | None = None
    timeStartSeconds: float | None | None = None
    timeEndSeconds: float | None | None = None
    fragment: str | None | None = None
    sourceItemId: str

class ClaimQualifiers(ContractModel):
    temporal: dict[str, Any]
    geographic: dict[str, Any]
    jurisdictional: dict[str, Any]
    procedural: dict[str, Any]
    uncertainty: dict[str, Any]

class ConfidenceAssessment(ContractModel):
    acceptanceProbability: float
    intervalLow: float
    intervalHigh: float
    sourceReliability: float
    entailment: float
    independence: float
    identityConfidence: float
    relevance: float
    researchCompleteness: float
    calibrationVersion: str

class ClaimStatement(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    version: int
    subjectEntityId: str
    predicate: str
    object: dict[str, Any]
    claimClass: Literal["standard", "highImpact", "legal", "sensitive", "livingPerson"]
    qualifiers: ClaimQualifiers
    status: Literal["proposed", "accepted", "rejected", "superseded", "corrected", "retracted", "deleted"]
    supersedesClaimVersionId: str | None
    confidence: ConfidenceAssessment | None | None = None

class EvidenceAssignment(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    claimVersionId: str
    selectorId: str
    role: Literal["supporting", "contradicting", "contextual", "leadOnly"]
    fitness: Literal["authoritative", "strong", "conditional", "leadOnly", "unfit"]
    entailmentProbability: float
    lineageClusterId: str
    derivedFromAssignmentId: str | None
    reviewerActorId: str | None
    status: Literal["proposed", "accepted", "rejected", "superseded"]

class ResearchCase(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    profileId: str
    title: str
    riskClass: str
    status: Literal["open", "escalated", "stopped", "completed", "cancelled"]
    createdBy: str
    createdAt: str

class ResearchQuestion(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    caseId: str
    question: str
    priority: float
    status: Literal["open", "answered", "deferred", "cancelled"]

class Hypothesis(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    questionId: str
    statement: str
    status: Literal["open", "supported", "contradicted", "mixed", "rejected"]

class EvidenceNeed(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    questionId: str
    claimClass: str
    description: str
    mandatory: bool
    contradictionSearch: bool
    status: Literal["open", "satisfied", "blocked", "waived"]

class FrontierTask(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    caseId: str
    taskType: Literal["query", "capture", "extract", "verify", "resolveEntity", "expandRelationship", "contradictionSearch", "rightsReview"]
    targetId: str | None
    riskWeight: float
    expectedEntropyReduction: float
    sourceNovelty: float
    contradictionValue: float
    normalizedCost: float
    score: float
    hop: int
    status: Literal["pending", "leased", "completed", "failed", "deadLetter", "cancelled"]

class EntityCandidate(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    mention: str
    entityKind: str
    normalizedNames: list[str]
    identifiers: dict[str, str]
    jurisdictions: list[str]
    activeFrom: str | None
    activeTo: str | None
    blockingKeys: list[str]
    sourceSelectorId: str

class ResolutionDecision(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    candidateId: str
    entityId: str | None
    decision: Literal["match", "noMatch", "defer", "reject"]
    matchProbability: float
    hardStopReasons: list[Literal["trustedIdentifierConflict", "impossibleLifespan", "incompatibleKind", "exclusiveGeographyTime"]]
    clusterConsistent: bool
    reversible: Literal[True]
    modelVersion: str
    reviewerActorId: str | None

class RelationshipStatement(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    subjectEntityId: str
    predicate: Literal["served_as", "located_at", "succeeded", "challenged_law", "participated_in", "funded_by", "founded", "member_of", "published", "occurred_at"]
    objectEntityId: str
    qualifiers: ClaimQualifiers
    evidenceAssignmentIds: list[str]
    status: Literal["proposed", "accepted", "rejected", "superseded", "retracted"]

class ResearchRun(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    caseId: str
    profileId: str
    profileVersion: str
    policyVersion: str
    mode: Literal["deterministic", "local-triage", "free-batch", "paid-research", "quality-prose", "independent-review", "trusted-session"]
    status: Literal["pending", "running", "succeeded", "failed", "cancelled", "escalated"]
    startedAt: str
    completedAt: str | None
    costUsd: float
    counts: dict[str, int]
    terminalReason: str | None

class AgentActivity(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    runId: str
    provType: Literal["prov:Activity"]
    actorId: str
    actorType: Literal["human", "model", "service", "trustedSession"]
    modelFamily: str | None
    startedAt: str
    endedAt: str | None
    usedArtifactIds: list[str]
    generatedArtifactIds: list[str]
    wasAssociatedWith: str

class ModelInvocation(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    activityId: str
    provider: Literal["openrouter", "ollama", "openai", "anthropic", "other"]
    modelId: str
    modelFamily: str
    providerRoute: dict[str, Any]
    priceSnapshot: dict[str, Any]
    promptHash: str
    outputSchemaId: str
    outputSchemaVersion: str
    benchmarkVersion: str
    rawResponse: str
    status: Literal["pending", "valid", "invalid", "failed"]
    repairOfInvocationId: str | None
    accounting: ModelAccounting

class InvalidModelOutput(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    invocationId: str
    rawOutput: str
    validationErrors: list[str]
    quarantinedAt: str
    retentionUntil: str

class Artifact(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    runId: str
    activityId: str
    artifactType: str
    contentHash: str
    schemaId: str
    schemaVersionUsed: str
    storageUri: str
    status: Literal["proposed", "accepted", "rejected", "quarantined", "superseded"]
    createdAt: str

class ReviewDecision(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    artifactId: str
    decision: Literal["approve", "reject", "requestChanges"]
    reviewerActorId: str
    reviewerModelFamily: str | None
    producerActorId: str
    producerModelFamily: str | None
    findings: list[dict[str, Any]]
    decidedAt: str

class ReleaseDecision(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    artifactId: str
    releaseId: str
    decision: Literal["stage", "activate", "rollback", "block"]
    reviewDecisionId: str
    publisherActorId: str
    producerActorId: str
    policyVersion: str
    decidedAt: str

class SentenceCitation(ContractModel):
    sentenceId: str
    sentenceText: str
    factual: bool
    claimVersionIds: list[str]
    evidenceAssignmentIds: list[str]

class VerificationReport(ContractModel):
    factualSentenceCount: int
    supportedFactualSentenceCount: int
    distinctLineageChecked: bool
    rightsChecked: bool
    entityLinksChecked: bool
    legalStatusChecked: bool
    plagiarismChecked: bool
    styleChecked: bool
    blockingFindings: list[str]

class StoryResearchPacket(ContractModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    caseId: str
    title: str
    acceptedClaimVersionIds: list[str]
    sentenceCitations: list[SentenceCitation]
    relatedRelationshipIds: list[str]
    proseDraftArtifactId: str
    verificationReport: VerificationReport
    producerActivityId: str
    reviewDecisionIds: list[str]
    approvalLineageComplete: bool
    status: Literal["draft", "auditReady", "awaitingApproval", "approved", "rejected", "released", "retracted"]

class RoCrateExport(ContractModel):
    schemaVersion: Literal["1.0.0"]
    conformsTo: Literal["https://w3id.org/ro/crate/1.1"]
    crateId: str
    createdAt: str
    profile: ResearchProfile
    entities: list[dict[str, Any]]
    activities: list[AgentActivity]
    artifacts: list[Artifact]
    checksums: dict[str, str]

class ResearchQuote(ContractModel):
    citationUrl: str
    quote: str

class ExtractedResearchClaim(ContractModel):
    id: str
    predicate: str
    object: str
    confidence: float
    evidence: ResearchQuote

class SubjectExtraction(ContractModel):
    title: str
    publicSummary: str
    historicalContext: str
    confidence: float
    claims: list[ExtractedResearchClaim]

class RelationshipHypothesisExtraction(ContractModel):
    relationType: str
    confidence: float
    rationale: str
    evidence: list[ResearchQuote]

class HarnessSourceRecord(ContractModel):
    id: str
    connectorKind: str
    title: str
    description: str
    cites: list[str]
    rawRecord: dict[str, Any]
    coordinates: dict[str, Any] | None = None
    locationName: str | None = None
    county: str | None = None
    state: str | None = None

class ResearchTaskSpec(ContractModel):
    frontier: FrontierTask
    evidenceNeedId: str | None
    dependsOn: list[str]
    input: dict[str, Any]
    outputContract: Literal["HarnessSourceRecord", "SubjectExtraction", "RelationshipHypothesisExtraction", "ResearchSearchResult", "ResearchTaskReport", "ResearchAcquisitionResult"]
    maxAttempts: int
    maxCostUsdPerAttempt: float

class ResearchExecutionPlan(ContractModel):
    schemaVersion: Literal["1.0.0"]
    profile: ResearchProfile
    run: ResearchRun
    budgetClass: Literal["standard", "highImpact"]
    questions: list[ResearchQuestion]
    needs: list[EvidenceNeed]
    tasks: list[ResearchTaskSpec]

class ResearchSearchResult(ContractModel):
    query: str
    seeking: str
    leads: list[dict[str, Any]]
    limitations: list[str]

class ResearchTaskReport(ContractModel):
    summary: str
    limitations: list[str]
    evidence: list[ResearchQuote]

class ModelAccounting(ContractModel):
    promptTokens: int | None
    completionTokens: int | None
    costUsd: float | None
    source: Literal["provider-response", "external-receipt", None]
    incomplete: bool

class ResearchTaskLease(ContractModel):
    runId: str
    task: ResearchTaskSpec
    workerId: str
    leaseToken: str
    expiresAt: str
    attempt: int
    activityId: str
    dependencies: list[dict[str, Any]]

class PreservationDecision(ContractModel):
    sourceUrl: str
    allowTextRetention: bool
    allowArchive: bool
    sensitivity: Literal["public", "restricted", "unknown"]
    reviewedBy: str
    reviewedAt: str
    expiresAt: str
    basis: str

class ResearchAcquisitionResult(ContractModel):
    sources: list[HarnessSourceRecord]
    limitations: list[str]

class ResearchWorkerModel(ContractModel):
    provider: Literal["openrouter", "ollama"]
    id: str
    family: str
    maxTokens: int
    maxPromptBytes: int
    promptUsdPerMillion: float
    completionUsdPerMillion: float

ResearchWorkerInput: TypeAlias = dict[str, Any] | dict[str, Any] | dict[str, Any]

Budget.model_rebuild()
RiskClassPolicy.model_rebuild()
SourceFitnessRule.model_rebuild()
ModelPolicy.model_rebuild()
RetentionPolicy.model_rebuild()
PublicationPolicy.model_rebuild()
StoppingPolicy.model_rebuild()
ResearchProfile.model_rebuild()
SourcePolicy.model_rebuild()
SourceItem.model_rebuild()
Capture.model_rebuild()
EvidenceSelector.model_rebuild()
ClaimQualifiers.model_rebuild()
ConfidenceAssessment.model_rebuild()
ClaimStatement.model_rebuild()
EvidenceAssignment.model_rebuild()
ResearchCase.model_rebuild()
ResearchQuestion.model_rebuild()
Hypothesis.model_rebuild()
EvidenceNeed.model_rebuild()
FrontierTask.model_rebuild()
EntityCandidate.model_rebuild()
ResolutionDecision.model_rebuild()
RelationshipStatement.model_rebuild()
ResearchRun.model_rebuild()
AgentActivity.model_rebuild()
ModelInvocation.model_rebuild()
InvalidModelOutput.model_rebuild()
Artifact.model_rebuild()
ReviewDecision.model_rebuild()
ReleaseDecision.model_rebuild()
SentenceCitation.model_rebuild()
VerificationReport.model_rebuild()
StoryResearchPacket.model_rebuild()
RoCrateExport.model_rebuild()
ResearchQuote.model_rebuild()
ExtractedResearchClaim.model_rebuild()
SubjectExtraction.model_rebuild()
RelationshipHypothesisExtraction.model_rebuild()
HarnessSourceRecord.model_rebuild()
ResearchTaskSpec.model_rebuild()
ResearchExecutionPlan.model_rebuild()
ResearchSearchResult.model_rebuild()
ResearchTaskReport.model_rebuild()
ModelAccounting.model_rebuild()
ResearchTaskLease.model_rebuild()
PreservationDecision.model_rebuild()
ResearchAcquisitionResult.model_rebuild()
ResearchWorkerModel.model_rebuild()

CONTRACT_MODEL_NAMES = ("Budget", "RiskClassPolicy", "SourceFitnessRule", "ModelPolicy", "RetentionPolicy", "PublicationPolicy", "StoppingPolicy", "ResearchProfile", "SourcePolicy", "SourceItem", "Capture", "EvidenceSelector", "ClaimQualifiers", "ConfidenceAssessment", "ClaimStatement", "EvidenceAssignment", "ResearchCase", "ResearchQuestion", "Hypothesis", "EvidenceNeed", "FrontierTask", "EntityCandidate", "ResolutionDecision", "RelationshipStatement", "ResearchRun", "AgentActivity", "ModelInvocation", "InvalidModelOutput", "Artifact", "ReviewDecision", "ReleaseDecision", "SentenceCitation", "VerificationReport", "StoryResearchPacket", "RoCrateExport", "ResearchQuote", "ExtractedResearchClaim", "SubjectExtraction", "RelationshipHypothesisExtraction", "HarnessSourceRecord", "ResearchTaskSpec", "ResearchExecutionPlan", "ResearchSearchResult", "ResearchTaskReport", "ModelAccounting", "ResearchTaskLease", "PreservationDecision", "ResearchAcquisitionResult", "ResearchWorkerModel",)

