/**
 * Law detail page sections: anatomy strip, explainer body, provenance, and depart links.
 *
 * Room kit edition: every section below is a hairline-divided block on the page ground,
 * the same vocabulary `.ds-room-prose h2` and `GroupHeading` use elsewhere — not a
 * route-owned Surface-card panel.
 */
import React from 'react';
import type { LegalPlainLanguageExplainer } from '@repo/domain';
import type { SEED_LEGAL_SNAPSHOTS } from '../../data/legal-seed';
import {
  LegalDisclaimer,
  LegalExplainerSections,
  LegalStatusBadge,
  humanizeLegalKind,
} from '../../components/legal';
import { GroupHeading, OffRamp, RoomHeader } from '../../components/room';
import { LawAnatomyStrip } from './LawAnatomyStrip';
import { jurisdictionLabel } from './LawBrowseSections';
import { jurisdictionLabel } from './LawBrowseSections';

const DETAIL_SECTIONS = [
  { id: 'what-it-says', label: 'What it says' },
  { id: 'what-it-means', label: 'What it means' },
  { id: 'why-it-matters', label: 'Why it matters' },
  { id: 'rights-today', label: 'Your rights today' },
  { id: 'primary-sources', label: 'Primary sources' },
  { id: 'provenance', label: 'Provenance' },
] as const;

export type LawDetailSectionsProps = {
  readonly snapshot: (typeof SEED_LEGAL_SNAPSHOTS)[number];
  readonly explainer?: LegalPlainLanguageExplainer;
};

export function LawDetailSections({ snapshot, explainer }: LawDetailSectionsProps) {
  return (
    <>
      <LegalDisclaimer />

      {explainer ? (
        <nav className="ds-law-toc" aria-labelledby="law-detail-toc-title">
          <p className="ds-room-grouphd" id="law-detail-toc-title">
            On this page
          </p>
          <ul className="ds-law-toc__list">
            {DETAIL_SECTIONS.map((section) => (
              <li key={section.id}>
                <a className="ds-law-toc__link" href={`#${section.id}`}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {explainer ? (
        <section className="ds-law-section" aria-labelledby="explainer-heading">
          <GroupHeading>
            <span id="explainer-heading">Plain-language sections</span>
          </GroupHeading>
          <LegalExplainerSections
            explainer={explainer}
            citation={snapshot.citation.canonicalCitation}
            statusBadge={<LegalStatusBadge status={snapshot.lawStatus} />}
          />
        </section>
      ) : (
        <section className="ds-law-section" aria-labelledby="pending-explainer">
          <GroupHeading>
            <span id="pending-explainer">Plain-language explainer pending</span>
          </GroupHeading>
          <p className="ds-room-prose" style={{ marginTop: 'var(--ds-space-3)' }}>
            Editorial review is in progress. Primary source:{' '}
            <a href={snapshot.citation.archive.sourceUrl} rel="noopener noreferrer" target="_blank">
              {snapshot.citation.archive.sourceUrl}
            </a>
          </p>
        </section>
      )}

      <section className="ds-law-section" aria-labelledby="provenance-heading" id="provenance">
        <GroupHeading>
          <span id="provenance-heading">Archived capture</span>
        </GroupHeading>
        <p className="ds-law-toc__lede">
          {humanizeLegalKind(snapshot.kind)} · {jurisdictionLabel(snapshot.jurisdictionId)}
        </p>
        <dl className="ds-law-provenance">
          <div className="ds-law-provenance__row">
            <dt>Retrieved</dt>
            <dd>{snapshot.citation.archive.retrievedAt.split('T')[0]}</dd>
          </div>
          <div className="ds-law-provenance__row">
            <dt>License</dt>
            <dd>{snapshot.citation.licenseTag}</dd>
          </div>
          <div className="ds-law-provenance__row">
            <dt>Archived copy</dt>
            <dd>
              <a
                href={snapshot.citation.archive.archivedCaptureUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                View archived capture
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <OffRamp
        title="Keep going"
        actions={[
          { label: 'All law entries', href: '/law' },
          { label: 'Methodology', href: '/methodology' },
        ]}
      >
        BlackStory explains public laws and court decisions in plain language, not legal advice.
      </OffRamp>
    </>
  );
}

export type LawDetailIntroProps = {
  readonly snapshot: (typeof SEED_LEGAL_SNAPSHOTS)[number];
};

export function LawDetailIntro({ snapshot }: LawDetailIntroProps) {
  return (
    <>
      <RoomHeader
        pathname={`/law/${snapshot.id}`}
        crumbLabel={snapshot.title}
        kicker="Reference"
        title={snapshot.title}
        showPath={false}
      />
      <LawAnatomyStrip
        kind={snapshot.kind}
        lawStatus={snapshot.lawStatus}
        jurisdictionId={snapshot.jurisdictionId}
        citation={snapshot.citation.canonicalCitation}
        topics={snapshot.topics}
      />
    </>
  );
}
