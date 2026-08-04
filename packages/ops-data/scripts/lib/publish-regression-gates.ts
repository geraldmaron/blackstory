/**
 * Publish regression gate suite: McGhie-class fixtures, law self-demise warnings,
 * status vocabulary renderability, and graph invariants.
 */
import { deriveCatalogEntityStatus } from '@repo/domain';
import {
  lintPublishStatus,
  mergePublishStatusLintReports,
  type PublishStatusLintReport,
} from './publish-status-linter.ts';

/** Status tokens that must render without faCircle fallback (mirrors apps/web status-icons). */
export const RENDERABLE_STATUS_TOKENS = [
  'active',
  'historic',
  'inactive',
  'living',
  'deceased',
  'presumed_deceased',
  'unknown',
  'in_force',
  'amended',
  'repealed',
  'struck_down',
  'enjoined',
] as const;

export type PublishRegressionFinding = {
  readonly code: string;
  readonly severity: 'error' | 'warn';
  readonly message: string;
  readonly entityId?: string;
};

export type PublishRegressionReport = {
  readonly findings: readonly PublishRegressionFinding[];
  readonly hasErrors: boolean;
  readonly hasWarnings: boolean;
};

export const MCGHIE_CLASS_FIXTURE = {
  entityId: 'lynching_isaac_mcghie_duluth_minnesota',
  kind: 'person',
  summary: 'Isaac McGhie was lynched by a white mob in Duluth, Minnesota, in 1920.',
} as const;

export function runMcGhieClassRegression(): PublishRegressionFinding[] {
  const derived = deriveCatalogEntityStatus(MCGHIE_CLASS_FIXTURE);
  if (derived.livingStatus !== 'deceased' || derived.status !== 'deceased') {
    return [
      {
        code: 'mcghie_class_lexicon_regression',
        severity: 'error',
        entityId: MCGHIE_CLASS_FIXTURE.entityId,
        message: `McGhie-class fixture must derive deceased; got livingStatus=${derived.livingStatus ?? 'undefined'} status=${derived.status ?? 'undefined'}`,
      },
    ];
  }
  const lint = lintPublishStatus({
    entityId: MCGHIE_CLASS_FIXTURE.entityId,
    kind: 'person',
    summary: MCGHIE_CLASS_FIXTURE.summary,
    status: 'living',
  });
  if (!lint.hasErrors) {
    return [
      {
        code: 'mcghie_class_linter_regression',
        severity: 'error',
        entityId: MCGHIE_CLASS_FIXTURE.entityId,
        message:
          'McGhie-class linter must hard-fail when summary is deceased but status is living.',
      },
    ];
  }
  return [];
}

export function runLawSelfDemiseRegression(): PublishRegressionFinding[] {
  const lint = lintPublishStatus({
    entityId: 'ent-law-self-demise-fixture',
    kind: 'law',
    summary: 'A'.repeat(120) + ' The statute was struck down by the Supreme Court in 1971.',
    status: 'in_force',
  });
  if (!lint.hasWarnings) {
    return [
      {
        code: 'law_self_demise_linter_regression',
        severity: 'error',
        message:
          'Law self-demise linter must warn when summary describes struck-down but status is in_force.',
      },
    ];
  }
  return lint.findings.map((finding) => ({
    code: finding.code,
    severity: 'warn' as const,
    message: finding.message,
    entityId: finding.entityId,
  }));
}

export function lintStatusVocabulary(input: {
  readonly entityId: string;
  readonly status?: string;
  readonly livingStatus?: string;
}): PublishRegressionFinding[] {
  const findings: PublishRegressionFinding[] = [];
  const tokens = [input.status, input.livingStatus].filter(
    (token): token is string => typeof token === 'string' && token.length > 0,
  );
  for (const token of tokens) {
    if (!(RENDERABLE_STATUS_TOKENS as readonly string[]).includes(token)) {
      findings.push({
        code: 'unknown_status_token',
        severity: 'error',
        entityId: input.entityId,
        message: `Status token "${token}" is not in RENDERABLE_STATUS_TOKENS / STATUS_ICONS vocabulary.`,
      });
    }
  }
  return findings;
}

function nodeIdsWithDuplicateHub(nodeIds: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const id of nodeIds) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  return duplicates;
}

export function assertGraphInvariants(input: {
  readonly nodeIds: readonly string[];
  readonly edgeEndpointIds: readonly string[];
  readonly mergedAwayIds?: readonly string[];
}): PublishRegressionFinding[] {
  const findings: PublishRegressionFinding[] = [];
  const merged = new Set(input.mergedAwayIds ?? []);
  const duplicates = nodeIdsWithDuplicateHub(input.nodeIds);
  for (const entityId of duplicates) {
    findings.push({
      code: 'duplicate_hub_entity',
      severity: 'error',
      entityId,
      message: `Duplicate hub entity id "${entityId}" in graph node set.`,
    });
  }
  for (const endpointId of input.edgeEndpointIds) {
    if (merged.has(endpointId)) {
      findings.push({
        code: 'edge_references_merged_id',
        severity: 'error',
        message: `Edge references merged-away entity id "${endpointId}".`,
      });
    }
  }
  return findings;
}

export function runPublishRegressionGates(input?: {
  readonly projectionStatuses?: readonly {
    readonly entityId: string;
    readonly status?: string;
    readonly livingStatus?: string;
  }[];
  readonly graphNodeIds?: readonly string[];
  readonly graphEdgeEndpointIds?: readonly string[];
  readonly mergedAwayIds?: readonly string[];
  readonly statusLintReports?: readonly PublishStatusLintReport[];
}): PublishRegressionReport {
  const findings: PublishRegressionFinding[] = [
    ...runMcGhieClassRegression(),
    ...runLawSelfDemiseRegression(),
  ];

  for (const row of input?.projectionStatuses ?? []) {
    findings.push(...lintStatusVocabulary(row));
  }

  if (input?.graphNodeIds && input.graphEdgeEndpointIds) {
    findings.push(
      ...assertGraphInvariants({
        nodeIds: input.graphNodeIds,
        edgeEndpointIds: input.graphEdgeEndpointIds,
        ...(input.mergedAwayIds ? { mergedAwayIds: input.mergedAwayIds } : {}),
      }),
    );
  }

  if (input?.statusLintReports) {
    const merged = mergePublishStatusLintReports(input.statusLintReports);
    for (const finding of merged.findings.filter((entry) => entry.severity === 'error')) {
      findings.push({
        code: finding.code,
        severity: 'error',
        entityId: finding.entityId,
        message: finding.message,
      });
    }
  }

  return {
    findings,
    hasErrors: findings.some((finding) => finding.severity === 'error'),
    hasWarnings: findings.some((finding) => finding.severity === 'warn'),
  };
}

export function publishRegressionFailureMessage(report: PublishRegressionReport): string {
  const errors = report.findings.filter((finding) => finding.severity === 'error');
  const sample = errors
    .slice(0, 5)
    .map((finding) => `${finding.entityId ?? 'global'}: ${finding.message}`)
    .join('; ');
  return `Publish regression gates failed (${errors.length} error(s)): ${sample}`;
}
