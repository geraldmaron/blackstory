/**
 * Sourced world beats for one Lives decade. Incomplete domains stay out of the public surface;
 * explicit historical absences belong in authored milestone panels, not generic gap cards.
 */
import React from 'react';
import Link from 'next/link';
import {
  LIVES_WORLD_DOMAIN_LABELS,
  livesWorldMediationLine,
  selectLivesWorldBeats,
  type LivesDecade,
  type LivesLens,
  type LivesWorldBeat,
} from '@repo/domain/statistics/lives';
import { JUXTAPOSITION_DISCLAIMER } from '@repo/domain/statistics/lives';

void React;

export type LivesWorldBeatsProps = {
  readonly decade: LivesDecade;
  readonly beats: readonly LivesWorldBeat[];
  readonly emphasis: LivesLens;
};

export function LivesWorldBeats({ decade, beats, emphasis }: LivesWorldBeatsProps) {
  const { beats: matched } = selectLivesWorldBeats({
    beats,
    decade,
    unit: 'all',
    emphasis,
  });

  if (matched.length === 0) return null;

  return (
    <section className="lives-world" aria-label="Decade world">
      <h3 className="lives-world__title">What else the archive opens</h3>
      <p className="lives-world__disclaimer">{JUXTAPOSITION_DISCLAIMER}</p>
      <ul className="lives-world__list">
        {matched.map((beat) => (
          <li key={beat.id} className="lives-world__beat" data-claim={beat.claimType}>
            <p className="lives-world__domain">{LIVES_WORLD_DOMAIN_LABELS[beat.domain]}</p>
            <h4 className="lives-world__heading">{beat.heading}</h4>
            {beat.speaker ? (
              <p className="lives-world__speaker">
                {beat.speaker.name}
                {beat.speakerPlaceMismatch ? ' (speaking from outside this region)' : ''},{' '}
                {beat.speaker.place}, {beat.speaker.year}
                {beat.speaker.classNote ? ` · ${beat.speaker.classNote}` : ''}
                {' · '}
                {livesWorldMediationLine(beat.speaker)}
              </p>
            ) : null}
            <p className="lives-world__body">{beat.body}</p>
            {beat.uncertaintyLabel ? (
              <p className="lives-world__uncertainty">{beat.uncertaintyLabel}</p>
            ) : null}
            {beat.gapState ? (
              <p className="lives-world__gap-state">Labeled {beat.gapState.replace('_', ' ')}</p>
            ) : null}
            {beat.citations.length > 0 ? (
              <ul className="lives-world__citations">
                {beat.citations.map((citation) => (
                  <li key={citation.url}>
                    <a href={citation.url} rel="noopener noreferrer">
                      {citation.label}
                    </a>
                    {citation.archiveUrl ? (
                      <>
                        {' '}
                        ·{' '}
                        <a href={citation.archiveUrl} rel="noopener noreferrer">
                          Archived copy
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {beat.entities.some((entity) => entity.href) ? (
              <ul className="lives-world__entities">
                {beat.entities
                  .filter((entity) => entity.href)
                  .map((entity) => (
                    <li key={entity.id}>
                      <Link href={entity.href!}>{entity.label}</Link>
                    </li>
                  ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
