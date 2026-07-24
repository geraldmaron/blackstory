/**
 * Side-rail statute rows for theme-impact arcs: linked entity cards with short summaries.
 */
import React from 'react';
import type { ThemeImpactLinkedStatuteView } from '@repo/domain';
import { EntityLink } from '../entity/EntityLink';

export type ThemeImpactLinkedStatutesProps = {
  readonly statutes: readonly ThemeImpactLinkedStatuteView[];
  readonly headingId: string;
};

export function ThemeImpactLinkedStatutes({
  statutes,
  headingId,
}: ThemeImpactLinkedStatutesProps) {
  if (statutes.length === 0) return null;

  return (
    <section className="ds-theme-impact__linked-statutes" aria-labelledby={headingId}>
      <h3 className="ds-theme-impact__subheading" id={headingId}>
        Acts and laws
      </h3>
      <ul className="ds-theme-impact__linked-statute-list">
        {statutes.map((statute) => (
          <li key={statute.entityId} className="ds-theme-impact__linked-statute-item">
            <p className="ds-mono ds-theme-impact__linked-statute-kicker">
              Law · {statute.yearLabel}
            </p>
            <p className="ds-theme-impact__linked-statute-title">
              <EntityLink entityId={statute.entityId}>{statute.displayName}</EntityLink>
            </p>
            <p className="ds-theme-impact__linked-statute-summary">{statute.summary}</p>
          </li>
        ))}
      </ul>
      <p className="ds-theme-impact__linked-statute-note">
        Statutes sit on the timeline as policy context beside instruments, not as automatic proof
        that any single map caused later readings.
      </p>
    </section>
  );
}
