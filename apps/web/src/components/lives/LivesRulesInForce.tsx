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
 * Laws and rulings that began in this decade: federal law, and each member state's own rules
 * labeled with the state. The shorter list keeps the reader oriented to change without implying
 * that a rule caused the measured conditions beside it.
 */
export function LivesRulesInForce({ decade, emphasis, disclaimer }: LivesRulesInForceProps) {
  const began = decade.rulesInForce.filter(
    (rule) => rule.inForceFromYear >= decade.decade && rule.inForceFromYear <= decade.decade + 9,
  );
  const applying = began.filter((rule) => rule.appliesTo.includes(emphasis));
  const others = began.filter((rule) => !rule.appliesTo.includes(emphasis));
  return (
    <section className="lives-rules" aria-labelledby="lives-rules-heading">
      <h3 id="lives-rules-heading">Rules that began in the {decade.label}</h3>
      {began.length === 0 ? (
        <p className="lives-rules__empty">
          No sourced rule in this catalog began in this area during the {decade.label}. Rules from
          earlier decades may still have been in force.
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
