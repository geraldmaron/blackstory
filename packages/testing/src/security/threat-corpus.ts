/**
 * threat corpus loader and validators for security test scaffolds.
 * Reads docs/security/threat-corpus.json and asserts acceptance criteria.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
  implementationBeads: string[];
  controls: ThreatControls;
  residualRisk: string;
  assets?: string[];
  actors?: string[];
}

export interface ThreatCorpus {
  version: string;
  bead: '';
  threats: ThreatRecord[];
}

/** Expected threat IDs from the execution PDF (order fixed). */
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

/** Validate corpus shape: quadrants, P0→, residual risk, 1:1 abuse ids. */
export function validateThreatCorpus(corpus: ThreatCorpus): CorpusValidationIssue[] {
  const issues: CorpusValidationIssue[] = [];

  if (corpus.bead !== '') {
    issues.push({
      code: 'bead',
      message: `expected bead, got ${String(corpus.bead)}`,
    });
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

    if (!threat.implementationBeads?.length) {
      issues.push({
        code: 'beads',
        message: `${threat.id} must map to one or more implementation beads`,
      });
    } else {
      for (const bead of threat.implementationBeads) {
        if (!/^BB-\d{3}$/.test(bead)) {
          issues.push({
            code: 'bead-format',
            message: `${threat.id} has invalid bead id ${bead}`,
          });
        }
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
