/**
 * `/methodology` — how a record gets in, in English. Shop tokens stay off the page.
 */
import React from 'react';
import Link from 'next/link';
import { Citation, Confidence, Notice, PageHeader } from '@repo/ui';
import { FACT_CONFIDENCE_GRADES, type FactConfidenceGrade } from '@repo/domain/facts';
import { humanizeToken, mapConfidenceToUiLevel } from '../../components/facts/format';
import { TrustSiteDisclaimer } from '../../components/trust/TrustSiteDisclaimer';
import { formatCitation } from '../../lib/citation/format';
import {
  parentCrumb,
  Prose,
  RoomFactList,
  RoomHandoff,
  RoomJump,
  RoomSection,
} from '../../components/room';
import {
  EvidenceConvergenceDiagram,
  MapPrecisionDiagram,
  RecordDataModelDiagram,
  RecordIntakeDiagram,
  SiteStructureDiagram,
} from './MethodologyDiagrams';
import {
  DIGNITY_RULES,
  EDITORIAL_STANDARDS,
  EVIDENCE_GRADE_DEFINITIONS,
  LIMITATION_RULES,
  METHODOLOGY_DIGNITY_LINE,
  METHODOLOGY_INTRO_LEDE,
  METHODOLOGY_MISSION_BEATS,
  METHODOLOGY_PAGE_SECTIONS,
  METHODOLOGY_PUBLISH_RULES,
  METHODOLOGY_SOURCE_LIBRARY_HREF,
  METHODOLOGY_STRUCTURE_LEDE,
  LIVES_METHOD_LEDE,
  LIVES_METHOD_RULES,
  SOURCE_LIBRARY_LEDE,
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
      <PageHeader
        crumb={parentCrumb('/methodology')}
        linkAs={Link}
        title="How the archive works"
        dek={METHODOLOGY_INTRO_LEDE}
      />

      <RoomJump sections={METHODOLOGY_PAGE_SECTIONS} />

      <Prose>
        <TrustSiteDisclaimer />
      </Prose>

      <RoomSection id="how-a-record-gets-in" title="How a record gets in">
        <Prose>
          <p>
            Candidates come in from research runs, and every one gets pinned to somewhere real
            before it can publish, whether that&apos;s a state, a city, a campus or a documented
            site. After that, I use a model from another company to check proposed claims against
            their captured sources. That tests what a source supports, and it can still miss an
            error in the source. The Negro Motorist Green Book listings don&apos;t go through that
            model check. A program confirms that the name, address, kind of business and edition
            year on each one appear exactly in the New York Public Library&apos;s digitized listing
            data for the directory, and each is marked as a registry listing. The address is the one
            printed in that edition, and the business may be long gone. There&apos;s more here than
            one person can read, so I built these checks and I answer for them. When one gets
            something wrong, that&apos;s on me, and I fix it where you can see it.
          </p>
        </Prose>
        <RecordIntakeDiagram />
        <RoomFactList
          items={METHODOLOGY_MISSION_BEATS.map((beat) => ({
            title: beat.title,
            body: beat.body,
          }))}
        />
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
        <Notice tone="note" title="Verification">
          {VERIFICATION_STEPS.join(' ')}
        </Notice>
      </RoomSection>

      <RoomSection id="evidence-grades" title="What the evidence grades mean">
        <Prose>
          <p>
            A grade is never a color on its own. Each one carries a mark, a label in words, and the
            definition printed under it.
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
        <EvidenceConvergenceDiagram />
        <Notice tone="warning" title="Crime statistics never enter this score">
          A record&apos;s grade is measured on independence and proximity to the event alone. Crime
          statistics and violence-adjacent framing never factor into it.
        </Notice>
        <Prose>
          <p>Every citation on the site is built the same way, including this example:</p>
        </Prose>
        <Citation label="Example citation" source={EXAMPLE_CITATION} />
      </RoomSection>

      <RoomSection id="editorial-standards" title="Editorial standards">
        <Prose>
          <p>
            Accuracy is not enough on its own. These are the framing and corroboration rails a
            hostile reader can hold any public record to, including enrichment drafts that have not
            yet published.
          </p>
        </Prose>
        <RoomFactList
          items={EDITORIAL_STANDARDS.map((item) => ({
            title: item.title,
            body: item.body,
          }))}
        />
      </RoomSection>

      <RoomSection
        id="how-a-point-is-drawn"
        title="Why a point is never drawn sharper than its source"
      >
        <Prose>
          <p>
            Place is how this archive is organized. It is also the field most likely to put a living
            person on a map at their own front door, so it carries the strictest rules on the site.
            A record is drawn no sharper than its sources support, and exact residential addresses
            are not drawn at all.
          </p>
        </Prose>
        <MapPrecisionDiagram />
        <ol className="ds-stack" aria-label="Map dignity rules">
          {DIGNITY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <Notice tone="note" title="Limitations">
          {LIMITATION_RULES.join(' ')}
        </Notice>
      </RoomSection>

      <RoomSection id="how-it-holds-together" title="How it holds together">
        <Prose>
          <p>{METHODOLOGY_STRUCTURE_LEDE}</p>
        </Prose>
        <RecordDataModelDiagram />
        <SiteStructureDiagram />
      </RoomSection>

      <RoomSection id="lives-across-decades" title="Lives across the decades">
        <Prose>
          <p>{LIVES_METHOD_LEDE}</p>
        </Prose>
        <RoomFactList
          items={LIVES_METHOD_RULES.map((rule) => ({
            title: rule.title,
            body: rule.body,
          }))}
        />
        <div className="ds-room-handoffs">
          <RoomHandoff
            href="/lives"
            icon="person"
            title="Open Lives"
            line="Published counts beside sourced voices, places, laws, and records."
          />
          <RoomHandoff
            href="/data#lives"
            icon="data"
            title="Data · Lived"
            line="A compact door on Data. The timeline itself lives on Lives."
          />
        </div>
      </RoomSection>

      <RoomSection id="where-the-evidence-comes-from" title="Where the evidence comes from">
        <Prose>
          <p>{SOURCE_LIBRARY_LEDE}</p>
          <p>
            Publisher kinds, the citation chain, and where sources already appear live in the source
            library. This heading stays so an old link still lands on the method page.
          </p>
        </Prose>
        <RoomHandoff
          href={METHODOLOGY_SOURCE_LIBRARY_HREF}
          icon="source"
          title="Open the source library"
          line="Publisher kinds, how a URL becomes a citation, and where sources already appear."
        />
      </RoomSection>

      <RoomSection id="living-person-protection" title="Living person protection">
        <Prose>
          <p>{METHODOLOGY_DIGNITY_LINE}</p>
          <p>
            When the sources do not say whether someone is living, the archive treats them as living
            and publishes accordingly. Some of the people this rule exists for are named on the
            memorial wall, which holds a name and nothing else.
          </p>
        </Prose>
        <RoomHandoff
          href="/memorial"
          icon="memorial"
          title="The memorial wall"
          line="A name, held. Not a join from a place record."
        />
      </RoomSection>

      <RoomSection id="internet-archive" title="Internet Archive handoff">
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
      </RoomSection>
    </>
  );
}
