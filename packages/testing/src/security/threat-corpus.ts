/**
 * Threat corpus loader and validator.
 * Reads docs/security/threat-corpus.json and verifies its structural and repository references.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTROL_QUADRANTS = ['preventive', 'detective', 'containment', 'recovery'] as const;

export type ControlQuadrant = (typeof CONTROL_QUADRANTS)[number];

export interface ThreatControls {
  preventive: string[];
  detective: string[];
  containment: string[];
  recovery: string[];
}

export interface ThreatRecord {
  id: string;
  name: string;
  priority: 'P0';
  abuseCaseIds: string[];
  implementationRefs: string[];
  controls: ThreatControls;
  residualRisk: string;
  assets?: string[];
  actors?: string[];
}

export interface ThreatCorpus {
  version: string;
  updatedAt: string;
  assumptionsRef: string;
  architectureRefs: string[];
  threats: ThreatRecord[];
}

/** Stable threat IDs, in corpus order. */
export const REQUIRED_THREAT_IDS = [
  'T-01',
  'T-02',
  'T-03',
  'T-04',
  'T-05',
  'T-06',
  'T-07',
  'T-08',
  'T-09',
  'T-10',
  'T-11',
  'T-12',
  'T-13',
  'T-14',
  'T-15',
  'T-16',
  'T-17',
  'T-18',
  'T-19',
] as const;

export const REQUIRED_ABUSE_CASE_IDS = [
  'AC-01',
  'AC-02',
  'AC-03',
  'AC-04',
  'AC-05',
  'AC-06',
  'AC-07',
  'AC-08',
  'AC-09',
  'AC-10',
  'AC-11',
  'AC-12',
  'AC-13',
  'AC-14',
  'AC-15',
  'AC-16',
  'AC-17',
  'AC-18',
  'AC-19',
] as const;

function repoRootFromHere(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // packages/testing/src/security → repo root
  return join(here, '..', '..', '..', '..');
}

/** Resolve path to docs/security/threat-corpus.json from this package. */
export function threatCorpusPath(root = repoRootFromHere()): string {
  return join(root, 'docs', 'security', 'threat-corpus.json');
}

export function loadThreatCorpus(root = repoRootFromHere()): ThreatCorpus {
  const raw = readFileSync(threatCorpusPath(root), 'utf8');
  return JSON.parse(raw) as ThreatCorpus;
}

export interface CorpusValidationIssue {
  code: string;
  message: string;
}

function validateRepositoryRef(
  owner: string,
  repositoryRef: string,
  root: string,
  issues: CorpusValidationIssue[],
): void {
  const rootPath = resolve(root);
  const resolvedRef = resolve(rootPath, repositoryRef);
  const escapesRoot = resolvedRef !== rootPath && !resolvedRef.startsWith(`${rootPath}${sep}`);
  if (!repositoryRef.trim() || isAbsolute(repositoryRef) || escapesRoot) {
    issues.push({
      code: 'reference-path',
      message: `${owner} has invalid repository reference ${repositoryRef}`,
    });
    return;
  }
  if (!existsSync(resolvedRef)) {
    issues.push({
      code: 'missing-reference',
      message: `${owner} references missing path ${repositoryRef}`,
    });
  }
}

/** Validate quadrants, priority, repository references, residual risk, and 1:1 abuse IDs. */
export function validateThreatCorpus(
  corpus: ThreatCorpus,
  root = repoRootFromHere(),
): CorpusValidationIssue[] {
  const issues: CorpusValidationIssue[] = [];

  validateRepositoryRef('assumptionsRef', corpus.assumptionsRef, root, issues);
  if (!corpus.architectureRefs?.length) {
    issues.push({
      code: 'architecture-refs',
      message: 'corpus must list one or more architectureRefs',
    });
  } else {
    for (const architectureRef of corpus.architectureRefs) {
      validateRepositoryRef('architectureRefs', architectureRef, root, issues);
    }
  }

  if (corpus.threats.length !== REQUIRED_THREAT_IDS.length) {
    issues.push({
      code: 'count',
      message: `expected ${REQUIRED_THREAT_IDS.length} threats, got ${corpus.threats.length}`,
    });
  }

  const seenIds = new Set<string>();
  const seenAbuse = new Set<string>();

  for (const expectedId of REQUIRED_THREAT_IDS) {
    const threat = corpus.threats.find((t) => t.id === expectedId);
    if (!threat) {
      issues.push({
        code: 'missing-threat',
        message: `missing required threat ${expectedId}`,
      });
      continue;
    }

    if (seenIds.has(threat.id)) {
      issues.push({
        code: 'duplicate-threat',
        message: `duplicate threat id ${threat.id}`,
      });
    }
    seenIds.add(threat.id);

    if (threat.priority !== 'P0') {
      issues.push({
        code: 'priority',
        message: `${threat.id} must be P0`,
      });
    }

    if (!threat.residualRisk?.trim()) {
      issues.push({
        code: 'residual',
        message: `${threat.id} missing residualRisk`,
      });
    }

    if (!threat.implementationRefs?.length) {
      issues.push({
        code: 'implementation-refs',
        message: `${threat.id} must map to one or more implementationRefs`,
      });
    } else {
      for (const implementationRef of threat.implementationRefs) {
        validateRepositoryRef(threat.id, implementationRef, root, issues);
      }
    }

    for (const quadrant of CONTROL_QUADRANTS) {
      const controls = threat.controls?.[quadrant];
      if (!Array.isArray(controls) || controls.length === 0) {
        issues.push({
          code: 'controls',
          message: `${threat.id} missing non-empty ${quadrant} controls`,
        });
      }
    }

    if (!threat.abuseCaseIds?.length) {
      issues.push({
        code: 'abuse',
        message: `${threat.id} missing abuseCaseIds`,
      });
    } else {
      for (const ac of threat.abuseCaseIds) {
        if (seenAbuse.has(ac)) {
          issues.push({
            code: 'duplicate-abuse',
            message: `duplicate abuse case ${ac}`,
          });
        }
        seenAbuse.add(ac);
      }
    }
  }

  for (const expectedAc of REQUIRED_ABUSE_CASE_IDS) {
    if (!seenAbuse.has(expectedAc)) {
      issues.push({
        code: 'missing-abuse',
        message: `missing required abuse case ${expectedAc}`,
      });
    }
  }

  return issues;
}

export { CONTROL_QUADRANTS };
