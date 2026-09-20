import Link from 'next/link';
import React from 'react';
import { LIVES_LENS_LABELS, type LivesLens, type LivesRule } from '@repo/domain/statistics/lives';
import { formatInForceYears } from '../../lib/lives/lives-format';

void React;

export const LIVES_RULE_POSTURE_LABEL: Readonly<Record<LivesRule['textPosture'], string>> = {
  exclusionary: 'Its text restricted people by race or origin.',
  protective: 'Its text barred discrimination.',
  facially_neutral: 'Its text did not name race.',
};

export type LivesRuleCardProps = {
  readonly rule: LivesRule;
  /** The appendix's reading lens. When set, the card says which groups the rule applied to. */
  readonly emphasis?: LivesLens;
};

/**
 * One rule, described. Shared by the reader and the evidence appendix so a law never reads one way
 * on one surface and another way on the other.
 *
 * "What it did" is the catalog record's own summary. "What followed" is the record's cited impact
 * statement, and it renders only when the record carries one: consequence claims live on the law's
 * record under that record's citation gate, never beside a measured gap
 * (docs/methodology/juxtaposition-not-causation.md).
 */
export function LivesRuleCard({ rule, emphasis }: LivesRuleCardProps) {
  return (
    <li
      className="lives-rule"
      data-applies={emphasis ? rule.appliesTo.includes(emphasis) : undefined}
    >
      <p className="lives-rule__name">
        {rule.href ? <Link href={rule.href}>{rule.name}</Link> : rule.name}
      </p>
      <p className="lives-rule__meta">
        {rule.jurisdictionLabel} · {formatInForceYears(rule.inForceFromYear, rule.inForceToYear)}
      </p>
      {rule.description ? (
        <div className="lives-rule__part">
          <p className="lives-rule__label">What it did</p>
          <p>{rule.description}</p>
        </div>
      ) : null}
      <p className="lives-rule__applies">
        {emphasis
          ? `Applied to: ${rule.appliesTo.map((lens) => LIVES_LENS_LABELS[lens]).join(', ')}. `
          : null}
        {LIVES_RULE_POSTURE_LABEL[rule.textPosture]}
      </p>
      {rule.groupsNamed.length > 0 ? (
        <p className="lives-rule__named">
          Named in its text: {rule.groupsNamed.map((name) => `“${name}”`).join(', ')}
        </p>
      ) : null}
      {rule.summary ? (
        <div className="lives-rule__part">
          <p className="lives-rule__label">What followed</p>
          <p className="lives-rule__summary">{rule.summary}</p>
        </div>
      ) : null}
      {rule.disputed ? (
        <p className="lives-rule__dispute">
          Scholars disagree about how this rule affected people by race.
        </p>
      ) : null}
    </li>
  );
}
