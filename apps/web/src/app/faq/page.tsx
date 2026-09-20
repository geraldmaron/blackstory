/**
 * `/faq` — the questions a stranger asks before deciding whether to trust this.
 *
 * Rendered through the v9 room kit on the reading-room surface. Questions stay open on the page:
 * a FAQ built out of collapsed drawers would hide the two answers that matter most (who runs
 * this, and how AI is used). The jump nav is the table of contents.
 *
 * COPY LIVES IN `faq-copy.ts`, including the checkable-claim ledger in its header comment. Nothing
 * on this page asserts anything the repository does not already do.
 */

import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { WalkOffRamp } from '../walk-off-ramp';
import {
  Prose,
  Room,
  ReadingEntry,
  RoomJump,
  RoomSection,
  roomSectionTone,
} from '../../components/room';
import { FAQ_LEDE, FAQ_SECTIONS } from './faq-copy';
import '../reading-room.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/faq',
  title: 'Questions',
  description:
    'Who makes BlackStory, how AI is and is not used, how a record gets in, what a confidence grade means, why coverage is uneven, and how to report an error.',
});

/** An internal room link, a mailto, or an off-site page. Only the first needs the client router. */
function FaqLinkRow({ href, label }: { readonly href: string; readonly label: string }) {
  if (href.startsWith('mailto:')) return <a href={href}>{label}</a>;
  if (href.startsWith('https://') || href.startsWith('http://')) {
    return (
      <a href={href} rel="noopener noreferrer">
        {label}
      </a>
    );
  }
  return <Link href={href}>{label}</Link>;
}

export default function FaqPage() {
  return (
    <Room>
      <ReadingEntry
        pathname="/faq"
        title={
          <>
            The questions people actually <em>ask</em>.
          </>
        }
        lede={FAQ_LEDE}
      />

      <RoomJump
        sections={FAQ_SECTIONS.map((section) => ({
          id: section.id,
          label: section.heading,
          icon: section.icon,
        }))}
      />

      {FAQ_SECTIONS.map((section, index) => (
        <RoomSection
          key={section.id}
          id={section.id}
          icon={section.icon}
          kicker={section.kicker}
          title={section.heading}
          tone={roomSectionTone(index)}
        >
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
        </RoomSection>
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
