
/**
 * adversarial integrity harness composes quarantine, promotion,
 * confidence/lineage, research-case workflow, and correction quarantine
 * without network I/O or live endpoint attacks.
 */
import type {
  AdversarialIntegrityScenarioId,
  AdversarialScenarioRunResult,
  IntegrityControlProof,
} from './types.js';

export type AdversarialHarnessStep = {
  readonly attackBlocked: boolean;
  readonly publicContentMutated?: boolean;
  readonly controls: readonly IntegrityControlProof[];
  readonly lineageInflationPrevented?: boolean;
  readonly publicLanguageConstrained?: boolean;
};

export function summarizeAdversarialScenario(
  scenarioId: AdversarialIntegrityScenarioId,
  steps: readonly AdversarialHarnessStep[],
): AdversarialScenarioRunResult {
  const controlsTriggered: IntegrityControlProof[] = [];
  let attackBlocked = true;
  let publicContentMutated = false;
  let lineageInflationPrevented: boolean | undefined;
  let publicLanguageConstrained: boolean | undefined;

  for (const step of steps) {
    if (!step.attackBlocked) {
      attackBlocked = false;
    }
    if (step.publicContentMutated) {
      publicContentMutated = true;
    }
    controlsTriggered.push(...step.controls);
    if (step.lineageInflationPrevented !== undefined) {
      lineageInflationPrevented = step.lineageInflationPrevented;
    }
    if (step.publicLanguageConstrained !== undefined) {
      publicLanguageConstrained = step.publicLanguageConstrained;
    }
  }

  const uniqueControls = dedupeControls(controlsTriggered);

  return {
    scenarioId,
    stepsExecuted: steps.length,
    attackBlocked,
    publicContentMutated,
    controlsTriggered: uniqueControls,
    ...(lineageInflationPrevented !== undefined ? { lineageInflationPrevented } : {}),
    ...(publicLanguageConstrained !== undefined ? { publicLanguageConstrained } : {}),
  };
}

function dedupeControls(controls: readonly IntegrityControlProof[]): readonly IntegrityControlProof[] {
  const seen = new Set<string>();
  const out: IntegrityControlProof[] = [];
  for (const control of controls) {
    const key = `${control.layer}\u0000${control.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(control);
  }
  return Object.freeze(out);
}

export function provePublicContentIsolation(result: AdversarialScenarioRunResult): boolean {
  return !result.publicContentMutated;
}

export function proveLineageVolumeDefense(result: AdversarialScenarioRunResult): boolean {
  if (result.lineageInflationPrevented === undefined) return true;
  return result.lineageInflationPrevented;
}

export function provePublicLanguageDefense(result: AdversarialScenarioRunResult): boolean {
  if (result.publicLanguageConstrained === undefined) return true;
  return result.publicLanguageConstrained;
}

export const DOCUMENTED_CONTROL_GAPS: readonly {
  readonly scenarioId: AdversarialIntegrityScenarioId;
  readonly beadId: string;
  readonly summary: string;
}[] = Object.freeze([]);
