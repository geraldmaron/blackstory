/**
 * About body sections, composed into the `/about` room. The parent room owns the PageHeader.
 *
 * Each section opens on its strongest sentence (the first paragraph is set as the lead), the
 * writing process is drawn as the steps it is, and onward links are flat rows. The map
 * placeholder this page used to carry is replaced by a real figure: published records by state.
 */
import React from 'react';
import { MakerCredit } from '../../components/MakerCredit';
import { cardTitleFor, destinationsInGroup } from '../../lib/nav/destination-registry';
import {
  ABOUT_CONTRIBUTE,
  ABOUT_NEO,
  ABOUT_ORIGIN,
  ABOUT_PILLARS,
  ABOUT_REFUSALS,
  ABOUT_STANCE,
  ABOUT_COLLECTIONS_HANDOFF,
  ABOUT_SOURCE_LIBRARY_HANDOFF,
} from './about-copy';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import { Prose, FactList, ContentsList, PageSection } from '../../components/page';
import { TrustBand, TrustFlow, TrustLinks, TrustSheet } from '../../components/trust';
import { RecordsByState, type StateCount } from './RecordsByState';

void React;

const ABOUT_JUMP = [
  { id: 'origin', label: 'Why this exists' },
  { id: 'stance', label: 'How I mean this' },
  { id: 'pillars', label: 'What records stand on' },
  { id: 'neo', label: 'How writing is made' },
  { id: 'refusals', label: 'What it won’t do' },
  { id: 'contribute', label: 'Add to it' },
  { id: 'begin', label: 'Where to begin' },
] as const;

/** The first paragraph as the section's answer, the rest as prose. */
function LeadThenProse({ paragraphs }: { readonly paragraphs: readonly string[] }) {
  const [lead, ...rest] = paragraphs;
  return (
    <>
      <p className="ds-trust-lead">{lead}</p>
      {rest.length > 0 ? (
        <Prose>
          {rest.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </Prose>
      ) : null}
    </>
  );
}

export type AboutSectionsProps = {
  /** Records per state for the figure; absent when the catalog could not be read. */
  readonly states?: { readonly counts: readonly StateCount[]; readonly total: number };
};

export function AboutSections({ states }: AboutSectionsProps) {
  const takePart = destinationsInGroup('take-part');
  // About is the hub for the trust pages; it does not list itself.
  const decides = destinationsInGroup('check').filter((destination) => destination.id !== 'about');

  return (
    <>
      <TrustSheet>
        <ContentsList sections={ABOUT_JUMP} />

        <PageSection id="origin" title="Why this exists">
          <LeadThenProse paragraphs={ABOUT_ORIGIN} />
        </PageSection>

        <PageSection id="stance" title={ABOUT_STANCE.heading}>
          <LeadThenProse paragraphs={ABOUT_STANCE.paragraphs} />
          <Prose>
            <p>
              {ABOUT_STANCE.maker.lead}{' '}
              <a href={ABOUT_STANCE.maker.href} rel="noopener noreferrer">
                {ABOUT_STANCE.maker.label}
              </a>
              .
            </p>
          </Prose>
        </PageSection>

        <PageSection id="pillars" title="What every record stands on">
          <p className="ds-trust-lead">
            Four rules travel with every record, enforced where the record is built, so you can
            check each one on any record page instead of taking it on faith.
          </p>
          {states === undefined || states.counts.length === 0 ? null : (
            <RecordsByState states={states.counts} totalRecords={states.total} />
          )}
          <FactList items={ABOUT_PILLARS} />
          <TrustLinks
            links={[
              {
                href: ABOUT_SOURCE_LIBRARY_HANDOFF.href,
                title: ABOUT_SOURCE_LIBRARY_HANDOFF.label,
                line: 'Every publisher the archive cites, and how many records cite it.',
              },
              {
                href: '/methodology#evidence-grades',
                title: 'What the grades mean',
                line: 'The one rule that sets a record’s grade, and what moves it.',
              },
            ]}
          />
        </PageSection>
      </TrustSheet>

      {/* How the writing is made stands on its own ink band, and what the archive will not do on
          sand: the page changes ground between chapters instead of running one sheet. */}
      <TrustBand tone="ink" fixed>
        <PageSection id="neo" title={ABOUT_NEO.heading}>
          <Prose>
            {ABOUT_NEO.rules.slice(0, 2).map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </Prose>
          <TrustFlow caption="What every piece of writing goes through" steps={ABOUT_NEO.steps} />
          <Prose>
            {ABOUT_NEO.rules.slice(2).map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            {ABOUT_NEO.human.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            <p>{ABOUT_NEO.hand}</p>
            <p>{ABOUT_NEO.photographs}</p>
          </Prose>
        </PageSection>
      </TrustBand>

      <TrustBand tone="sand">
        <PageSection id="refusals" title="What it won’t do">
          <ul className="ds-trust-list" aria-label="What it won’t do">
            {ABOUT_REFUSALS.map((refusal) => {
              const stop = refusal.indexOf('. ');
              return (
                <li key={refusal.slice(0, 40)}>
                  <strong>{stop > 0 ? refusal.slice(0, stop + 1) : refusal}</strong>
                  {stop > 0 ? ` ${refusal.slice(stop + 2)}` : null}
                </li>
              );
            })}
          </ul>
          <TrustLinks
            links={[
              {
                href: '/methodology',
                title: 'Methodology',
                line: 'How each of those is decided.',
              },
              {
                href: '/errata',
                title: 'Errata',
                line: 'Everything the archive has already gotten wrong and fixed.',
              },
            ]}
          />
        </PageSection>
      </TrustBand>

      <TrustSheet>
        <PageSection id="contribute" title={ABOUT_CONTRIBUTE.heading}>
          <LeadThenProse paragraphs={[ABOUT_CONTRIBUTE.lede, ABOUT_CONTRIBUTE.terms]} />
          <Prose>
            <p>
              {ABOUT_CONTRIBUTE.direct} <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a>
            </p>
          </Prose>
          <TrustLinks
            label="Ways to add to it"
            links={takePart.map((destination) => ({
              href: destination.path,
              title: cardTitleFor(destination),
              ...(destination.description === undefined ? {} : { line: destination.description }),
            }))}
          />
        </PageSection>

        <PageSection id="decides" title="How it decides">
          <TrustLinks
            label="How the archive decides"
            links={decides.map((destination) => ({
              href: destination.path,
              title: cardTitleFor(destination),
              ...(destination.description === undefined ? {} : { line: destination.description }),
            }))}
          />
        </PageSection>

        <PageSection id="begin" title="Where to begin">
          <p className="ds-trust-lead">{ABOUT_COLLECTIONS_HANDOFF.lede}</p>
          <TrustLinks
            links={[
              {
                href: ABOUT_COLLECTIONS_HANDOFF.href,
                title: ABOUT_COLLECTIONS_HANDOFF.label,
                line: ABOUT_COLLECTIONS_HANDOFF.line,
              },
            ]}
          />
        </PageSection>

        <div className="ds-about-page__foot">
          <MakerCredit variant="inline" />
        </div>
      </TrustSheet>
    </>
  );
}
