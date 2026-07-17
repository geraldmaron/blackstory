/**
 * Methodology page sections and copy assembly mission, definitions, source hierarchy,
 * verification, limitations, cadence, report-an-error, funding, masthead, Trust Project vocabulary,
 * and IFCN alignment text.
 */
import React from 'react';
import {
  CULTURAL_FIGURE_NOTABILITY_CALIBRATION_NOTE,
  FACT_CONFIDENCE_DEFINITIONS,
  NOTABILITY_CRITERIA,
  NOTABILITY_RUBRIC,
} from '@black-book/domain';
import {
  ENTITY_STATUS_VOCABULARY,
  FACT_STATUS_LIFECYCLE_DEFINITIONS,
  IFCN_COMMITMENTS,
  SOURCE_HIERARCHY_LEVELS,
  TRUST_PROJECT_INDICATORS,
} from '../../lib/trust/domain-trust.js';
import { humanizeToken } from '../../components/facts/format.js';
import { HowToReadThisRecord } from '../../components/trust/HowToReadThisRecord.js';
import { TrustSiteDisclaimer } from '../../components/trust/TrustSiteDisclaimer.js';

function DefinitionList({
  entries,
}: {
  readonly entries: readonly { readonly term: string; readonly definition: string }[];
}) {
  return (
    <dl className="bb-sans">
      {entries.map((entry) => (
        <div key={entry.term} style={{ marginBottom: 'var(--bb-space-4)' }}>
          <dt style={{ fontWeight: 600 }}>{entry.term}</dt>
          <dd style={{ margin: 'var(--bb-space-1) 0 0 0' }}>{entry.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MethodologySections() {
  return (
    <div className="bb-stack" style={{ marginTop: 'var(--bb-space-8)' }}>
      <TrustSiteDisclaimer />

      <section className="bb-section" aria-labelledby="mission-method" style={{ paddingTop: 0 }} id="mission">
        <h2 className="bb-section__title" id="mission-method">
          Mission &amp; scope
        </h2>
        <p className="bb-section__lede">
          Black Book publishes released historical projections — place-connected Black history with
          provenance, confidence grades, and living-person protections. We document what primary and
          secondary sources support, state what they do not, and preserve disagreements instead of
          collapsing them into a single winner.
        </p>
      </section>

      <section className="bb-section" aria-labelledby="how-to-read-method">
        <HowToReadThisRecord methodologyHref="#definitions" />
      </section>

      <section className="bb-section" aria-labelledby="definitions-method" id="definitions">
        <h2 className="bb-section__title" id="definitions-method">
          Definitions &amp; inclusion criteria
        </h2>
        <p className="bb-section__lede">
          Precision in definitions is what lets a reader compare this archive to others without
          talking past each other. Inclusion is never a popularity contest — every entity needs at
          least one documented notability basis.
        </p>
        <h3 className="bb-section__title" style={{ fontSize: '1.125rem' }}>
          Notability basis (per kind)
        </h3>
        <DefinitionList
          entries={NOTABILITY_CRITERIA.map((criterion) => ({
            term: humanizeToken(criterion),
            definition: NOTABILITY_RUBRIC[criterion],
          }))}
        />
        <p className="bb-sans">{CULTURAL_FIGURE_NOTABILITY_CALIBRATION_NOTE}</p>
        <h3 className="bb-section__title" style={{ fontSize: '1.125rem', marginTop: 'var(--bb-space-6)' }}>
          Fact record status lifecycle
        </h3>
        <DefinitionList
          entries={Object.entries(FACT_STATUS_LIFECYCLE_DEFINITIONS).map(([status, definition]) => ({
            term: humanizeToken(status),
            definition,
          }))}
        />
        <h3 className="bb-section__title" style={{ fontSize: '1.125rem', marginTop: 'var(--bb-space-6)' }}>
          Entity status vocabularies
        </h3>
        <DefinitionList
          entries={[
            ...ENTITY_STATUS_VOCABULARY.place_like.map((entry) => ({
              term: `Place-like · ${humanizeToken(entry.value)}`,
              definition: entry.definition,
            })),
            ...ENTITY_STATUS_VOCABULARY.law.map((entry) => ({
              term: `Law · ${humanizeToken(entry.value)}`,
              definition: entry.definition,
            })),
            ...ENTITY_STATUS_VOCABULARY.movement.map((entry) => ({
              term: `Movement · ${humanizeToken(entry.value)}`,
              definition: entry.definition,
            })),
          ]}
        />
      </section>

      <section className="bb-section" aria-labelledby="source-hierarchy-method" id="sources">
        <h2 className="bb-section__title" id="source-hierarchy-method">
          Source hierarchy
        </h2>
        <DefinitionList
          entries={SOURCE_HIERARCHY_LEVELS.map((level) => ({
            term: humanizeToken(level.tier),
            definition: level.definition,
          }))}
        />
      </section>

      <section className="bb-section" aria-labelledby="verification-method" id="verification">
        <h2 className="bb-section__title" id="verification-method">
          Verification &amp; triangulation
        </h2>
        <p className="bb-section__lede">
          Every published fact passes an independent citation-completeness gate: structured CSL-JSON
          references, supporting excerpts, retrieval dates, and archived captures for web sources.
          Triangulation means at least two independent lineages before a fact reaches corroborated
          grade; syndicated copies do not inflate scores.
        </p>
        <ol className="bb-sans" style={{ paddingLeft: 'var(--bb-space-5)' }}>
          <li>Identify primary sources closest to the event or record creation.</li>
          <li>Cross-check against independent secondary scholarship where primaries are sparse.</li>
          <li>Document contradictions in confidence notes and counter-claims rather than hiding them.</li>
          <li>Append every change to the revision log with a mandatory edit summary.</li>
        </ol>
      </section>

      <section className="bb-section" aria-labelledby="confidence-method" id="confidence">
        <h2 className="bb-section__title" id="confidence-method">
          Confidence grades
        </h2>
        <DefinitionList
          entries={Object.entries(FACT_CONFIDENCE_DEFINITIONS).map(([grade, definition]) => ({
            term: humanizeToken(grade),
            definition,
          }))}
        />
      </section>

      <section className="bb-section" aria-labelledby="limitations-method" id="limitations">
        <h2 className="bb-section__title" id="limitations-method">
          Known limitations &amp; gaps
        </h2>
        <p className="bb-section__lede">
          An archive of thousands of sourced facts will contain errors. What matters is what happens
          next: every correction is logged publicly, timestamped, and preserved in the record&apos;s
          history — nothing is silently edited. Many historical events were deliberately never
          documented; we state those gaps plainly rather than inventing certainty.
        </p>
        <ul className="bb-sans" style={{ paddingLeft: 'var(--bb-space-5)' }}>
          <li>Public maps show country through campus/institution precision — never street addresses or exact residence coordinates.</li>
          <li>Single-source facts are published only with an explicit confidence note explaining why.</li>
          <li>Seed and draft records in this build are labeled as such and excluded from search.</li>
        </ul>
      </section>

      <section className="bb-section" aria-labelledby="cadence-method" id="cadence">
        <h2 className="bb-section__title" id="cadence-method">
          Update cadence
        </h2>
        <p className="bb-section__lede">
          Corrections ship as soon as verified — fully, quickly, and without defensiveness. Routine
          content reviews run quarterly; present-day advisories carry their own review dates on each
          record. Major methodology changes receive an editor&apos;s note in the{' '}
          <a href="/errata">errata log</a>.
        </p>
      </section>

      <section className="bb-section" aria-labelledby="report-error-method" id="report-error">
        <h2 className="bb-section__title" id="report-error-method">
          How to report an error
        </h2>
        <p className="bb-section__lede">
          Use the <a href="/corrections">corrections lane</a> to challenge a published record, suggest
          missing evidence, or report a precision issue. Submissions enter a restricted review queue;
          nothing changes publicly until it passes independent verification. You receive a receipt code
          to track status.
        </p>
      </section>

      <section className="bb-section" aria-labelledby="funding-method" id="funding">
        <h2 className="bb-section__title" id="funding-method">
          Funding &amp; independence
        </h2>
        <p className="bb-section__lede" id="independence">
          Black Book is an independent editorial project. Funding sources, when applicable, are listed
          here and updated when they change. No funder receives advance editorial review or veto over
          published records. Research promotion and admin tooling remain on private surfaces.
        </p>
        <p className="bb-sans" style={{ color: 'var(--bb-ink-muted)' }}>
          This public shell is pre-beta; a live funding disclosure will appear here before general
          release (see launch gate BB-063).
        </p>
      </section>

      <section className="bb-section" aria-labelledby="masthead-method" id="masthead">
        <h2 className="bb-section__title" id="masthead-method">
          Masthead
        </h2>
        <p className="bb-section__lede">
          Editorial accountability is named, not anonymous. Roles below will link to public bios as the
          team publishes them.
        </p>
        <ul className="bb-sans" style={{ paddingLeft: 'var(--bb-space-5)' }}>
          <li>Editorial lead — methodology, corrections policy, and publish gate</li>
          <li>Research lead — source verification and citation completeness</li>
          <li>Platform lead — projection integrity and security posture</li>
        </ul>
      </section>

      <section className="bb-section" aria-labelledby="transparency-method" id="transparency">
        <h2 className="bb-section__title" id="transparency-method">
          Transparency indicators
        </h2>
        <p className="bb-section__lede">
          We adopt the eight transparency practices and their schema.org vocabulary (CC-BY-SA) without
          using any trademarked program name or badge. Each indicator maps to a published policy URL
          on this site.
        </p>
        <DefinitionList
          entries={TRUST_PROJECT_INDICATORS.map((indicator) => ({
            term: `${indicator.title} (${indicator.schemaProperty})`,
            definition: indicator.summary,
          }))}
        />
      </section>

      <section className="bb-section" aria-labelledby="ifcn-method" id="ifcn">
        <h2 className="bb-section__title" id="ifcn-method">
          Aligned with IFCN fact-checking commitments
        </h2>
        <p className="bb-section__lede">
          The five International Fact-Checking Network commitments below are reproduced verbatim as
          editorial alignment. Black Book is not a paid IFCN signatory; the badge requires signatory
          status. The commitment language is public and guides our corrections and verification posture.
        </p>
        <DefinitionList
          entries={IFCN_COMMITMENTS.map((commitment) => ({
            term: commitment.title,
            definition: commitment.body,
          }))}
        />
      </section>
    </div>
  );
}
