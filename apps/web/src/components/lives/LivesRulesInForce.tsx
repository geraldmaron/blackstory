import React from 'react';
import type { LivesDecadeBundle, LivesLens } from '@repo/domain/statistics/lives';
import { LivesRuleCard } from './LivesRuleCard';

void React;

export type LivesRulesInForceProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
  readonly disclaimer: string;
};

/**
 * Laws and rulings that began in this decade: federal law, and each member state's own rules
 * labeled with the state, the ones that applied to the emphasized group first. The shorter list
 * keeps the reader oriented to change without implying that a rule caused the measured conditions
 * beside it.
 */
export function LivesRulesInForce({ decade, emphasis, disclaimer }: LivesRulesInForceProps) {
  const began = decade.rulesInForce.filter(
    (rule) => rule.inForceFromYear >= decade.decade && rule.inForceFromYear <= decade.decade + 9,
  );
  const applying = began.filter((rule) => rule.appliesTo.includes(emphasis));
  const others = began.filter((rule) => !rule.appliesTo.includes(emphasis));
  const headingId = `lives-rules-heading-${decade.decade}`;
  return (
    <section className="lives-rules" aria-labelledby={headingId}>
      <h3 className="lives-rules__title" id={headingId}>
        Rules that began in the {decade.label}
      </h3>
      {began.length === 0 ? (
        <p className="lives-rules__empty">
          No sourced rule in this catalog began in this area during the {decade.label}. Rules from
          earlier decades may still have been in force.
        </p>
      ) : (
        <ul className="lives-rules__list">
          {[...applying, ...others].map((rule) => (
            <LivesRuleCard key={rule.id} rule={rule} emphasis={emphasis} />
          ))}
        </ul>
      )}
      <p className="lives-rules__disclaimer">{disclaimer}</p>
    </section>
  );
}
