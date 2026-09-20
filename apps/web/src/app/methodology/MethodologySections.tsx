/**
 * `/methodology` — how a record gets in, in English. Shop tokens stay off the page.
 */
import React from 'react';
import { Citation, Confidence, Notice } from '@repo/ui';
import { FACT_CONFIDENCE_GRADES, type FactConfidenceGrade } from '@repo/domain/facts';
import { humanizeToken, mapConfidenceToUiLevel } from '../../components/facts/format';
import { TrustSiteDisclaimer } from '../../components/trust/TrustSiteDisclaimer';
import { formatCitation } from '../../lib/citation/format';
import {
  DocumentPlate,
  Note,
  Prose,
  ReadingEntry,
  RoomFactList,
  RoomHandoff,
  RoomJump,
  RoomSection,
  roomSectionTone,
} from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
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

const METHODOLOGY_JUMP = METHODOLOGY_PAGE_SECTIONS.filter(
  (section) => section.id !== 'see-it-applied',
);

export function MethodologySections({ omitEntry = false }: { readonly omitEntry?: boolean }) {
  const grades = FACT_CONFIDENCE_GRADES as readonly FactConfidenceGrade[];
  let chapter = 0;
  const nextTone = () => roomSectionTone(chapter++);

  return (
    <>
      {omitEntry ? null : (
        <ReadingEntry
          pathname="/methodology"
          title={
            <>
              How the archive <em>works</em>.
            </>
          }
          lede={METHODOLOGY_INTRO_LEDE}
          plate={
            <DocumentPlate
              label="The grade key"
              citation="The four grades a public statement can carry, as they appear on a record."
              href="#evidence-grades"
              hrefLabel="Read the definitions"
            >
              {grades.map((grade) => (
                <div className="ds-room-plate__row" key={grade}>
                  <Confidence level={mapConfidenceToUiLevel(grade)} label={humanizeToken(grade)} />
                </div>
              ))}
            </DocumentPlate>
          }
        />
      )}

      <RoomJump sections={METHODOLOGY_JUMP} />

      <Prose>
        <TrustSiteDisclaimer />
      </Prose>

      <RoomSection
        id="how-a-record-gets-in"
        icon="records"
        kicker="Admission"
        title="How a record gets in"
        tone={nextTone()}
      >
        <Prose>
          <p>
            Candidates come in from research runs, and every one of them is pinned to somewhere real
            before it can publish: a state, a city, a campus, a documented site. Nothing reaches a
            public page on a model&apos;s say-so. A person reads it first, and on this project that
            person is me.
          </p>
        </Prose>
        <RecordIntakeDiagram />
        <RoomFactList
          items={METHODOLOGY_MISSION_BEATS.map((beat) => ({
            title: beat.kicker,
            body: beat.body,
            icon: 'methodology' as const,
            kicker: beat.kicker,
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
        <Note kind="VERIFICATION">{VERIFICATION_STEPS.join(' ')}</Note>
      </RoomSection>

      <RoomSection
        id="evidence-grades"
        icon="evidence"
        kicker="Grades"
        title="What the evidence grades mean"
        tone={nextTone()}
      >
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

      <RoomSection
        id="editorial-standards"
        icon="publication"
        kicker="Framing"
        title="Editorial standards"
        tone={nextTone()}
      >
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
            icon: 'publication' as const,
          }))}
        />
      </RoomSection>

      <RoomSection
        id="how-a-point-is-drawn"
        icon="precision"
        kicker="Map dignity"
        title="Why a point is never drawn sharper than its source"
        tone={nextTone()}
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
        <Note kind="LIMITATIONS">{LIMITATION_RULES.join(' ')}</Note>
      </RoomSection>

      <RoomSection
        id="how-it-holds-together"
        icon="collection"
        kicker="Structure"
        title="How it holds together"
        tone={nextTone()}
      >
        <Prose>
          <p>{METHODOLOGY_STRUCTURE_LEDE}</p>
        </Prose>
        <RecordDataModelDiagram />
        <SiteStructureDiagram />
      </RoomSection>

      <RoomSection
        id="lives-across-decades"
        icon="person"
        kicker="Lives"
        title="Lives across the decades"
        tone={nextTone()}
      >
        <Prose>
          <p>{LIVES_METHOD_LEDE}</p>
        </Prose>
        <RoomFactList
          items={LIVES_METHOD_RULES.map((rule) => ({
            title: rule.title,
            body: rule.body,
            icon: 'person' as const,
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

      <RoomSection
        id="where-the-evidence-comes-from"
        icon="source"
        kicker="Sources"
        title="Where the evidence comes from"
        tone={nextTone()}
      >
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

      <RoomSection
        id="living-person-protection"
        icon="privacy"
        kicker="Dignity"
        title="Living person protection"
        tone={nextTone()}
      >
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

      <RoomSection
        id="internet-archive"
        icon="collection"
        kicker="Preservation"
        title="Internet Archive handoff"
        tone={nextTone()}
      >
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

      <div id="see-it-applied">
        <WalkOffRamp
          title="See it applied"
          extra={[
            { label: 'Errata', href: '/errata' },
            { label: 'Request a correction', href: '/corrections' },
            { label: 'Source library', href: '/sources' },
          ]}
        >
          The same rules run on every public record.
        </WalkOffRamp>
      </div>
    </>
  );
}
