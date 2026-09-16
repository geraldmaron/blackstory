/**
 * Accessibility violations this repo currently ships, recorded so the lane can be green without
 * lying about them.
 *
 * These are not exclusions and not false positives. Each entry is a real, reproducible axe
 * finding in a real component, left in place only because fixing it is a separate change from
 * standing the lane up. Read this file as the open accessibility bug list; a short file is the
 * goal and a growing one is a problem.
 *
 * Rules of the register:
 *
 * - An entry suppresses exactly one rule id, on exactly the audited subjects it names. Anything
 *   else the same component violates still fails the lane.
 * - An entry whose violation has been fixed makes its test FAIL, with a message telling you to
 *   delete the entry. The register cannot rot into a list of things that used to be wrong.
 * - Adding an entry is how you record a bug you are not fixing today. It is not how you make a
 *   red lane green — say so in the pull request when you add one.
 */

import type { AxeViolation } from './axe-harness.ts';

export type KnownFinding = {
  /** Audited case names this finding covers, matched exactly against the test's subject. */
  readonly subjects: readonly string[];
  readonly ruleId: string;
  /** What is wrong, in the markup, in one line. */
  readonly problem: string;
  /** What a fix looks like. Written now, while the finding is understood. */
  readonly remedy: string;
  /** ISO date the finding was recorded. */
  readonly recorded: string;
};

export const KNOWN_COMPONENT_FINDINGS: readonly KnownFinding[] = Object.freeze([
  {
    subjects: ['FacetRail', 'records index'],
    ruleId: 'aria-allowed-attr',
    problem:
      'packages/ui/src/components/FacetRail.tsx renders each facet option as <a href> carrying aria-pressed. The link role does not support aria-pressed, so a screen reader announces no on/off state at all — the active facet is conveyed by class name and color only.',
    remedy:
      'Either swap aria-pressed for aria-current="true" on the active option (it is a navigation link, and aria-current is what links use), or make the option a real toggle button inside a form. aria-current is the smaller change and matches SynchronizedResultList, which already uses it.',
    recorded: '2026-09-13',
  },
]);

export type PartitionedViolations = {
  /** Violations with no entry in the register. These fail the lane. */
  readonly unexpected: readonly AxeViolation[];
  /** Rule ids that matched a register entry for this subject. */
  readonly matchedKnown: ReadonlySet<string>;
};

/** Splits a subject's violations into the ones already on the register and the ones that are new. */
export function partitionViolations(
  subject: string,
  violations: readonly AxeViolation[],
  register: readonly KnownFinding[] = KNOWN_COMPONENT_FINDINGS,
): PartitionedViolations {
  const known = new Set(
    register.filter((finding) => finding.subjects.includes(subject)).map((finding) => finding.ruleId),
  );
  const matchedKnown = new Set<string>();
  const unexpected: AxeViolation[] = [];

  for (const violation of violations) {
    if (known.has(violation.id)) {
      matchedKnown.add(violation.id);
      continue;
    }
    unexpected.push(violation);
  }

  return Object.freeze({
    unexpected: Object.freeze(unexpected),
    matchedKnown,
  });
}
