/**
 * The figures on `/methodology`, drawn in HTML so they reflow, read in order and take both themes
 * from the tokens: the grade key, the grade rule as a table, and the precision ladder.
 *
 * The grade table is generated from `confidenceTierFromEvidenceInputs` itself rather than typed
 * out, so the figure cannot drift from the rule it explains.
 */
import React from 'react';
import {
  confidenceTierFromEvidenceInputs,
  gradeForConfidence,
  type ConfidenceTier,
} from '@repo/public-contracts/evidence';
import { recordMarkFor } from '../../lib/map-experience/geo-precision';
import { PRECISION_LEVELS, RECORD_GRADE_DEFINITIONS } from './methodology-copy';

void React;

/** The one statement of what each grade means. */
export function GradeKey() {
  return (
    <dl className="ds-grade-key" aria-label="What each grade means">
      {RECORD_GRADE_DEFINITIONS.map((entry) => (
        <div key={entry.grade} className="ds-grade-key__row">
          <dt className="ds-grade-key__grade" data-ungraded={entry.grade.length > 1 || undefined}>
            {entry.grade}
          </dt>
          <dd className="ds-grade-key__meaning">{entry.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

const LEVELS: readonly { readonly tier: ConfidenceTier; readonly label: string }[] = [
  { tier: 'high', label: 'High' },
  { tier: 'medium', label: 'Medium' },
  { tier: 'low', label: 'Low' },
];

/** Independent-source counts the rule distinguishes: at most one, and two or more. */
const COLUMNS = [
  { sources: 1, label: 'One independent source' },
  { sources: 2, label: 'Two or more' },
] as const;

/** The grade the published rule gives a record with this strongest claim and this many lineages. */
export function gradeFor(tier: ConfidenceTier, independentSources: number): string {
  const keys = Array.from({ length: independentSources }, (_, index) => `source-${index}.org`);
  return (
    gradeForConfidence(
      confidenceTierFromEvidenceInputs({
        strongestClaimLevel: tier,
        citedLineageKeys: keys,
        evidenceLineageKeys: keys,
      }),
    ) ?? 'Not graded'
  );
}

/** What moves a grade: strongest claim down the side, independent sources across the top. */
export function GradeMatrix() {
  return (
    <figure className="ds-grade-matrix">
      <figcaption className="ds-grade-matrix__caption">
        What moves a grade. A second independent source lifts a record one letter, unless its
        strongest claim is low.
      </figcaption>
      <table className="ds-grade-matrix__table">
        <thead>
          <tr>
            <th scope="col" className="ds-grade-matrix__corner">
              Strongest claim
            </th>
            {COLUMNS.map((column) => (
              <th key={column.sources} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((level) => (
            <tr key={level.tier}>
              <th scope="row">{level.label}</th>
              {COLUMNS.map((column) => {
                const grade = gradeFor(level.tier, column.sources);
                const lifted = column.sources > 1 && grade !== gradeFor(level.tier, 1);
                return (
                  <td key={column.sources} data-grade={grade}>
                    <span className="ds-grade-matrix__letter">{grade}</span>
                    {lifted ? (
                      <span className="ds-grade-matrix__moved">
                        up from {gradeFor(level.tier, 1)}
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">No cited source</th>
            <td colSpan={COLUMNS.length}>
              <span className="ds-grade-matrix__none">Not graded</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </figure>
  );
}

/** How sharp a point may be, coarsest first, and how each step is drawn. */
export function PrecisionLadder() {
  return (
    <figure className="ds-precision-ladder">
      <figcaption className="ds-precision-ladder__caption">
        Where a map point stops narrowing
      </figcaption>
      <ol className="ds-precision-ladder__steps">
        {PRECISION_LEVELS.map((step, index) => (
          <li
            key={step.level}
            className="ds-precision-ladder__step"
            data-stop={index === PRECISION_LEVELS.length - 1 || undefined}
            style={{ '--step': index } as React.CSSProperties}
          >
            <span className="ds-precision-ladder__bar" aria-hidden="true">
              {step.precision && recordMarkFor(step.precision) !== 'none' ? (
                <span
                  className="ds-precision-ladder__mark"
                  data-mark={recordMarkFor(step.precision)}
                />
              ) : null}
            </span>
            <span className="ds-precision-ladder__level">{step.level}</span>
            <span className="ds-precision-ladder__drawn">{step.drawn}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
