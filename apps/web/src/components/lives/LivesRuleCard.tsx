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
  /** The appendix's reading lens. When set, the row says which groups the rule applied to. */
  readonly emphasis?: LivesLens;
};

/**
 * One rule as a one-line row (name, level, year) that opens in place. Shared by the reader and the
 * evidence appendix so a law never reads one way on one surface and another way on the other.
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
      <details className="lives-rule__row">
        <summary className="lives-rule__head">
          <span className="lives-rule__name">{rule.name}</span>
          <span className="lives-rule__meta">
            {rule.jurisdictionLabel} ·{' '}
            {formatInForceYears(rule.inForceFromYear, rule.inForceToYear)}
          </span>
          <svg className="lives-rule__chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="lives-rule__body">
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
              <p className="lives-rule__followed">{rule.summary}</p>
            </div>
          ) : null}
          {rule.disputed ? (
            <p className="lives-rule__dispute">
              Scholars disagree about how this rule affected people by race.
            </p>
          ) : null}
          {rule.href ? (
            <Link className="lives-rule__link" href={rule.href}>
              Open the record
            </Link>
          ) : null}
        </div>
      </details>
    </li>
  );
}
