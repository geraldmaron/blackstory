/**
 * Homepage beat 01: Your Place — dense state select, coverage strip, and entry micro-facts.
 */

import React from 'react';
import { EditionFactIcon } from '../patterns/EditionFactIcon';
import type { EntryStepKey } from '../patterns/edition-fact-icon';
import { HomeEditionHeader } from './HomeEditionHeader';
import { StateStart, type StateStartEntry, type StateStartProps } from './StateStart';

void React;

const ENTRY_FACTS: ReadonlyArray<{
  readonly label: string;
  readonly step: EntryStepKey;
  readonly value: string;
}> = [
  {
    label: 'Pin',
    step: 'pin',
    value:
      'Every public record anchors to a mappable place. Precision is shown, never overstated.',
  },
  {
    label: 'Browse',
    step: 'browse',
    value:
      'State and corridor views group records by where they happened, not by abstract theme alone.',
  },
  {
    label: 'Source',
    step: 'source',
    value:
      'Each entry carries citations and a confidence grade you can read before you trust the claim.',
  },
];

export type HomeAboutProps = {
  readonly topStates: readonly StateStartEntry[];
  readonly OrientControl?: React.ComponentType<StateStartProps>;
};

export function HomeAbout({ topStates, OrientControl = StateStart }: HomeAboutProps) {
  const Control = OrientControl;

  return (
    <section className="ds-home-edition__beat" id="beat-a" aria-labelledby="home-place-heading">
      <HomeEditionHeader
        index="01"
        kicker="Your place"
        title="Enter through geography."
        lede="Choose a state, use your location, or open a deep-coverage corridor. Every path lands on a place-first browse, not a category wall."
        id="home-place-heading"
      />

      <div className="ds-home-edition__place-entry">
        <Control topStates={topStates} />

        <aside className="ds-home-edition__entry-facts" aria-label="How place entry works">
          <p className="ds-home-edition__entry-facts-heading">How entry works</p>
          {ENTRY_FACTS.map((fact) => (
            <div key={fact.label} className="ds-home-edition__entry-fact">
              <span className="ds-home-edition__entry-fact-label">
                <EditionFactIcon variant="entry" step={fact.step} />
                <span>{fact.label}</span>
              </span>
              <p className="ds-home-edition__entry-fact-value">{fact.value}</p>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
