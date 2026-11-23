/**
 * `/methodology`: how a record gets in, what its grade means, and the rules around place and
 * living people. Each section opens on its one-sentence answer; processes are drawn as figures;
 * enumerations are lists.
 *
 * This is the one page that defines the evidence grades. Every other page links here.
 */
import React from 'react';
import { Citation } from '@repo/ui';
import { getDisclaimer } from '@repo/domain/disclaimers';
import { formatCitation } from '../../lib/citation/format';
import { Prose, RoomFactList, RoomJump, RoomSection } from '../../components/room';
import { TrustBand, TrustFlow, TrustLinks, TrustSheet } from '../../components/trust';
import { GradeKey, GradeMatrix, PrecisionLadder } from './MethodologyFigures';
import {
  ADMISSION_GREEN_BOOK_NOTE,
  ADMISSION_LEAD,
  ADMISSION_OWNERSHIP,
  ADMISSION_STEPS,
  CATALOG_VIEWS,
  DIGNITY_RULES,
  EDITORIAL_STANDARDS,
  GRADE_RULE_NOTES,
  GRADES_LEAD,
  INTERNET_ARCHIVE_LEAD,
  LIMITATION_RULES,
  LIVES_METHOD_LEAD,
  LIVES_METHOD_POINTS,
  LIVES_METHOD_RULES,
  LIVING_LEAD,
  METHODOLOGY_DIGNITY_LINE,
  METHODOLOGY_PAGE_SECTIONS,
  METHODOLOGY_PUBLISH_RULES,
  METHODOLOGY_SOURCE_LIBRARY_HREF,
  PRECISION_CONTEXT,
  PRECISION_LEAD,
  RECORD_ANATOMY_STEPS,
  SOURCE_LIBRARY_LEAD,
  STRUCTURE_LEAD,
  VERIFICATION_STEPS,
} from './methodology-copy';

void React;

/** The citation format, shown once, with the letter grade the real Copy citation prints. */
const EXAMPLE_CITATION = formatCitation({
  name: 'Record name',
  place: 'City, State',
  era: 'Decade',
  grade: 'A',
  sourceCount: 2,
  url: 'https://blackstory.app/place/example',
  accessed: new Date('2026-01-01T00:00:00Z'),
});

function Lead({ children }: { readonly children: React.ReactNode }) {
  return <p className="ds-trust-lead">{children}</p>;
}

function PlainList({
  items,
  label,
}: {
  readonly items: readonly string[];
  readonly label: string;
}) {
  return (
    <ul className="ds-trust-list" aria-label={label}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function MethodologySections() {
  const disclaimer = getDisclaimer('site_wide');

  return (
    <>
      <TrustSheet>
        <RoomJump sections={METHODOLOGY_PAGE_SECTIONS} />

        <RoomSection id="how-a-record-gets-in" title="How a record gets in">
          <Lead>{ADMISSION_LEAD}</Lead>
          <TrustFlow
            caption="From a lead to a public page"
            steps={ADMISSION_STEPS}
            note={ADMISSION_GREEN_BOOK_NOTE}
          />
          <Prose>
            <p>{ADMISSION_OWNERSHIP}</p>
          </Prose>
          <RoomFactList items={METHODOLOGY_PUBLISH_RULES} />
          <h3 className="ds-trust-subhead">How a claim is verified</h3>
          <PlainList items={VERIFICATION_STEPS} label="How a claim is verified" />
        </RoomSection>

        <RoomSection id="evidence-grades" title="What the evidence grades mean">
          <Lead>{GRADES_LEAD}</Lead>
          <GradeKey />
          <GradeMatrix />
          <PlainList items={GRADE_RULE_NOTES} label="How the grade rule reads its inputs" />
          <p className="ds-trust-note">
            Every citation on the site is built the same way, including the one the Copy citation
            command puts on your clipboard. Here is one.
          </p>
          <Citation label="Example citation" source={EXAMPLE_CITATION} />
        </RoomSection>

        <RoomSection id="editorial-standards" title="Editorial standards">
          <RoomFactList items={EDITORIAL_STANDARDS} />
        </RoomSection>

        <RoomSection
          id="how-a-point-is-drawn"
          title="Why a point is never drawn sharper than its source"
        >
          <Lead>{PRECISION_LEAD}</Lead>
          <Prose>
            <p>{PRECISION_CONTEXT}</p>
          </Prose>
          <PrecisionLadder />
          <h3 className="ds-trust-subhead">The rules a point follows</h3>
          <PlainList items={DIGNITY_RULES} label="Map dignity rules" />
          <h3 className="ds-trust-subhead">What the map and the grades cannot tell you</h3>
          <PlainList items={LIMITATION_RULES} label="Limitations" />
        </RoomSection>
      </TrustSheet>

      {/* The page changes ground between chapters: how a record is built stands on sand, and the
          rule that protects living people on its own ink band. */}
      <TrustBand tone="sand">
        <RoomSection id="how-it-holds-together" title="How it holds together">
          <Lead>{STRUCTURE_LEAD}</Lead>
          <TrustFlow caption="What one record is made of" steps={RECORD_ANATOMY_STEPS} />
          <dl className="ds-trust-dl ds-trust-dl--split" aria-label="One catalog, three ways in">
            {CATALOG_VIEWS.map((view) => (
              <div key={view.title}>
                <dt>{view.title}</dt>
                <dd>{view.body}</dd>
              </div>
            ))}
          </dl>
        </RoomSection>
      </TrustBand>

      <TrustSheet>
        <RoomSection id="lives-across-decades" title="Lives across the decades">
          <Lead>{LIVES_METHOD_LEAD}</Lead>
          <PlainList items={LIVES_METHOD_POINTS} label="How Lives reads its figures" />
          <RoomFactList items={LIVES_METHOD_RULES} />
          <TrustLinks
            links={[
              {
                href: '/lives',
                title: 'Lives',
                line: 'Published counts beside sourced voices, places, laws and records.',
              },
              {
                href: '/data',
                title: 'Data',
                line: 'The national indicator charts, each with its source and limits.',
              },
            ]}
          />
        </RoomSection>

        <RoomSection id="where-the-evidence-comes-from" title="Where the evidence comes from">
          <Lead>{SOURCE_LIBRARY_LEAD}</Lead>
          <TrustLinks
            links={[
              {
                href: METHODOLOGY_SOURCE_LIBRARY_HREF,
                title: 'Open the source library',
                line: 'Every publisher the archive cites, how many records cite it, and how a URL becomes a citation.',
              },
            ]}
          />
        </RoomSection>
      </TrustSheet>

      <TrustBand tone="ink" fixed>
        <RoomSection id="living-person-protection" title="Living person protection">
          <Lead>{LIVING_LEAD}</Lead>
          <Prose>
            <p>{METHODOLOGY_DIGNITY_LINE}</p>
            <p>
              Some of the people this rule exists for are named on the memorial wall, which holds a
              name and nothing else.
            </p>
          </Prose>
          <TrustLinks
            links={[{ href: '/memorial', title: 'The memorial wall', line: 'A name, held.' }]}
          />
        </RoomSection>
      </TrustBand>

      <TrustSheet>
        <RoomSection id="internet-archive" title="Internet Archive handoff">
          <Lead>{INTERNET_ARCHIVE_LEAD}</Lead>
          <Prose>
            <p>
              When a citation points to the Internet Archive or the Wayback Machine, the record page
              lists those archived copies beside the bibliography.
            </p>
            <p>
              Nothing goes to the Internet Archive automatically. Cited public pages are saved
              through the Wayback Machine, and a curated research export can be set aside for a
              person to review before anything is uploaded. The public site never uploads anything
              by itself.
            </p>
          </Prose>
        </RoomSection>

        <p className="ds-trust-foot">
          {disclaimer.body} Language reviewed {disclaimer.reviewDate}.
        </p>
      </TrustSheet>
    </>
  );
}
