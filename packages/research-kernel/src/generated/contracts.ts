/**
 * GENERATED from schemas/research-kernel.v1.schema.json.
 * Run pnpm --filter @repo/research-kernel generate; do not edit by hand.
 */

export interface Budget {
  readonly queries: number;
  readonly candidateUrls: number;
  readonly fullCaptures: number;
  readonly relationshipHops: number;
  readonly durationMinutes: number;
  readonly paidModelUsd: number;
}

export interface RiskClassPolicy {
  readonly id: string;
  readonly description: string;
  readonly budgetClass: 'standard' | 'highImpact';
  readonly escalationTriggers: readonly string[];
}

export interface SourceFitnessRule {
  readonly sourceClass: string;
  readonly claimClass: string;
  readonly fitness: 'authoritative' | 'strong' | 'conditional' | 'leadOnly' | 'unfit';
  readonly limitations: readonly string[];
}

export interface ModelPolicy {
  readonly mode:
    | 'deterministic'
    | 'local-triage'
    | 'free-batch'
    | 'paid-research'
    | 'quality-prose'
    | 'independent-review'
    | 'trusted-session';
  readonly modelIds: readonly string[];
  readonly authority: readonly string[];
  readonly requiresBenchmark: boolean;
  readonly mayApprove: boolean;
}

export interface RetentionPolicy {
  readonly acceptedProvenanceDays: number | null;
  readonly searchCacheDays: number;
  readonly failedModelPayloadDays: number;
  readonly deadLetterDraftDays: number;
  readonly holdExemptions: readonly ('case' | 'audit' | 'rights' | 'legal')[];
}

export interface PublicationPolicy {
  readonly automaticPublicPromotion: boolean;
  readonly requireDistinctActor: boolean;
  readonly requireDistinctModelFamily: boolean;
  readonly claimPrecisionLowerBound: number;
  readonly highImpactPrecisionLowerBound: number;
  readonly entityFalseMergeUpperBound: number;
  readonly confidenceEceMaximum: number;
  readonly unsupportedSentenceRateMaximum: number;
}

export interface StoppingPolicy {
  readonly frontierScoreThreshold: number;
  readonly consecutiveTasksBelowThreshold: number;
  readonly requireMandatoryNeedsComplete: boolean;
  readonly requireContradictionSearch: boolean;
  readonly escalationTriggers: readonly string[];
}

export interface ResearchProfile {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly scope: Readonly<Record<string, unknown>>;
  readonly vocabulary: Readonly<Record<string, readonly string[]>>;
  readonly sensitivityRules: readonly string[];
  readonly sourceFitness: readonly SourceFitnessRule[];
  readonly queryPacks: Readonly<Record<string, readonly string[]>>;
  readonly riskClasses: readonly RiskClassPolicy[];
  readonly budgets: { readonly standard: Budget; readonly highImpact: Budget };
  readonly modelPolicies: readonly ModelPolicy[];
  readonly retention: RetentionPolicy;
  readonly publication: PublicationPolicy;
  readonly stopping: StoppingPolicy;
}

export interface SourcePolicy {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly version: string;
  readonly displayName: string;
  readonly sourceClass: string;
  readonly rights: Readonly<Record<string, unknown>>;
  readonly retrieval: Readonly<Record<string, unknown>>;
  readonly claimFitness: readonly SourceFitnessRule[];
}

export interface SourceItem {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly sourcePolicyId: string;
  readonly stableIdentifier: string;
  readonly canonicalUrl: string | null;
  readonly title: string | null;
  readonly publishedAt: string | null;
  readonly upstreamSourceIds: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Capture {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly sourceItemId: string;
  readonly capturedAt: string;
  readonly contentHashAlgorithm: 'sha256' | 'sha512';
  readonly contentHashDigest: string;
  readonly mediaType: string;
  readonly storageUri: string;
  readonly parserVersion: string | null;
  readonly rightsStatus: 'open' | 'licensed' | 'restricted' | 'unknown' | 'prohibited';
  readonly dedupOfCaptureId?: string | null;
}

export interface EvidenceSelector {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly captureId: string;
  readonly selectorType:
    | 'TextQuoteSelector'
    | 'TextPositionSelector'
    | 'FragmentSelector'
    | 'PageSelector'
    | 'TimeSelector';
  readonly conformsTo: string;
  readonly exact: string | null;
  readonly prefix: string | null;
  readonly suffix: string | null;
  readonly start?: number | null;
  readonly end?: number | null;
  readonly page?: number | null;
  readonly timeStartSeconds?: number | null;
  readonly timeEndSeconds?: number | null;
  readonly fragment?: string | null;
}

export interface ClaimQualifiers {
  readonly temporal: Readonly<Record<string, unknown>>;
  readonly geographic: Readonly<Record<string, unknown>>;
  readonly jurisdictional: Readonly<Record<string, unknown>>;
  readonly procedural: Readonly<Record<string, unknown>>;
  readonly uncertainty: Readonly<Record<string, unknown>>;
}

export interface ConfidenceAssessment {
  readonly acceptanceProbability: number;
  readonly intervalLow: number;
  readonly intervalHigh: number;
  readonly sourceReliability: number;
  readonly entailment: number;
  readonly independence: number;
  readonly identityConfidence: number;
  readonly relevance: number;
  readonly researchCompleteness: number;
  readonly calibrationVersion: string;
}

export interface ClaimStatement {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly version: number;
  readonly subjectEntityId: string;
  readonly predicate: string;
  readonly object: Readonly<Record<string, unknown>>;
  readonly claimClass: 'standard' | 'highImpact' | 'legal' | 'sensitive' | 'livingPerson';
  readonly qualifiers: ClaimQualifiers;
  readonly status:
    'proposed' | 'accepted' | 'rejected' | 'superseded' | 'corrected' | 'retracted' | 'deleted';
  readonly supersedesClaimVersionId: string | null;
  readonly confidence?: ConfidenceAssessment | null;
}

export interface EvidenceAssignment {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly claimVersionId: string;
  readonly selectorId: string;
  readonly role: 'supporting' | 'contradicting' | 'contextual' | 'leadOnly';
  readonly fitness: 'authoritative' | 'strong' | 'conditional' | 'leadOnly' | 'unfit';
  readonly entailmentProbability: number;
  readonly lineageClusterId: string;
  readonly derivedFromAssignmentId: string | null;
  readonly reviewerActorId: string | null;
  readonly status: 'proposed' | 'accepted' | 'rejected' | 'superseded';
}

export interface ResearchCase {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly profileId: string;
  readonly title: string;
  readonly riskClass: string;
  readonly status: 'open' | 'escalated' | 'stopped' | 'completed' | 'cancelled';
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface ResearchQuestion {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly caseId: string;
  readonly question: string;
  readonly priority: number;
  readonly status: 'open' | 'answered' | 'deferred' | 'cancelled';
}

export interface Hypothesis {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly questionId: string;
  readonly statement: string;
  readonly status: 'open' | 'supported' | 'contradicted' | 'mixed' | 'rejected';
}

export interface EvidenceNeed {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly questionId: string;
  readonly claimClass: string;
  readonly description: string;
  readonly mandatory: boolean;
  readonly contradictionSearch: boolean;
  readonly status: 'open' | 'satisfied' | 'blocked' | 'waived';
}

export interface FrontierTask {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly caseId: string;
  readonly taskType:
    | 'query'
    | 'capture'
    | 'extract'
    | 'verify'
    | 'resolveEntity'
    | 'expandRelationship'
    | 'contradictionSearch'
    | 'rightsReview';
  readonly targetId: string | null;
  readonly riskWeight: number;
  readonly expectedEntropyReduction: number;
  readonly sourceNovelty: number;
  readonly contradictionValue: number;
  readonly normalizedCost: number;
  readonly score: number;
  readonly hop: number;
  readonly status: 'pending' | 'leased' | 'completed' | 'failed' | 'deadLetter' | 'cancelled';
}

export interface EntityCandidate {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly mention: string;
  readonly entityKind: string;
  readonly normalizedNames: readonly string[];
  readonly identifiers: Readonly<Record<string, string>>;
  readonly jurisdictions: readonly string[];
  readonly activeFrom: string | null;
  readonly activeTo: string | null;
  readonly blockingKeys: readonly string[];
  readonly sourceSelectorId: string;
}

export interface ResolutionDecision {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly candidateId: string;
  readonly entityId: string | null;
  readonly decision: 'match' | 'noMatch' | 'defer' | 'reject';
  readonly matchProbability: number;
  readonly hardStopReasons: readonly (
    | 'trustedIdentifierConflict'
    | 'impossibleLifespan'
    | 'incompatibleKind'
    | 'exclusiveGeographyTime'
  )[];
  readonly clusterConsistent: boolean;
  readonly reversible: true;
  readonly modelVersion: string;
  readonly reviewerActorId: string | null;
}

export interface RelationshipStatement {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly subjectEntityId: string;
  readonly predicate:
    | 'served_as'
    | 'located_at'
    | 'succeeded'
    | 'challenged_law'
    | 'participated_in'
    | 'funded_by'
    | 'founded'
    | 'member_of'
    | 'published'
    | 'occurred_at';
  readonly objectEntityId: string;
  readonly qualifiers: ClaimQualifiers;
  readonly evidenceAssignmentIds: readonly string[];
  readonly status: 'proposed' | 'accepted' | 'rejected' | 'superseded' | 'retracted';
}

export interface ResearchRun {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly caseId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly policyVersion: string;
  readonly mode:
    | 'deterministic'
    | 'local-triage'
    | 'free-batch'
    | 'paid-research'
    | 'quality-prose'
    | 'independent-review'
    | 'trusted-session';
  readonly status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'escalated';
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly costUsd: number;
  readonly counts: Readonly<Record<string, number>>;
  readonly terminalReason: string | null;
}

export interface AgentActivity {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly runId: string;
  readonly provType: 'prov:Activity';
  readonly actorId: string;
  readonly actorType: 'human' | 'model' | 'service' | 'trustedSession';
  readonly modelFamily: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly usedArtifactIds: readonly string[];
  readonly generatedArtifactIds: readonly string[];
  readonly wasAssociatedWith: string;
}

export interface ModelInvocation {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly activityId: string;
  readonly provider: 'openrouter' | 'ollama' | 'openai' | 'anthropic' | 'other';
  readonly modelId: string;
  readonly modelFamily: string;
  readonly providerRoute: Readonly<Record<string, unknown>>;
  readonly priceSnapshot: Readonly<Record<string, unknown>>;
  readonly promptHash: string;
  readonly outputSchemaId: string;
  readonly outputSchemaVersion: string;
  readonly benchmarkVersion: string;
  readonly rawResponse: string;
  readonly status: 'pending' | 'valid' | 'invalid' | 'failed';
  readonly repairOfInvocationId: string | null;
}

export interface InvalidModelOutput {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly invocationId: string;
  readonly rawOutput: string;
  readonly validationErrors: readonly string[];
  readonly quarantinedAt: string;
  readonly retentionUntil: string;
}

export interface Artifact {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly runId: string;
  readonly activityId: string;
  readonly artifactType: string;
  readonly contentHash: string;
  readonly schemaId: string;
  readonly schemaVersionUsed: string;
  readonly storageUri: string;
  readonly status: 'proposed' | 'accepted' | 'rejected' | 'quarantined' | 'superseded';
  readonly createdAt: string;
}

export interface ReviewDecision {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly artifactId: string;
  readonly decision: 'approve' | 'reject' | 'requestChanges';
  readonly reviewerActorId: string;
  readonly reviewerModelFamily: string | null;
  readonly producerActorId: string;
  readonly producerModelFamily: string | null;
  readonly findings: readonly Readonly<Record<string, unknown>>[];
  readonly decidedAt: string;
}

export interface ReleaseDecision {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly artifactId: string;
  readonly releaseId: string;
  readonly decision: 'stage' | 'activate' | 'rollback' | 'block';
  readonly reviewDecisionId: string;
  readonly publisherActorId: string;
  readonly producerActorId: string;
  readonly policyVersion: string;
  readonly decidedAt: string;
}

export interface SentenceCitation {
  readonly sentenceId: string;
  readonly sentenceText: string;
  readonly factual: boolean;
  readonly claimVersionIds: readonly string[];
  readonly evidenceAssignmentIds: readonly string[];
}

export interface VerificationReport {
  readonly factualSentenceCount: number;
  readonly supportedFactualSentenceCount: number;
  readonly distinctLineageChecked: boolean;
  readonly rightsChecked: boolean;
  readonly entityLinksChecked: boolean;
  readonly legalStatusChecked: boolean;
  readonly plagiarismChecked: boolean;
  readonly styleChecked: boolean;
  readonly blockingFindings: readonly string[];
}

export interface StoryResearchPacket {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly caseId: string;
  readonly title: string;
  readonly acceptedClaimVersionIds: readonly string[];
  readonly sentenceCitations: readonly SentenceCitation[];
  readonly relatedRelationshipIds: readonly string[];
  readonly proseDraftArtifactId: string;
  readonly verificationReport: VerificationReport;
  readonly producerActivityId: string;
  readonly reviewDecisionIds: readonly string[];
  readonly approvalLineageComplete: boolean;
  readonly status:
    | 'draft'
    | 'auditReady'
    | 'awaitingApproval'
    | 'approved'
    | 'rejected'
    | 'released'
    | 'retracted';
}

export interface RoCrateExport {
  readonly schemaVersion: '1.0.0';
  readonly conformsTo: 'https://w3id.org/ro/crate/1.1';
  readonly crateId: string;
  readonly createdAt: string;
  readonly profile: ResearchProfile;
  readonly entities: readonly Readonly<Record<string, unknown>>[];
  readonly activities: readonly AgentActivity[];
  readonly artifacts: readonly Artifact[];
  readonly checksums: Readonly<Record<string, string>>;
}

export interface ResearchContractMap {
  readonly Budget: Budget;
  readonly RiskClassPolicy: RiskClassPolicy;
  readonly SourceFitnessRule: SourceFitnessRule;
  readonly ModelPolicy: ModelPolicy;
  readonly RetentionPolicy: RetentionPolicy;
  readonly PublicationPolicy: PublicationPolicy;
  readonly StoppingPolicy: StoppingPolicy;
  readonly ResearchProfile: ResearchProfile;
  readonly SourcePolicy: SourcePolicy;
  readonly SourceItem: SourceItem;
  readonly Capture: Capture;
  readonly EvidenceSelector: EvidenceSelector;
  readonly ClaimQualifiers: ClaimQualifiers;
  readonly ConfidenceAssessment: ConfidenceAssessment;
  readonly ClaimStatement: ClaimStatement;
  readonly EvidenceAssignment: EvidenceAssignment;
  readonly ResearchCase: ResearchCase;
  readonly ResearchQuestion: ResearchQuestion;
  readonly Hypothesis: Hypothesis;
  readonly EvidenceNeed: EvidenceNeed;
  readonly FrontierTask: FrontierTask;
  readonly EntityCandidate: EntityCandidate;
  readonly ResolutionDecision: ResolutionDecision;
  readonly RelationshipStatement: RelationshipStatement;
  readonly ResearchRun: ResearchRun;
  readonly AgentActivity: AgentActivity;
  readonly ModelInvocation: ModelInvocation;
  readonly InvalidModelOutput: InvalidModelOutput;
  readonly Artifact: Artifact;
  readonly ReviewDecision: ReviewDecision;
  readonly ReleaseDecision: ReleaseDecision;
  readonly SentenceCitation: SentenceCitation;
  readonly VerificationReport: VerificationReport;
  readonly StoryResearchPacket: StoryResearchPacket;
  readonly RoCrateExport: RoCrateExport;
}

export type ResearchContractName = keyof ResearchContractMap;
