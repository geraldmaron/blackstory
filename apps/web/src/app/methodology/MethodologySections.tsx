/**
 * `/methodology` — how a record gets in, in English. Shop tokens stay off the page.
 */
import React from 'react';
import Link from 'next/link';
import { Citation, Confidence, Notice } from '@repo/ui';
import { FACT_CONFIDENCE_GRADES, type FactConfidenceGrade } from '@repo/domain/facts';
import { humanizeToken, mapConfidenceToUiLevel } from '../../components/facts/format';
import { TrustSiteDisclaimer } from '../../components/trust/TrustSiteDisclaimer';
import { formatCitation } from '../../lib/citation/format';
import { GroupHeading, Note, Prose, RoomHeader } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import {
  DIGNITY_RULES,
  EVIDENCE_GRADE_DEFINITIONS,
  LIMITATION_RULES,
  METHODOLOGY_DIGNITY_LINE,
  METHODOLOGY_INTRO_LEDE,
  METHODOLOGY_MISSION_BEATS,
  METHODOLOGY_PAGE_SECTIONS,
  METHODOLOGY_PUBLISH_RULES,
  VERIFICATION_STEPS,
} from './methodology-copy';

void React;

const EXAMPLE_CITATION = formatCitation({
  name: 'Record name',
  place: 'City, State',
  era: 'Decade',
  grade: 'established',
  sourceCount: 2,
  url: 'https://blackstory.app/place/example',
  accessed: new Date('2026-01-01T00:00:00Z'),
});

export function MethodologySections() {
  const grades = FACT_CONFIDENCE_GRADES as readonly FactConfidenceGrade[];

  return (
    <>
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

      <section aria-labelledby="how-a-record-gets-in-heading" id="how-a-record-gets-in">
        <GroupHeading>
          <span id="how-a-record-gets-in-heading">How a record gets in</span>
        </GroupHeading>
        <Prose>
          <p>
            Discovery finds candidates. People verify. A publish gate decides what reaches a public
            page. A model never writes the public record alone.
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

      <section aria-labelledby="evidence-grades-heading" id="evidence-grades">
        <GroupHeading>
          <span id="evidence-grades-heading">What the evidence grades mean</span>
        </GroupHeading>
        <Prose>
          <p>
            How sure we are is never color alone. Every grade carries a mark, a text label, and the
            definition below it.
          </p>
        </Prose>
        <ul className="ds-stack">
          {grades.map((grade) => (
            <li key={grade}>
              <Confidence level={mapConfidenceToUiLevel(grade)} label={humanizeToken(grade)} />
              <p>{EVIDENCE_GRADE_DEFINITIONS[grade]}</p>
            </li>
          ))}
        </ul>
        <Notice tone="warning" title="Crime statistics never enter this score">
          A record&apos;s grade is measured on independence and proximity to the event alone. Crime
          statistics and violence-adjacent framing never factor into it.
        </Notice>
        <Prose>
          <p>Every citation on the site is built the same way, including this example:</p>
        </Prose>
        <Citation label="Example citation" source={EXAMPLE_CITATION} />
      </section>

      <section aria-labelledby="how-a-point-is-drawn-heading" id="how-a-point-is-drawn">
        <GroupHeading>
          <span id="how-a-point-is-drawn-heading">
            Why a point is never drawn sharper than its source
          </span>
        </GroupHeading>
        <Prose>
          <p>
            Place is how this archive is organized, and also where harm is easiest to cause. A
            record is shown no sharper than its sources support. Exact residential addresses are
            never drawn on public pages.
          </p>
        </Prose>
        <ol className="ds-stack" aria-label="Map dignity rules">
          {DIGNITY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <Note kind="LIMITATIONS">{LIMITATION_RULES.join(' ')}</Note>
      </section>

      <section aria-labelledby="living-person-protection-heading" id="living-person-protection">
        <GroupHeading>
          <span id="living-person-protection-heading">Living person protection</span>
        </GroupHeading>
        <Prose>
          <p>{METHODOLOGY_DIGNITY_LINE}</p>
          <p>
            Unknown living status is treated as living. The people this policy exists for are named
            on <Link href="/memorial">the memorial wall</Link>, held still on request, never painted
            as ambient texture on a map.
          </p>
        </Prose>
      </section>

      <section aria-labelledby="internet-archive-heading" id="internet-archive">
        <GroupHeading>
          <span id="internet-archive-heading">Internet Archive handoff</span>
        </GroupHeading>
        <Prose>
          <p>
            BlackStory links out to preserved copies rather than republishing full third-party
            pages. When a citation points to the Internet Archive or the Wayback Machine, the record
            page lists those archived copies beside the bibliography.
          </p>
          <p>
            Outbound contribution is operator-gated: cited public URLs are captured through the
            Wayback workflow, and curated research exports may be staged for human review before any
            Internet Archive upload. Operators use the research CLI capture and export verbs; there
            is no automatic public upload from the reader site.
          </p>
        </Prose>
      </section>

      <div id="see-it-applied">
        <WalkOffRamp
          title="See it applied"
          extra={[
            { label: 'Errata', href: '/errata' },
            { label: 'Request a correction', href: '/corrections' },
          ]}
        >
          The same rules run on every public record.
        </WalkOffRamp>
      </div>
    </>
  );
}
