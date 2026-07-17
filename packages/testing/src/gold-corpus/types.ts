
/**
 * Versioned contracts for gold-corpus adjudications, algorithm predictions, evaluation
 * records, and before/after reports.
 */
export const GOLD_CORPUS_SCHEMA_VERSION = 'gold-corpus.v1' as const;
export const GOLD_PREDICTIONS_SCHEMA_VERSION = 'gold-predictions.v1' as const;
export const GOLD_EVALUATION_SCHEMA_VERSION = 'gold-evaluation.v1' as const;

export type GoldCategory =
  | 'included_school'
  | 'excluded_school'
  | 'relevant_person'
  | 'irrelevant_person'
  | 'disputed_claim'
  | 'high_impact_claim'
  | 'sparse_record'
  | 'living_person'
  | 'private_residence'
  | 'sundown_town_candidate'
  | 'geographic_ambiguity'
  | 'source_lineage';

export type RelevanceLabel = 'include' | 'exclude' | 'supporting_context';
export type ClaimLabel = 'supported' | 'disputed' | 'unsupported' | 'not_applicable';
export type EntityResolutionLabel = 'match' | 'no_match' | 'review_required';

export type GoldCorpusExample = {
  readonly id: string;
  readonly title: string;
  readonly synthetic: true;
  readonly categories: readonly GoldCategory[];
  readonly subjectType: 'school' | 'person' | 'claim' | 'place' | 'source_lineage';
  readonly adjudication: {
    readonly relevance: RelevanceLabel;
    readonly publicationAllowed: boolean;
    readonly claim: ClaimLabel;
    readonly impact: 'standard' | 'high_impact';
    readonly citationEntailed: boolean;
    readonly confidenceOutcome: boolean;
    readonly entityResolution: EntityResolutionLabel;
    readonly expectedEntityId?: string;
    readonly rationale: string;
  };
  readonly context: {
    readonly recordCompleteness: 'sparse' | 'partial' | 'substantial';
    readonly livingPerson: boolean;
    readonly privateResidence: boolean;
    readonly geographicAmbiguity: boolean;
    readonly lineageRootIds: readonly string[];
  };
};

export type GoldCorpus = {
  readonly schemaVersion: typeof GOLD_CORPUS_SCHEMA_VERSION;
  readonly corpusVersion: string;
  readonly adjudicatedAt: string;
  readonly adjudicationProtocol: string;
  readonly examples: readonly GoldCorpusExample[];
};

export type GoldPrediction = {
  readonly exampleId: string;
  readonly relevance: RelevanceLabel;
  readonly publish: boolean;
  readonly confidence: number;
  readonly citationEntailed: boolean;
  readonly entityResolution: EntityResolutionLabel;
  readonly resolvedEntityId?: string;
};

export type GoldPredictions = {
  readonly schemaVersion: typeof GOLD_PREDICTIONS_SCHEMA_VERSION;
  readonly algorithmVersion: string;
  readonly corpusVersion: string;
  readonly generatedAt: string;
  readonly predictions: readonly GoldPrediction[];
};

export type BinaryMetrics = {
  readonly truePositive: number;
  readonly falsePositive: number;
  readonly trueNegative: number;
  readonly falseNegative: number;
  readonly precision: number;
  readonly recall: number;
};

export type CalibrationMetrics = {
  readonly brierScore: number;
  readonly expectedCalibrationError: number;
  readonly bins: readonly {
    readonly lowerBound: number;
    readonly upperBound: number;
    readonly count: number;
    readonly meanConfidence: number;
    readonly observedRate: number;
  }[];
};

export type CorpusMetrics = {
  readonly exampleCount: number;
  readonly relevance: BinaryMetrics;
  readonly publication: BinaryMetrics;
  readonly falsePublicationRate: number;
  readonly calibration: CalibrationMetrics;
  readonly citationEntailmentAccuracy: number;
  readonly entityResolutionAccuracy: number;
};

export type CorpusEvaluationRecord = {
  readonly schemaVersion: typeof GOLD_EVALUATION_SCHEMA_VERSION;
  readonly corpusVersion: string;
  readonly algorithmVersion: string;
  readonly evaluatedAt: string;
  readonly passed: boolean;
  readonly thresholds: CorpusMetricThresholds;
  readonly metrics: CorpusMetrics;
  readonly failures: readonly string[];
};

export type CorpusMetricThresholds = {
  readonly minimumPrecision: number;
  readonly minimumRecall: number;
  readonly maximumFalsePublicationRate: number;
  readonly maximumBrierScore: number;
  readonly maximumExpectedCalibrationError: number;
  readonly minimumCitationEntailmentAccuracy: number;
  readonly minimumEntityResolutionAccuracy: number;
};

export type BeforeAfterReport = {
  readonly schemaVersion: 'gold-before-after-report.v1';
  readonly corpusVersion: string;
  readonly generatedAt: string;
  readonly before: CorpusEvaluationRecord;
  readonly after: CorpusEvaluationRecord;
  readonly deltas: {
    readonly precision: number;
    readonly recall: number;
    readonly falsePublicationRate: number;
    readonly brierScore: number;
    readonly expectedCalibrationError: number;
    readonly citationEntailmentAccuracy: number;
    readonly entityResolutionAccuracy: number;
  };
  readonly regressions: readonly string[];
};
