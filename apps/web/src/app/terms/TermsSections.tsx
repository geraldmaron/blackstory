/**
 * Terms notice sections for BlackStory: scope, what the archive is and is not, use, reuse under
 * CC BY 4.0, submissions, records about a living person, copyright complaints, accuracy, the
 * liability limit, affiliate links, and the published contact.
 *
 * A NOTICE, NOT A CONTRACT. No reader of a footer link has agreed to anything (Nguyen v. Barnes
 * & Noble, 763 F.3d 1171), so a clause here that only works if the reader is bound is decoration
 * that makes the page longer and less true. Everything below is written to stand as a plain
 * statement of fact with or without assent, which is why there is no arbitration clause, no
 * class-action waiver, no indemnity, no governing law or venue, and no reservation of the right
 * to change these terms without notice.
 *
 * Two speakers, kept distinct on purpose, matching `../privacy/PrivacySections.tsx`. The site
 * states what the software does ("reading a published page never asks you to sign in"); Gerald
 * Dagher states what he will and will not do ("I acknowledge a copyright complaint within 72
 * hours"). There is no institution here, and an institutional "we" on a page about
 * accountability would be the one lie a reader has no way to check.
 */
import React from 'react';
import Link from 'next/link';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import { CORRECTION_PRIVACY_NOTICE } from '../corrections/copy';
import { RoomJump, RoomSection, roomSectionTone } from '../../components/room';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import './terms.css';

void React;

/** The license the writing on this site is published under. Named and linked, never implied. */
const LICENSE_NAME = 'Creative Commons Attribution 4.0 International (CC BY 4.0)';
const LICENSE_DEED = 'https://creativecommons.org/licenses/by/4.0/';

/**
 * The takedown windows published here are the ones the routing model already holds
 * (`packages/domain/src/rights/takedown.ts`), not a softer pair invented for a policy page.
 */
const ACKNOWLEDGEMENT_HOURS = 72;
const RESOLUTION_DAYS = 30;

const PAGE_SECTIONS: readonly {
  readonly id: string;
  readonly label: string;
  readonly icon: DestinationIconId;
}[] = [
  { id: 'scope', label: 'Scope', icon: 'about' },
  { id: 'what-this-is', label: 'What this is', icon: 'records' },
  { id: 'using', label: 'Using it', icon: 'explore' },
  { id: 'reuse', label: 'Reuse', icon: 'publication' },
  { id: 'submissions', label: 'What you send', icon: 'submit' },
  { id: 'about-you', label: 'A record about you', icon: 'person' },
  { id: 'copyright', label: 'Copyright', icon: 'correction' },
  { id: 'accuracy', label: 'Accuracy', icon: 'evidence' },
  { id: 'liability', label: 'Liability', icon: 'errata' },
  { id: 'affiliate', label: 'Affiliate links', icon: 'books' },
  { id: 'changes', label: 'Changes', icon: 'support' },
];

const NOT_THIS_RULES = [
  'Not an official record. BlackStory is not a government register, a court file, or an archive of record, and a page here proves nothing on its own.',
  'Not certification. Nothing published here is legal advice, and nothing here certifies a lineage, a title, or a claim of descent.',
  'Not a substitute for the documents it cites. Where a record names a source, the source is the authority; the record is the finding aid that points you at it.',
] as const;

export function TermsSections() {
  return (
    <div className="ds-terms">
      <RoomJump sections={PAGE_SECTIONS} />

      <RoomSection
        id="scope"
        icon="about"
        kicker="What this covers"
        title="BlackStory, and who runs it"
        tone={roomSectionTone(0)}
      >
        <p className="ds-terms__follow">
          This page covers BlackStory at <span className="ds-phrase-nowrap">blackstory.app</span>{' '}
          and the archive it publishes. It is a notice rather than an agreement: you are not asked
          to accept it, and nothing on it is written to work only if you had.
        </p>
        <p className="ds-terms__follow">
          BlackStory is run by <strong>Gerald Dagher</strong>, an individual. There is no company
          behind it. Write to <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a> about
          anything on this page.
        </p>
        <p className="ds-terms__meta">Last updated: September 2026</p>
      </RoomSection>

      <RoomSection
        id="what-this-is"
        icon="records"
        kicker="The thing itself"
        title="What this is, and what it is not"
        tone={roomSectionTone(1)}
      >
        <p className="ds-terms__follow">
          BlackStory is a free, public archive of Black American history. There is nothing to buy
          and nothing to subscribe to, and reading a published page never asks you to sign in. Every
          record is research: claims carry the sources they rest on and a stated confidence grade,
          so you can see how firmly a thing is held before you rely on it. How a record earns that
          grade is set out in the <Link href="/methodology">methodology</Link>.
        </p>
        <ol className="ds-terms__rule-strip" aria-label="What this archive is not">
          {NOT_THIS_RULES.map((rule) => (
            <li key={rule} className="ds-terms__rule-row">
              <span className="ds-terms__rule-text">{rule}</span>
            </li>
          ))}
        </ol>
      </RoomSection>

      <RoomSection
        id="using"
        icon="explore"
        kicker="Reading"
        title="Read it, link it, cite it"
        tone={roomSectionTone(2)}
      >
        <p className="ds-terms__follow">
          No permission is needed to read BlackStory, to link to any page on it, to quote it with
          attribution, or to cite it in your own work. That is what it is for, and asking would
          waste your time and mine.
        </p>
        <p className="ds-terms__follow">
          One ask, and it is an ask rather than a rule: please do not collect from the site at a
          rate that degrades it for the people trying to read it. What the site currently says to
          crawlers and to automated readers lives at <a href="/robots.txt">/robots.txt</a> and{' '}
          <a href="/ai.txt">/ai.txt</a>, and those two files are the current answer for machine
          access.
        </p>
      </RoomSection>

      <RoomSection
        id="reuse"
        icon="publication"
        kicker="License"
        title="Reusing what BlackStory writes"
        tone={roomSectionTone(3)}
      >
        <p className="ds-terms__follow">
          The writing on BlackStory is published under{' '}
          <a href={LICENSE_DEED} rel="license noopener noreferrer" target="_blank">
            {LICENSE_NAME}
          </a>
          . Copy it, republish it, translate it, quote it at length, build something else on top of
          it, commercially or not. The condition is credit: name BlackStory and link back to the
          page you took it from, and say if you changed it.
        </p>
        <p className="ds-terms__follow">
          That license reaches the writing and the selection, because that is all a license can
          reach. The facts in a record belong to nobody. A date, a name, a street address, a count
          of who was there: those are not anyone&apos;s property, and you may use them with no
          license at all and no credit owed. What was made here is the prose, the arrangement, and
          the judgment about what to include and what to leave out, and that is the part CC BY 4.0
          asks you to credit.
        </p>
        <p className="ds-terms__follow">
          The license does not reach material that is not BlackStory&apos;s to license. Photographs,
          scanned documents, book cover images, and map tiles come from third parties on their own
          terms, and each record names the source and the terms for the material it displays.
          Displayed third-party material comes from Wikimedia Commons, Open Library, the Internet
          Archive, USGS National Map imagery, and OpenStreetMap by way of OpenMapTiles. Check the
          record, and then the source, before reusing an image or a tile.
        </p>
      </RoomSection>

      <RoomSection
        id="submissions"
        icon="submit"
        kicker="Submissions"
        title="Corrections, leads, and what happens to what you send"
        tone={roomSectionTone(4)}
      >
        <p className="ds-terms__follow">
          You can file a correction, send a research lead, appeal a closed correction, or report
          abuse. Nothing you send appears on the public site as you sent it, and nothing you send is
          visible to other readers.
        </p>
        <blockquote className="ds-terms__quote" cite="/corrections">
          <p className="ds-terms__quote-text">{CORRECTION_PRIVACY_NOTICE.body}</p>
          <footer className="ds-terms__quote-source">
            <Link href="/corrections">{CORRECTION_PRIVACY_NOTICE.title}, corrections page</Link>
          </footer>
        </blockquote>
        <p className="ds-terms__follow">
          You get a receipt code, a status you can check with it, and one appeal if a correction is
          closed and you think the outcome was wrong. What you send may be used to correct or extend
          a published record. Send only material you are free to send, and leave out a living
          person&apos;s home address or other sensitive details unless the correction genuinely
          turns on them. Start at the <Link href="/corrections">corrections lane</Link> for
          something already published, or <Link href="/submit">submit a lead</Link> for something
          that is not.
        </p>
      </RoomSection>

      <RoomSection
        id="about-you"
        icon="person"
        kicker="If it is about you"
        title="If a record about you is wrong"
        tone={roomSectionTone(5)}
        className="ds-terms__section--flagged"
      >
        <p className="ds-terms__follow">
          Tell me. Use the <Link href="/corrections">corrections lane</Link> and say what is wrong
          and which page it is on, or write to{' '}
          <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a> if you would rather not use a
          form.
        </p>
        <p className="ds-terms__follow">
          A person reads it, not a filter, and the form carries a category for a living-person
          precision or sensitivity concern so it is flagged as one from the start. If the record is
          wrong it gets fixed, and the fix is published in the{' '}
          <Link href="/errata">errata log</Link> rather than quietly swapped in. If it turns out to
          be right, you get told that and why, and you can appeal it once.
        </p>
      </RoomSection>

      <RoomSection
        id="copyright"
        icon="correction"
        kicker="Rights complaints"
        title="If something published here is yours"
        tone={roomSectionTone(6)}
      >
        <p className="ds-terms__follow">
          Write to <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a>. Say what the
          material is, give the address of the page it is on, say what right you hold in it, and
          leave a way to reach you.
        </p>
        <p className="ds-terms__follow">
          I acknowledge a copyright complaint within {ACKNOWLEDGEMENT_HOURS} hours and reach a
          decision within {RESOLUTION_DAYS} days. Material found to be infringing is removed. If I
          think the use was lawful I will say so and say why, and the material stays up while that
          is settled.
        </p>
      </RoomSection>

      <RoomSection
        id="accuracy"
        icon="evidence"
        kicker="Accuracy"
        title="Accuracy, and the limits of this archive"
        tone={roomSectionTone(7)}
      >
        <p className="ds-terms__follow">
          The research here is provided as it stands, without warranty of completeness or currency.
          Sources sit on the record itself so you can check the work rather than take it on trust,
          and records change as the evidence changes: a confidence grade moves, a claim gets
          withdrawn, a date gets narrowed. A gap is not a finding either. A place with no record
          here usually means nobody has done that work yet.
        </p>
        <p className="ds-terms__follow">
          That paragraph describes the archive; it does not excuse it. A disclaimer does not make a
          wrong record less wrong, and it does not relieve me of the work of putting it right. If
          something here is inaccurate, the answer is a correction, not this sentence.
        </p>
      </RoomSection>

      <RoomSection
        id="liability"
        icon="errata"
        kicker="Liability"
        title="Limits on liability"
        tone={roomSectionTone(8)}
      >
        <p className="ds-terms__follow">
          BlackStory is free to read and is run by one person rather than a company. To the extent
          the law allows, I am not liable for indirect or consequential loss arising from the use of
          this archive.
        </p>
      </RoomSection>

      <RoomSection
        id="affiliate"
        icon="books"
        kicker="Money"
        title="Affiliate links"
        tone={roomSectionTone(9)}
      >
        <p className="ds-terms__follow">
          Some book pages link to Bookshop.org through an affiliate program, and a purchase made
          through one of those links pays BlackStory a commission. Nothing here is paid placement:
          the affiliate relationship never decides which books appear or what a record says about
          them.
        </p>
      </RoomSection>

      <RoomSection
        id="changes"
        icon="support"
        kicker="Updates"
        title="Changes and contact"
        tone={roomSectionTone(10)}
      >
        <p className="ds-terms__follow">
          A material change to this notice is posted here, with a new date at the top. For a
          question about anything on this page, or about how the archive runs, write to{' '}
          <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a> or use the{' '}
          <Link href="/support">support page</Link>. For how information is handled, see the{' '}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </RoomSection>
    </div>
  );
}
