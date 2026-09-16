import React from 'react';
import type { LivesDecadeBundle, LivesLens } from '@repo/domain/statistics/lives';
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
  readonly disclaimer: string;
  /** Tab id labelling this panel when it sits under the decade rail. */
  readonly labelledBy?: string;
  readonly id?: string;
};

/**
 * One decade: a diagram of what the count could see, the class-share stacks, condition bars, the
 * frame, and the rules in force. Numbers stay behind every chart. Server-safe, so the static
 * render and the interactive timeline draw the same panel.
 */
export function LivesDecadePanel({
  decade,
  emphasis,
  tier,
  disclaimer,
  labelledBy,
  id,
}: LivesDecadePanelProps) {
  return (
    <section
      {...(id ? { id } : {})}
      {...(labelledBy ? { role: 'tabpanel', 'aria-labelledby': labelledBy } : {})}
      className="lives-panel"
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
      <LivesClassSharesChart decade={decade} emphasis={emphasis} selectedTier={tier} />
      <LivesConditionsChart decade={decade} emphasis={emphasis} tierSelected={tier !== 'all'} />
      <LivesRulesInForce decade={decade} emphasis={emphasis} disclaimer={disclaimer} />
    </section>
  );
}
