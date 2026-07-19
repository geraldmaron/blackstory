/**
 * Homepage About beat — product thesis and three pillars, with quiet paths into
 * the map, the full /about page, and zero-permission state orientation.
 */

import React from 'react';
import Link from 'next/link';
import { StateStart, type StateStartEntry, type StateStartProps } from './StateStart';

void React;

export type HomeAboutProps = {
  /** States with pinned records, ordered by record count descending (top slice). */
  readonly topStates: readonly StateStartEntry[];
  /** Override for tests — defaults to the live StateStart client control. */
  readonly OrientControl?: React.ComponentType<StateStartProps>;
};

const PILLARS = [
  {
    kicker: 'Presence',
    title: 'Pinned to place',
    body: 'People, schools, institutions, and events stay on the ground — not a trauma-first feed, and not a remote museum shelf.',
  },
  {
    kicker: 'Evidence',
    title: 'Receipts on every claim',
    body: 'Accepted claims carry citations and confidence you can read. When sources disagree, both stay visible.',
  },
  {
    kicker: 'Dignity',
    title: 'Rules, not tone',
    body: 'Street-level residences stay off the public map. Living people stay protected. Presence is never framed as deficit.',
  },
] as const;

export function HomeAbout({ topStates, OrientControl = StateStart }: HomeAboutProps) {
  return (
    <section
      className="ds-section ds-section--flush ds-home-about"
      aria-labelledby="home-about-heading"
    >
      <p className="ds-section__kicker">About</p>
      <h2 className="ds-section__title" id="home-about-heading">
        History, pinned to place.
      </h2>
      <p className="ds-section__lede">
        BlackStory is a place-connected Black history research platform. Documented history stays
        findable — especially the history close to you — with people, places, evidence, and context
        traveling together.
      </p>

      <ul className="ds-home-about__pillars">
        {PILLARS.map((pillar) => (
          <li key={pillar.kicker} className="ds-home-about__pillar">
            <p className="ds-home-about__pillar-kicker">{pillar.kicker}</p>
            <h3 className="ds-home-about__pillar-title">{pillar.title}</h3>
            <p className="ds-home-about__pillar-body">{pillar.body}</p>
          </li>
        ))}
      </ul>

      <p className="ds-home-about__actions">
        <Link className="ds-cta ds-cta--copper" href="/explore">
          Explore the map
        </Link>
        <Link className="ds-cta ds-cta--quiet" href="/about">
          Read the full story
        </Link>
        <Link className="ds-cta ds-cta--quiet" href="/methodology">
          Methodology
        </Link>
      </p>

      <div className="ds-home-about__orient">
        <p className="ds-home-about__orient-lede">
          Prefer to start with a place you know? Pick a state — zero permission — or share your
          location only if you choose.
        </p>
        <OrientControl topStates={topStates} />
      </div>
    </section>
  );
}
