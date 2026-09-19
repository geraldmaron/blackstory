/**
 * One decade panel: count sight, regime, frame, class shares, conditions, rules.
 * World beats render beside this panel in the timeline.
 */
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
  readonly disclaimer: string;
  readonly labelledBy?: string;
  readonly id?: string;
};

export function LivesDecadePanel({
  decade,
  emphasis,
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
      {decade.decade >= 2010 ? (
        <aside className="lives-panel__definition-note" aria-label="How these groups overlap">
          <strong>These are not three slices of one population.</strong> Homeownership counts Black
          or African American alone, including Black Hispanic households. The Hispanic figure
          includes people of any race. The white figure excludes Hispanic households. These figures
          overlap and do not add to 100. Population share on this panel uses a separate table whose
          displayed groups do partition.
        </aside>
      ) : null}
      <LivesClassSharesChart decade={decade} emphasis={emphasis} />
      <LivesConditionsChart decade={decade} emphasis={emphasis} />
      <LivesRulesInForce decade={decade} emphasis={emphasis} disclaimer={disclaimer} />
    </section>
  );
}
