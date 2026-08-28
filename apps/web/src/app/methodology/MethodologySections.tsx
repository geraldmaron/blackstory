/**
 * `/methodology` — built from the live Confidence, Citation and Notice components rather than
 * prose describing them, so the encoding a reader learns here is byte for byte the one the Atlas
 * sheet and record pages render. `Confidence` and `Citation` are imported from `@repo/ui`, the
 * same package `EvidenceCard` (apps/web/src/components/evidence/EvidenceCard.tsx) imports them
 * from to render a record's grade mark and citation string. This page renders no grade mark or
 * citation string of its own.
 *
 * Section names match the ones record pages use: "Sources", "At a glance" style anatomy framing
 * for evidence grades, and "Precision" language identical to `Precision`'s own copy contract
 * (apps/web/src/components/room/Evidence.tsx).
 */
import React from 'react';
import Link from 'next/link';
import { ATLAS_INSTRUMENT_HREF } from '../../lib/nav/atlas-door';
import { Citation, Confidence, Notice } from '@repo/ui';
import {
  FACT_CONFIDENCE_DEFINITIONS,
  FACT_CONFIDENCE_GRADES,
  type FactConfidenceGrade,
} from '@repo/domain/facts';
import { MethodologyAtlasShortcut } from './MethodologyAtlasShortcut';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { humanizeToken, mapConfidenceToUiLevel } from '../../components/facts/format';
import { ResearchPipelineSketch } from '../../components/trust/ResearchPipelineSketch';
import { TrustSiteDisclaimer } from '../../components/trust/TrustSiteDisclaimer';
import { formatCitation } from '../../lib/citation/format';
import { GroupHeading, Note, OffRamp, Precision, Prose, RoomHeader } from '../../components/room';
import {
  DIGNITY_RULES,
  LIMITATION_RULES,
  METHODOLOGY_DIGNITY_LINE,
  METHODOLOGY_INTRO_LEDE,
  METHODOLOGY_MISSION_BEATS,
  METHODOLOGY_PAGE_SECTIONS,
  METHODOLOGY_PUBLISH_RULES,
  VERIFICATION_STEPS,
} from './methodology-copy';

void React;

/**
 * A worked, illustrative record. It exists to run through `formatCitation` — the exact function
 * every record page and the Atlas sheet call to build a citation string — without asserting a
 * real historical claim on the page that explains how claims get verified.
 */
const EXAMPLE_CITATION = formatCitation({
  name: 'Record name',
  place: 'City, State',
  era: 'Decade',
  grade: 'A',
  sourceCount: 2,
  url: 'https://blackstory.org/entity/[id]',
  accessed: new Date('2026-01-01T00:00:00Z'),
});

export type MethodologySectionsProps = {
  /** A currently published record to send the reader to, when the catalogue could be reached. */
  readonly exampleRecordHref?: string;
};

export function MethodologySections({ exampleRecordHref }: MethodologySectionsProps) {
  const grades = FACT_CONFIDENCE_GRADES as readonly FactConfidenceGrade[];

  return (
    <>
      <MethodologyAtlasShortcut />
      <RoomHeader
        pathname="/methodology"
        kicker="Receipt"
        title={
          <>
            How we <em>work</em>.
          </>
        }
        lede={METHODOLOGY_INTRO_LEDE}
        showPath={false}
      />

      <Prose>
        <TrustSiteDisclaimer />
        <p className="ds-row">
          <Link className="ds-cta ds-cta--solid" href={ATLAS_INSTRUMENT_HREF}>
            Open the Atlas
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/about">
            About BlackStory
          </Link>
        </p>
        <p>
          Archive texture, symbolic atmosphere.{' '}
          <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
        </p>
      </Prose>

      <nav aria-labelledby="methodology-toc-title">
        <GroupHeading>
          <span id="methodology-toc-title">On this page</span>
        </GroupHeading>
        <ul className="ds-stack">
          {METHODOLOGY_PAGE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ---- How a record gets in ------------------------------------------------------- */}
      <section aria-labelledby="how-a-record-gets-in-heading" id="how-a-record-gets-in">
        <GroupHeading>
          <span id="how-a-record-gets-in-heading">How a record gets in</span>
        </GroupHeading>
        <Prose>
          <p>
            Discovery finds candidates. People verify. The publish gate decides what reaches the
            public record. Models never write it alone.
          </p>
        </Prose>
        <ul className="ds-stack">
          {METHODOLOGY_MISSION_BEATS.map((beat) => (
            <li key={beat.kicker}>
              <p className="ds-mono">{beat.kicker}</p>
              <p>{beat.body}</p>
            </li>
          ))}
        </ul>
        <ResearchPipelineSketch compact />
        <ol className="ds-stack">
          {METHODOLOGY_PUBLISH_RULES.map((item, index) => (
            <li key={item.title}>
              <span className="ds-mono" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>{' '}
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
        <Note kind="VERIFICATION">{VERIFICATION_STEPS.join(' ')}</Note>
      </section>

      {/* ---- What the evidence grades mean ---------------------------------------------- */}
      <section aria-labelledby="evidence-grades-heading" id="evidence-grades">
        <GroupHeading>
          <span id="evidence-grades-heading">What the evidence grades mean</span>
        </GroupHeading>
        <Prose>
          <p>
            Confidence is never color alone. Every grade the archive publishes carries this mark, a
            text label, and the definition below it, rendered by the same <code>Confidence</code>{' '}
            component every record&apos;s claims use.
          </p>
        </Prose>
        <ul className="ds-stack">
          {grades.map((grade) => (
            <li key={grade}>
              <Confidence level={mapConfidenceToUiLevel(grade)} label={humanizeToken(grade)} />
              <p>{FACT_CONFIDENCE_DEFINITIONS[grade]}</p>
            </li>
          ))}
        </ul>
        <Notice tone="warning" title="Crime statistics never enter this score">
          A record&apos;s confidence grade is measured on independence and proximity to the event
          alone. Crime statistics and violence adjacent framing never factor into it.
        </Notice>
        <Prose>
          <p>
            Every citation on the site, including this one, is built by the same formatter and
            rendered by the same <code>Citation</code> component:
          </p>
        </Prose>
        <Citation label="Example citation" source={EXAMPLE_CITATION} />
      </section>

      {/* ---- Why a point is never drawn sharper than its source ------------------------- */}
      <section aria-labelledby="precision-heading" id="precision">
        <GroupHeading>
          <span id="precision-heading">Why a point is never drawn sharper than its source</span>
        </GroupHeading>
        <Prose>
          <p>
            Place is the product&apos;s organizing idea, and also where harm is easiest to cause. A
            record renders no sharper than the precision its sources support, using the same{' '}
            <code>Precision</code> line every record page prints beneath its map.
          </p>
        </Prose>
        <Precision
          resolution="the precision its sources support"
          caveat="Exact residential addresses are never rendered on public pages."
        />
        <ol className="ds-stack" aria-label="Map dignity rules">
          {DIGNITY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <Note kind="LIMITATIONS">{LIMITATION_RULES.join(' ')}</Note>
      </section>

      {/* ---- Living person protection ---------------------------------------------------- */}
      <section aria-labelledby="living-person-protection-heading" id="living-person-protection">
        <GroupHeading>
          <span id="living-person-protection-heading">Living person protection</span>
        </GroupHeading>
        <Prose>
          <p>{METHODOLOGY_DIGNITY_LINE}</p>
          <p>
            Unknown living status is treated as living, and the same protections that keep street
            level residences off the public map apply everywhere a living person is named. The
            people this policy exists for are named on{' '}
            <Link href="/memorial">the memorial wall</Link>, held still on request, never painted as
            ambient texture on the map.
          </p>
        </Prose>
      </section>

      {/* ---- See it applied --------------------------------------------------------------- */}
      <div id="see-it-applied">
        <OffRamp
          title="See it applied"
          actions={[
            {
              label: 'Open a record',
              href: exampleRecordHref ?? '/records',
              emphasis: 'copper',
            },
            { label: 'Errata', href: '/errata' },
            { label: 'Request a correction', href: '/corrections' },
          ]}
        >
          Every grade mark and citation string on this page is the one you will find on the record
          itself. Open one, then the corrections lane and the errata log, to see the same rules run
          end to end.
        </OffRamp>
      </div>
    </>
  );
}
