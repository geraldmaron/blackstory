/**
 * Continuous theme journey: scene-led beats with ink-sketch visuals, inline
 * statute cards, and instruments in a side column.
 */

import React from 'react';
import Link from 'next/link';
import {
  listThemeImpactLinkedStatutes,
  listThemeImpactLinkedStatutesForQuestion,
  type ThemeImpactPacketView,
  type ThemeImpactPolicyEraView,
} from '@repo/domain';
import { LinkedProse } from '../entity/LinkedProse';
import { EntityLink } from '../entity/EntityLink';
import { ThemeImpactLinkedStatutes } from './ThemeImpactLinkedStatutes';
import { ThemeImpactPolicyEraTimeline } from './ThemeImpactPolicyEraTimeline';
import { ThemeJourneyVisual, themeJourneySceneForBeat } from './ThemeJourneyVisual';
import { listRelatedThemeThreads } from '../../lib/theme-impact/theme-related-threads';
import { pickThemeImpactArcInstruments } from '../../lib/theme-impact/storytelling-series';

export type ThemeImpactArcReadingProps = {
  readonly themeId: string;
  readonly packets: readonly ThemeImpactPacketView[];
  readonly headingId: string;
};

function uniqueEras(packets: readonly ThemeImpactPacketView[]) {
  const seen = new Set<string>();
  const eras: ThemeImpactPolicyEraView[] = [];
  for (const packet of packets) {
    for (const era of packet.policyEras) {
      if (seen.has(era.id)) continue;
      seen.add(era.id);
      eras.push(era);
    }
  }
  return eras;
}

export function ThemeImpactArcReading({
  themeId,
  packets,
  headingId,
}: ThemeImpactArcReadingProps) {
  const eras = uniqueEras(packets);
  const linkedStatutes = listThemeImpactLinkedStatutes(themeId);
  const instruments = pickThemeImpactArcInstruments(
    packets.flatMap((packet) => packet.observations),
  );
  const related = listRelatedThemeThreads(themeId);
  const hasGaps = packets.some((packet) => packet.gapStates.length > 0);
  const openingScene = themeJourneySceneForBeat(themeId, 'Q1');

  return (
    <section
      className="ds-theme-impact__arc"
      aria-labelledby={headingId}
      data-theme-arc={themeId}
    >
      {openingScene ? (
        <div className="ds-theme-impact__arc-opening">
          <p className="ds-mono ds-theme-impact__arc-opening-kicker">You are here</p>
          <p className="ds-theme-impact__arc-opening-lede">
            Start where the color line became physical: {openingScene.person}, {openingScene.role},{' '}
            {openingScene.place}, {openingScene.year}. The beats below walk policy, practice, lived
            place, measurement, and what the record still cannot close.
          </p>
        </div>
      ) : null}

      <div className="ds-theme-impact__arc-layout">
        <div className="ds-theme-impact__arc-prose">
          <ol className="ds-theme-impact__arc-beats">
            {packets.map((packet, index) => {
              const scene = themeJourneySceneForBeat(themeId, packet.questionId);
              const beatStatutes = listThemeImpactLinkedStatutesForQuestion(
                themeId,
                packet.questionId,
              );
              const visualHeadingId = `${headingId}-visual-${packet.questionId}`;

              return (
                <li key={packet.questionId} className="ds-theme-impact__arc-beat">
                  {scene ? (
                    <ThemeJourneyVisual
                      questionId={packet.questionId}
                      scene={scene}
                      headingId={visualHeadingId}
                    />
                  ) : null}
                  <p className="ds-mono ds-theme-impact__arc-beat-index">
                    {String(index + 1).padStart(2, '0')} · {packet.geography.label}
                  </p>
                  <h3 className="ds-theme-impact__arc-beat-title">{packet.question}</h3>
                  <LinkedProse
                    className="ds-theme-impact__arc-beat-body"
                    text={packet.observationsSummary || packet.methodNote}
                  />
                  {beatStatutes.length > 0 ? (
                    <ul
                      className="ds-theme-impact__arc-beat-statutes"
                      aria-label={`Laws on beat ${packet.questionId}`}
                    >
                      {beatStatutes.map((statute) => (
                        <li
                          key={statute.entityId}
                          className="ds-theme-impact__arc-beat-statute"
                        >
                          <p className="ds-mono ds-theme-impact__linked-statute-kicker">
                            Law · {statute.yearLabel}
                          </p>
                          <p className="ds-theme-impact__linked-statute-title">
                            <EntityLink entityId={statute.entityId}>
                              {statute.displayName}
                            </EntityLink>
                          </p>
                          <p className="ds-theme-impact__linked-statute-summary">
                            {statute.summary}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="ds-theme-impact__arc-beat-link">
                    <Link href={`/themes/${themeId}/questions/${packet.questionId}`}>
                      Sources for this beat
                    </Link>
                  </p>
                </li>
              );
            })}
          </ol>

          {hasGaps ? (
            <p className="ds-theme-impact__arc-gap-note">
              Some year spans and district-level series are still unloaded. The beats above already
              write through those seams with source labels; open a beat for exact coverage and
              provenance.
            </p>
          ) : null}
        </div>

        <aside className="ds-theme-impact__arc-instruments" aria-label="Instruments beside the arc">
          {eras.length > 0 ? (
            <ThemeImpactPolicyEraTimeline
              policyEras={eras}
              headingId={`${headingId}-eras`}
            />
          ) : null}

          {linkedStatutes.length > 0 ? (
            <ThemeImpactLinkedStatutes
              statutes={linkedStatutes}
              headingId={`${headingId}-statutes`}
            />
          ) : null}

          {instruments.length > 0 ? (
            <section aria-labelledby={`${headingId}-instruments`}>
              <h3 className="ds-theme-impact__subheading" id={`${headingId}-instruments`}>
                Instruments
              </h3>
              <ul className="ds-theme-impact__arc-instrument-list">
                {instruments.map((row) => (
                  <li key={row.key}>
                    <span className="ds-theme-impact__metric-label">{row.label}</span>
                    <span className="ds-mono ds-theme-impact__metric-value">{row.value}</span>
                    <span className="ds-mono ds-theme-impact__metric-period">
                      {' '}
                      · {row.period}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {related.length > 0 ? (
        <nav className="ds-theme-impact__arc-related" aria-label="Related threads">
          <h3 className="ds-theme-impact__subheading">Related threads</h3>
          <ul className="ds-theme-impact__arc-related-list">
            {related.map((thread) => (
              <li key={thread.themeId}>
                <Link href={`/themes/${thread.themeId}`}>{thread.label}</Link>
                <span className="ds-theme-impact__arc-related-reason"> {thread.reason}</span>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </section>
  );
}
