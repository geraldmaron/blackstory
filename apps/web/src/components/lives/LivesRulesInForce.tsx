import Link from 'next/link';
import React from 'react';
import {
  LIVES_LENS_LABELS,
  type LivesDecadeBundle,
  type LivesLens,
  type LivesRule,
} from '@repo/domain/statistics/lives';
import { formatInForceYears } from '../../lib/lives/lives-format';

void React;

const POSTURE_LABEL: Readonly<Record<LivesRule['textPosture'], string>> = {
  exclusionary: 'Its text restricted people by race or origin.',
  protective: 'Its text barred discrimination.',
  facially_neutral: 'Its text did not name race.',
};

export type LivesRulesInForceProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
  readonly disclaimer: string;
};

/**
 * Laws and rulings in force for this area and decade: federal law, and each member state's own rules
 * labeled with the state. Shown beside the measured conditions, never as their cause; the fixed
 * disclaimer always renders, even when no rule is listed.
 */
export function LivesRulesInForce({ decade, emphasis, disclaimer }: LivesRulesInForceProps) {
  const applying = decade.rulesInForce.filter((rule) => rule.appliesTo.includes(emphasis));
  const others = decade.rulesInForce.filter((rule) => !rule.appliesTo.includes(emphasis));
  return (
    <section className="lives-rules" aria-labelledby="lives-rules-heading">
      <h3 id="lives-rules-heading">Rules in force in the {decade.label}</h3>
      {decade.rulesInForce.length === 0 ? (
        <p className="lives-rules__empty">
          No sourced rules are recorded for this area and decade yet.
        </p>
      ) : (
        <ul className="lives-rules__list">
          {[...applying, ...others].map((rule) => (
            <li
              key={rule.id}
              className="lives-rule"
              data-applies={rule.appliesTo.includes(emphasis)}
            >
              <p className="lives-rule__name">
                {rule.href ? <Link href={rule.href}>{rule.name}</Link> : rule.name}
              </p>
              <p className="lives-rule__meta">
                {rule.jurisdictionLabel} ·{' '}
                {formatInForceYears(rule.inForceFromYear, rule.inForceToYear)}
              </p>
              <p className="lives-rule__applies">
                Applied to: {rule.appliesTo.map((lens) => LIVES_LENS_LABELS[lens]).join(', ')}.{' '}
                {POSTURE_LABEL[rule.textPosture]}
              </p>
              {rule.groupsNamed.length > 0 ? (
                <p className="lives-rule__named">
                  Named in its text: {rule.groupsNamed.map((name) => `“${name}”`).join(', ')}
                </p>
              ) : null}
              {rule.disputed ? (
                <p className="lives-rule__dispute">
                  Scholars disagree about how this rule affected people by race.
                </p>
              ) : null}
              {rule.summary ? <p className="lives-rule__summary">{rule.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="lives-rules__disclaimer">{disclaimer}</p>
    </section>
  );
}
