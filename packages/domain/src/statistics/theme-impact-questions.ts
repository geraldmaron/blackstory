/**
 * Theme-impact canonical questions and metric bindings.
 *
 * Product vocabulary for the reusable theme-impact system: which questions we
 * answer, which Phase 1 / proposed metrics bind to them, and which artifact
 * lanes support timelines. Does not approve ingestion — registry sources stay
 * disabled until separate beads open them.
 */
import {
  PHASE1_INDICATOR_CATALOG,
  type Phase1IndicatorDefinition,
} from './phase1-indicator-catalog.js';

export const THEME_IMPACT_THEME_IDS = [
  'redlining',
  'drug_policy_state',
  'urban_renewal',
  'mass_incarceration',
  'environmental_racism',
  'cross_cutting',
] as const;

export type ThemeImpactThemeId = (typeof THEME_IMPACT_THEME_IDS)[number];

export const THEME_IMPACT_PRIORITIES = ['P0', 'P1', 'meta'] as const;
export type ThemeImpactPriority = (typeof THEME_IMPACT_PRIORITIES)[number];

export const REDLINING_POLICY_ERAS = [
  'holc_fha',
  'fair_housing',
  'cra_contemporary',
] as const;

export type RedliningPolicyEra = (typeof REDLINING_POLICY_ERAS)[number];

export const DRUG_POLICY_ERAS = [
  'pre_drug_war',
  'drug_war_escalation',
  'crack_cocaine_era',
  'sentencing_reform',
] as const;

export type DrugPolicyEra = (typeof DRUG_POLICY_ERAS)[number];

export type ThemeImpactAnswerShape =
  | 'artifact_timeline'
  | 'geography'
  | 'era_indicators'
  | 'place_narrative'
  | 'methodology_gate';

export type ThemeImpactMetricBinding =
  | {
      readonly kind: 'phase1';
      readonly metricId: string;
    }
  | {
      readonly kind: 'proposed';
      readonly metricId: string;
      readonly sourceFamily: string;
    }
  | {
      readonly kind: 'derived';
      readonly methodId: string;
    };

export type ThemeImpactArtifactClass =
  | 'primary_government_document'
  | 'cartographic_grade_map'
  | 'peer_reviewed_synthesis'
  | 'investigative_foia_package'
  | 'scholarly_partner_table';

export type ThemeImpactQuestion = {
  readonly id: string;
  readonly themeId: ThemeImpactThemeId;
  readonly priority: ThemeImpactPriority;
  readonly question: string;
  readonly answerShape: ThemeImpactAnswerShape;
  readonly policyEraFamily: 'redlining' | 'drug_policy' | 'none';
  readonly metricBindings: readonly ThemeImpactMetricBinding[];
  readonly artifactClasses: readonly ThemeImpactArtifactClass[];
};

/** v1 allowlisted source families for theme-impact work (ingestion still gated). */
export const THEME_IMPACT_V1_SOURCE_ALLOWLIST = [
  'mapping-inequality-holc',
  'acs-census-api',
  'us-census-historical-race-1790-1990',
  'hmda-loan-level',
  'bjs-national-prisoner-statistics',
  'vera-incarceration-trends',
  'fed-survey-consumer-finances',
  'census-sipp-wealth',
  'primary-government-documents',
  'peer-reviewed-syntheses',
] as const;

export type ThemeImpactV1SourceId = (typeof THEME_IMPACT_V1_SOURCE_ALLOWLIST)[number];

export const THEME_IMPACT_QUESTIONS: readonly ThemeImpactQuestion[] = [
  {
    id: 'Q1',
    themeId: 'redlining',
    priority: 'P0',
    question: 'How did federal and local redlining practices come about?',
    answerShape: 'artifact_timeline',
    policyEraFamily: 'redlining',
    metricBindings: [],
    artifactClasses: [
      'primary_government_document',
      'peer_reviewed_synthesis',
      'cartographic_grade_map',
    ],
  },
  {
    id: 'Q2',
    themeId: 'redlining',
    priority: 'P0',
    question: 'Where was HOLC grading applied, and how were Black neighborhoods graded?',
    answerShape: 'geography',
    policyEraFamily: 'redlining',
    metricBindings: [
      {
        kind: 'proposed',
        metricId: 'holc-grade-area-share-city',
        sourceFamily: 'mapping-inequality-holc',
      },
      {
        kind: 'proposed',
        metricId: 'holc-black-pop-share-by-grade',
        sourceFamily: 'mapping-inequality-holc',
      },
    ],
    artifactClasses: ['cartographic_grade_map', 'primary_government_document'],
  },
  {
    id: 'Q3',
    themeId: 'redlining',
    priority: 'P0',
    question:
      'Across housing-credit policy eras, how did Black homeownership, income, poverty, and wealth change in places with redlining history?',
    answerShape: 'era_indicators',
    policyEraFamily: 'redlining',
    metricBindings: [
      { kind: 'phase1', metricId: 'acs-homeownership-rate-black-county' },
      { kind: 'phase1', metricId: 'acs-median-hh-income-black-county' },
      { kind: 'phase1', metricId: 'acs-median-hh-income-white-county' },
      { kind: 'phase1', metricId: 'acs-poverty-rate-black-county' },
      { kind: 'phase1', metricId: 'acs-black-population-share-county' },
      { kind: 'phase1', metricId: 'scf-median-wealth-black-nation' },
      { kind: 'phase1', metricId: 'scf-median-wealth-white-nation' },
      { kind: 'phase1', metricId: 'sipp-median-wealth-black-nation' },
      { kind: 'phase1', metricId: 'eviction-filing-rate-county' },
      {
        kind: 'proposed',
        metricId: 'hmda-denial-rate-black-county',
        sourceFamily: 'hmda-loan-level',
      },
      { kind: 'derived', methodId: 'black_white_income_gap' },
      { kind: 'derived', methodId: 'era_delta' },
      { kind: 'derived', methodId: 'holc_d_vs_a_homeownership_delta' },
    ],
    artifactClasses: ['peer_reviewed_synthesis'],
  },
  {
    id: 'Q4',
    themeId: 'redlining',
    priority: 'P0',
    question:
      'For a specific formerly graded place, what followed for the people who lived there?',
    answerShape: 'place_narrative',
    policyEraFamily: 'redlining',
    metricBindings: [
      { kind: 'phase1', metricId: 'acs-homeownership-rate-black-county' },
      { kind: 'phase1', metricId: 'acs-median-hh-income-black-county' },
      { kind: 'phase1', metricId: 'acs-poverty-rate-black-county' },
      { kind: 'phase1', metricId: 'acs-black-population-share-county' },
      { kind: 'phase1', metricId: 'acs-ba-attainment-black-county' },
      { kind: 'phase1', metricId: 'eviction-filing-rate-county' },
      {
        kind: 'proposed',
        metricId: 'holc-grade-area-share-city',
        sourceFamily: 'mapping-inequality-holc',
      },
    ],
    artifactClasses: [
      'cartographic_grade_map',
      'primary_government_document',
      'peer_reviewed_synthesis',
    ],
  },
  {
    id: 'Q5',
    themeId: 'drug_policy_state',
    priority: 'P0',
    question:
      'What documented government actions and artifacts describe state involvement in drug markets or drug-war enforcement affecting Black communities?',
    answerShape: 'artifact_timeline',
    policyEraFamily: 'drug_policy',
    metricBindings: [],
    artifactClasses: [
      'primary_government_document',
      'investigative_foia_package',
      'peer_reviewed_synthesis',
      'scholarly_partner_table',
    ],
  },
  {
    id: 'Q6',
    themeId: 'drug_policy_state',
    priority: 'P0',
    question:
      'Across drug-policy eras, how did Black imprisonment / jail rates and related justice indicators change?',
    answerShape: 'era_indicators',
    policyEraFamily: 'drug_policy',
    metricBindings: [
      { kind: 'phase1', metricId: 'imprisonment-rate-black-state' },
      { kind: 'phase1', metricId: 'imprisonment-rate-white-state' },
      { kind: 'phase1', metricId: 'vera-jail-population-rate-county' },
      { kind: 'phase1', metricId: 'oa-incarceration-outcome-black-tract' },
      { kind: 'derived', methodId: 'black_white_imprisonment_ratio' },
      { kind: 'derived', methodId: 'era_delta' },
    ],
    artifactClasses: ['peer_reviewed_synthesis', 'primary_government_document'],
  },
  {
    id: 'Q7',
    themeId: 'urban_renewal',
    priority: 'P1',
    question:
      'Where were major urban renewal / displacement projects, and what demographic change followed in affected places?',
    answerShape: 'era_indicators',
    policyEraFamily: 'none',
    metricBindings: [
      { kind: 'phase1', metricId: 'acs-black-population-share-county' },
      { kind: 'phase1', metricId: 'acs-homeownership-rate-black-county' },
      { kind: 'phase1', metricId: 'eviction-filing-rate-county' },
    ],
    artifactClasses: ['primary_government_document', 'peer_reviewed_synthesis'],
  },
  {
    id: 'Q8',
    themeId: 'mass_incarceration',
    priority: 'P1',
    question: 'How did Black adult imprisonment rates change by state across modern justice eras?',
    answerShape: 'era_indicators',
    policyEraFamily: 'drug_policy',
    metricBindings: [
      { kind: 'phase1', metricId: 'imprisonment-rate-black-state' },
      { kind: 'phase1', metricId: 'imprisonment-rate-white-state' },
      { kind: 'phase1', metricId: 'vera-jail-population-rate-county' },
      { kind: 'derived', methodId: 'black_white_imprisonment_ratio' },
      { kind: 'derived', methodId: 'era_delta' },
    ],
    artifactClasses: ['peer_reviewed_synthesis'],
  },
  {
    id: 'Q9',
    themeId: 'environmental_racism',
    priority: 'P1',
    question:
      'How do environmental burden indicators concentrate relative to Black population share?',
    answerShape: 'era_indicators',
    policyEraFamily: 'none',
    metricBindings: [
      { kind: 'phase1', metricId: 'acs-black-population-share-county' },
      {
        kind: 'proposed',
        metricId: 'cdc-eji-tract',
        sourceFamily: 'cdc-eji',
      },
      {
        kind: 'proposed',
        metricId: 'epa-tri-facility-count-county',
        sourceFamily: 'epa-tri',
      },
    ],
    artifactClasses: ['peer_reviewed_synthesis', 'primary_government_document'],
  },
  {
    id: 'Q10',
    themeId: 'cross_cutting',
    priority: 'meta',
    question: 'When is “impact” language allowed in the product?',
    answerShape: 'methodology_gate',
    policyEraFamily: 'none',
    metricBindings: [],
    artifactClasses: [],
  },
];

const phase1Ids = new Set(PHASE1_INDICATOR_CATALOG.map((row) => row.metricId));

export function getThemeImpactQuestion(id: string): ThemeImpactQuestion | undefined {
  return THEME_IMPACT_QUESTIONS.find((row) => row.id === id);
}

export function listThemeImpactQuestionsByTheme(
  themeId: ThemeImpactThemeId,
): readonly ThemeImpactQuestion[] {
  return THEME_IMPACT_QUESTIONS.filter((row) => row.themeId === themeId);
}

export function listThemeImpactQuestionsByPriority(
  priority: ThemeImpactPriority,
): readonly ThemeImpactQuestion[] {
  return THEME_IMPACT_QUESTIONS.filter((row) => row.priority === priority);
}

/** Phase 1 definitions referenced by theme-impact questions (invalid ids omitted). */
export function resolvePhase1BindingsForQuestion(
  questionId: string,
): readonly Phase1IndicatorDefinition[] {
  const question = getThemeImpactQuestion(questionId);
  if (!question) return [];
  const out: Phase1IndicatorDefinition[] = [];
  for (const binding of question.metricBindings) {
    if (binding.kind !== 'phase1') continue;
    const series = PHASE1_INDICATOR_CATALOG.find((row) => row.metricId === binding.metricId);
    if (series) out.push(series);
  }
  return out;
}

export function assertThemeImpactPhase1BindingsValid(): void {
  for (const question of THEME_IMPACT_QUESTIONS) {
    for (const binding of question.metricBindings) {
      if (binding.kind === 'phase1' && !phase1Ids.has(binding.metricId)) {
        throw new Error(
          `Theme-impact ${question.id} references unknown Phase 1 metric ${binding.metricId}`,
        );
      }
    }
  }
}

export type ThemeImpactCatalogSummary = {
  readonly questionCount: number;
  readonly p0Count: number;
  readonly themes: readonly ThemeImpactThemeId[];
  readonly questions: readonly {
    readonly id: string;
    readonly themeId: ThemeImpactThemeId;
    readonly priority: ThemeImpactPriority;
    readonly answerShape: ThemeImpactAnswerShape;
    readonly phase1MetricCount: number;
    readonly proposedMetricCount: number;
    readonly derivedMethodCount: number;
  }[];
};

export function summarizeThemeImpactCatalog(): ThemeImpactCatalogSummary {
  const themes = [...new Set(THEME_IMPACT_QUESTIONS.map((row) => row.themeId))];
  return {
    questionCount: THEME_IMPACT_QUESTIONS.length,
    p0Count: THEME_IMPACT_QUESTIONS.filter((row) => row.priority === 'P0').length,
    themes,
    questions: THEME_IMPACT_QUESTIONS.map((row) => ({
      id: row.id,
      themeId: row.themeId,
      priority: row.priority,
      answerShape: row.answerShape,
      phase1MetricCount: row.metricBindings.filter((b) => b.kind === 'phase1').length,
      proposedMetricCount: row.metricBindings.filter((b) => b.kind === 'proposed').length,
      derivedMethodCount: row.metricBindings.filter((b) => b.kind === 'derived').length,
    })),
  };
}
