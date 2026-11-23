/**
 * `/faq`: the questions a stranger asks before deciding whether to trust this, grouped by
 * topic, each a native disclosure with its own address (`/faq#do-i-need-an-account`).
 *
 * Questions are closed by default so the page reads as the list of questions it is; each
 * answer opens on its one-sentence answer. Native `<details>`, so it works before hydration
 * and with JavaScript off, and the browser's find-in-page searches the closed answers.
 *
 * COPY LIVES IN `faq-copy.ts`, including the checkable-claim ledger in its header comment.
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room, RoomJump, RoomSection } from '../../components/room';
import { TrustMast, TrustSheet } from '../../components/trust';
import { FAQ_ENTRIES, FAQ_LEDE, FAQ_SECTIONS, faqEntryId, type FaqLink } from './faq-copy';
import { FaqHashOpener } from './FaqHashOpener';
import '../reading-room.css';
import '../../components/trust/trust.css';
import './faq.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/faq',
  title: 'Questions',
  description:
    'Who makes BlackStory, how AI is and isn’t used, how a record gets in, what a grade means, why coverage is uneven, and how to report an error.',
});

/** An internal room link, a mailto, or an off-site page. Only the first needs the client router. */
function FaqLinkRow({ link }: { readonly link: FaqLink }) {
  if (link.href.startsWith('mailto:')) return <a href={link.href}>{link.label}</a>;
  if (/^https?:\/\//.test(link.href)) {
    return (
      <a href={link.href} rel="noopener noreferrer">
        {link.label}
      </a>
    );
  }
  return <Link href={link.href}>{link.label}</Link>;
}

export default function FaqPage() {
  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast
          numeral={{
            value: String(FAQ_ENTRIES.length),
            label: 'questions, each with its own address',
          }}
        >
          <PageHeader
            display
            crumb={parentCrumb('/faq')}
            linkAs={Link}
            title="The questions people actually ask"
            dek={FAQ_LEDE}
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <RoomJump
          sections={FAQ_SECTIONS.map((section) => ({ id: section.id, label: section.heading }))}
        />
        <FaqHashOpener />

        {FAQ_SECTIONS.map((section) => (
          <RoomSection key={section.id} id={section.id} title={section.heading}>
            <div className="ds-faq">
              {section.entries.map((entry) => {
                const [first, ...rest] = entry.answer;
                return (
                  <details key={entry.question} id={faqEntryId(entry)} className="ds-faq__item">
                    <summary className="ds-faq__question">
                      <h3>{entry.question}</h3>
                      <svg className="ds-faq__chevron" viewBox="0 0 16 16" aria-hidden="true">
                        <path
                          d="m4 6 4 4 4-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </summary>
                    <div className="ds-faq__answer">
                      <p className="ds-faq__lead">{first}</p>
                      {rest.map((paragraph) => (
                        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                      ))}
                      {entry.links === undefined ? null : (
                        <ul className="ds-faq__links" aria-label="Read more">
                          {entry.links.map((link) => (
                            <li key={link.href}>
                              <FaqLinkRow link={link} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </RoomSection>
        ))}

        <p className="ds-trust-foot">
          A question that isn’t here? <Link href="/support">Ask it directly</Link>.
        </p>
      </TrustSheet>
    </Room>
  );
}
