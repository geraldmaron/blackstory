"""Generated from the canonical research-kernel JSON Schema. Do not edit."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

class Budget(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    queries: int
    candidateUrls: int
    fullCaptures: int
    relationshipHops: int
    durationMinutes: int
    paidModelUsd: float

class RiskClassPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str
    description: str
    budgetClass: Literal["standard", "highImpact"]
    escalationTriggers: list[str]

class SourceFitnessRule(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    sourceClass: str
    claimClass: str
    fitness: Literal["authoritative", "strong", "conditional", "leadOnly", "unfit"]
    limitations: list[str]

class ModelPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    mode: Literal["deterministic", "local-triage", "free-batch", "paid-research", "quality-prose", "independent-review", "trusted-session"]
    modelIds: list[str]
    authority: list[str]
    requiresBenchmark: bool
    mayApprove: bool

class RetentionPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    acceptedProvenanceDays: int | None
    searchCacheDays: int
    failedModelPayloadDays: int
    deadLetterDraftDays: int
    holdExemptions: list[Literal["case", "audit", "rights", "legal"]]

class PublicationPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    automaticPublicPromotion: bool
    requireDistinctActor: bool
    requireDistinctModelFamily: bool
    claimPrecisionLowerBound: float
    highImpactPrecisionLowerBound: float
    entityFalseMergeUpperBound: float
    confidenceEceMaximum: float
    unsupportedSentenceRateMaximum: float

class StoppingPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    frontierScoreThreshold: float
    consecutiveTasksBelowThreshold: int
    requireMandatoryNeedsComplete: bool
    requireContradictionSearch: bool
    escalationTriggers: list[str]

class ResearchProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class SourcePolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schemaVersion: Literal["1.0.0"]
    id: str
    version: str
    displayName: str
    sourceClass: str
    rights: dict[str, Any]
    retrieval: dict[str, Any]
    claimFitness: list[SourceFitnessRule]

class SourceItem(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schemaVersion: Literal["1.0.0"]
    id: str
    sourcePolicyId: str
    stableIdentifier: str
    canonicalUrl: str | None
    title: str | None
    publishedAt: str | None
    upstreamSourceIds: list[str]
    metadata: dict[str, Any] | None = None

class Capture(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class EvidenceSelector(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class ClaimQualifiers(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    temporal: dict[str, Any]
    geographic: dict[str, Any]
    jurisdictional: dict[str, Any]
    procedural: dict[str, Any]
    uncertainty: dict[str, Any]

class ConfidenceAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class ClaimStatement(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class EvidenceAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class ResearchCase(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schemaVersion: Literal["1.0.0"]
    id: str
    profileId: str
    title: str
    riskClass: str
    status: Literal["open", "escalated", "stopped", "completed", "cancelled"]
    createdBy: str
    createdAt: str

class ResearchQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schemaVersion: Literal["1.0.0"]
    id: str
    caseId: str
    question: str
    priority: float
    status: Literal["open", "answered", "deferred", "cancelled"]

class Hypothesis(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schemaVersion: Literal["1.0.0"]
    id: str
    questionId: str
    statement: str
    status: Literal["open", "supported", "contradicted", "mixed", "rejected"]

class EvidenceNeed(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schemaVersion: Literal["1.0.0"]
    id: str
    questionId: str
    claimClass: str
    description: str
    mandatory: bool
    contradictionSearch: bool
    status: Literal["open", "satisfied", "blocked", "waived"]

class FrontierTask(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class EntityCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class ResolutionDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class RelationshipStatement(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schemaVersion: Literal["1.0.0"]
    id: str
    subjectEntityId: str
    predicate: Literal["served_as", "located_at", "succeeded", "challenged_law", "participated_in", "funded_by", "founded", "member_of", "published", "occurred_at"]
    objectEntityId: str
    qualifiers: ClaimQualifiers
    evidenceAssignmentIds: list[str]
    status: Literal["proposed", "accepted", "rejected", "superseded", "retracted"]

class ResearchRun(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class AgentActivity(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class ModelInvocation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class InvalidModelOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schemaVersion: Literal["1.0.0"]
    id: str
    invocationId: str
    rawOutput: str
    validationErrors: list[str]
    quarantinedAt: str
    retentionUntil: str

class Artifact(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class ReviewDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class ReleaseDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class SentenceCitation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    sentenceId: str
    sentenceText: str
    factual: bool
    claimVersionIds: list[str]
    evidenceAssignmentIds: list[str]

class VerificationReport(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    factualSentenceCount: int
    supportedFactualSentenceCount: int
    distinctLineageChecked: bool
    rightsChecked: bool
    entityLinksChecked: bool
    legalStatusChecked: bool
    plagiarismChecked: bool
    styleChecked: bool
    blockingFindings: list[str]

class StoryResearchPacket(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

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

class RoCrateExport(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schemaVersion: Literal["1.0.0"]
    conformsTo: Literal["https://w3id.org/ro/crate/1.1"]
    crateId: str
    createdAt: str
    profile: ResearchProfile
    entities: list[dict[str, Any]]
    activities: list[AgentActivity]
    artifacts: list[Artifact]
    checksums: dict[str, str]

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

CONTRACT_MODEL_NAMES = ("Budget", "RiskClassPolicy", "SourceFitnessRule", "ModelPolicy", "RetentionPolicy", "PublicationPolicy", "StoppingPolicy", "ResearchProfile", "SourcePolicy", "SourceItem", "Capture", "EvidenceSelector", "ClaimQualifiers", "ConfidenceAssessment", "ClaimStatement", "EvidenceAssignment", "ResearchCase", "ResearchQuestion", "Hypothesis", "EvidenceNeed", "FrontierTask", "EntityCandidate", "ResolutionDecision", "RelationshipStatement", "ResearchRun", "AgentActivity", "ModelInvocation", "InvalidModelOutput", "Artifact", "ReviewDecision", "ReleaseDecision", "SentenceCitation", "VerificationReport", "StoryResearchPacket", "RoCrateExport",)

