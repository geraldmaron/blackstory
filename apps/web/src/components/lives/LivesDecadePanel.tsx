/**
 * One decade panel: count sight, regime, frame, class shares, conditions, rules.
 * World beats render beside this panel in the timeline.
 */
import React from 'react';
import type { LivesDecadeBundle, LivesLens, LivesUnit } from '@repo/domain/statistics/lives';
import { LivesClassSharesChart } from './LivesClassSharesChart';
import { LivesConditionsChart } from './LivesConditionsChart';
import { LivesCountSight } from './LivesCountSight';
import { LivesRegimeNotice } from './LivesRegimeNotice';
import { LivesRulesInForce } from './LivesRulesInForce';

void React;

export type LivesDecadePanelProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
  readonly tier: 'all' | 'lower' | 'middle' | 'upper';
  readonly unit?: LivesUnit;
  readonly disclaimer: string;
  readonly labelledBy?: string;
  readonly id?: string;
};

export function LivesDecadePanel({
  decade,
  emphasis,
  tier,
  unit = 'household',
  disclaimer,
  labelledBy,
  id,
}: LivesDecadePanelProps) {
  return (
    <section
      {...(id ? { id } : {})}
      {...(labelledBy ? { role: 'tabpanel', 'aria-labelledby': labelledBy } : {})}
      className="lives-panel"
      data-unit={unit}
    >
      <h2 className="lives-panel__title">The {decade.label}</h2>
      <LivesCountSight decade={decade} />
      <LivesRegimeNotice decade={decade} />
      {decade.frame ? (
        <div className="lives-frame">
          <h3>{decade.frame.heading}</h3>
          {decade.frame.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}
      {unit === 'child' ? (
        <p className="lives-panel__unit-note">
          Class and income bands are household or worker measures. They are shown as context for the
          child unit, not as a child&apos;s wage.
        </p>
      ) : null}
      {unit === 'woman' ? (
        <p className="lives-panel__unit-note">
          Homeownership and household income are household measures. They are not labeled as her
          ownership or wage. Work and schooling layers carry the woman unit.
        </p>
      ) : null}
      <LivesClassSharesChart decade={decade} emphasis={emphasis} selectedTier={tier} />
      <LivesConditionsChart decade={decade} emphasis={emphasis} tierSelected={tier !== 'all'} />
      <LivesRulesInForce decade={decade} emphasis={emphasis} disclaimer={disclaimer} />
    </section>
  );
}
