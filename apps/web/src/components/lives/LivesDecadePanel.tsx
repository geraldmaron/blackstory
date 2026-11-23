/**
 * One decade, the result of the appendix's controls: how class was measured, what the count could
 * see, the frame, class shares, conditions, the rules that began, and the world
 * beats. Every block is optional; a decade shows only what it has.
 */
import React from 'react';
import type { LivesDecadeBundle, LivesLens } from '@repo/domain/statistics/lives';
import {
  LivesClassSharesFigure,
  LivesConditionsFigure,
  type LivesFigureFrame,
} from './LivesFigures';
import { LivesCountSight } from './LivesCountSight';
import { LivesRegimeNotice } from './LivesRegimeNotice';
import { LivesRulesInForce } from './LivesRulesInForce';
import { LivesWorldBeats } from './LivesWorldBeats';

void React;

export type LivesDecadePanelProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
  readonly disclaimer: string;
  readonly frame: LivesFigureFrame;
  readonly id?: string;
};

export function LivesDecadePanel({
  decade,
  emphasis,
  disclaimer,
  frame,
  id,
}: LivesDecadePanelProps) {
  return (
    <section
      {...(id ? { id } : {})}
      className="lives-panel"
      aria-labelledby={`lives-panel-title-${decade.decade}`}
    >
      <header className="lives-panel__head">
        <h2 className="lives-panel__title" id={`lives-panel-title-${decade.decade}`}>
          The {decade.label}
        </h2>
        <LivesRegimeNotice decade={decade} />
      </header>
      <LivesCountSight decade={decade} />
      {decade.frame ? (
        <div className="lives-frame">
          <h3 className="lives-frame__title">{decade.frame.heading}</h3>
          {decade.frame.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}
      {decade.decade >= 2010 ? (
        <p className="lives-note" role="note">
          <strong>These are not three slices of one population.</strong> Homeownership counts Black
          or African American alone, including Black Hispanic households. The Hispanic figure
          includes people of any race. The white figure excludes Hispanic households. These figures
          overlap and do not add to 100. Population share on this panel uses a separate table whose
          displayed groups do partition.
        </p>
      ) : null}
      <LivesClassSharesFigure decade={decade} emphasis={emphasis} frame={frame} />
      <LivesConditionsFigure decade={decade} emphasis={emphasis} frame={frame} />
      <LivesRulesInForce decade={decade} emphasis={emphasis} disclaimer={disclaimer} />
      <LivesWorldBeats decade={decade.decade} beats={decade.worldBeats} emphasis={emphasis} />
    </section>
  );
}
