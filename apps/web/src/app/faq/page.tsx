/**
 * `/faq` — the questions a stranger asks before deciding whether to trust this.
 *
 * Rendered through the v9 room kit on the reading-room surface, the same build as `/about` and
 * `/methodology`: `Room` for the column, `RoomHeader` for the mast, `GroupHeading` per section,
 * `Prose` for the answers, `WalkOffRamp` at the foot. No page-local stylesheet: the questions are
 * `h3` and the answers are paragraphs, both of which `room-kit.css` already styles inside `Prose`,
 * and a new `faq.css` would only restyle what the kit hands over.
 *
 * NOT DISCLOSURES. Every answer is open on the page. A FAQ built out of collapsed drawers hides
 * the two answers that matter most here (who runs this, and how AI is used) behind a click, and
 * hiding those is the opposite of what this page is for. The contents list at the top is the
 * navigation instead.
 *
 * COPY LIVES IN `faq-copy.ts`, including the checkable-claim ledger in its header comment. Nothing
 * on this page asserts anything the repository does not already do.
 */

import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { WalkOffRamp } from '../walk-off-ramp';
import { GroupHeading, Prose, Room, RoomHeader } from '../../components/room';
import { FAQ_LEDE, FAQ_SECTIONS } from './faq-copy';
import '../reading-room.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/faq',
  title: 'Questions',
  description:
    'Who makes BlackStory, how AI is and is not used, how a record gets in, what a confidence grade means, why coverage is uneven, and how to report an error.',
});

/** An internal room link, or a mailto. Only the first needs the client router. */
function FaqLinkRow({ href, label }: { readonly href: string; readonly label: string }) {
  if (href.startsWith('mailto:')) return <a href={href}>{label}</a>;
  return <Link href={href}>{label}</Link>;
}

export default function FaqPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/faq"
        kicker="Questions"
        title={
          <>
            The questions people actually <em>ask</em>.
          </>
        }
        lede={FAQ_LEDE}
        showPath={false}
      />

      <nav aria-labelledby="faq-contents-title">
        <GroupHeading>
          <span id="faq-contents-title">On this page</span>
        </GroupHeading>
        <Prose>
          <ul>
            {FAQ_SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.heading}</a>
              </li>
            ))}
          </ul>
        </Prose>
      </nav>

      {FAQ_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
          <GroupHeading>
            <span id={`${section.id}-heading`}>{section.heading}</span>
          </GroupHeading>
          <Prose>
            {section.entries.map((entry) => (
              <React.Fragment key={entry.question}>
                <h3>{entry.question}</h3>
                {entry.answer.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
                {entry.links === undefined ? null : (
                  <p>
                    {entry.links.map((link, index) => (
                      <React.Fragment key={link.href}>
                        {index === 0 ? null : ' · '}
                        <FaqLinkRow href={link.href} label={link.label} />
                      </React.Fragment>
                    ))}
                  </p>
                )}
              </React.Fragment>
            ))}
          </Prose>
        </section>
      ))}

      <WalkOffRamp
        title="Still stuck"
        extra={[
          { label: 'Request a correction', href: '/corrections' },
          { label: 'Submit a lead', href: '/submit' },
        ]}
      >
        If your question is about one particular record, the corrections lane is the fastest way to
        get a person reading it against the sources.
      </WalkOffRamp>
    </Room>
  );
}
