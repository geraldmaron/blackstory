import React from 'react';
import type {
  LivesDecadeBundle,
  LivesGroupSlice,
  LivesTierKey,
} from '@repo/domain/statistics/lives';
import { LivesClassSharesTable } from './LivesClassSharesTable';
import { LivesConditionsTable } from './LivesConditionsTable';
import { LivesRegimeNotice } from './LivesRegimeNotice';
import { LivesRulesInForce } from './LivesRulesInForce';

void React;

export type LivesDecadePanelProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesGroupSlice;
  readonly tier: LivesTierKey;
  readonly disclaimer: string;
  /** Tab id labelling this panel when it sits under the decade rail. */
  readonly labelledBy?: string;
  readonly id?: string;
};

/**
 * One decade: what class means in it, its narrative frame, class shares, conditions and the rules
 * in force. Server-safe, so the static render and the interactive timeline draw the same panel.
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
      <LivesRegimeNotice decade={decade} />
      {decade.frame ? (
        <div className="lives-frame">
          <h3>{decade.frame.heading}</h3>
          {decade.frame.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}
      <div className="lives-table-scroll">
        <LivesClassSharesTable decade={decade} emphasis={emphasis} selectedTier={tier} />
      </div>
      <div className="lives-table-scroll">
        <LivesConditionsTable decade={decade} emphasis={emphasis} tier={tier} />
      </div>
      <LivesRulesInForce decade={decade} emphasis={emphasis} disclaimer={disclaimer} />
    </section>
  );
}
