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
import { GroupHeading, OffRamp, RecordNav, ReadingEntry } from '../../components/room';
import type { RecordNavTarget } from '../../components/room';
import { buildLensHandoff } from '../../lib/map-experience/lens-handoff';
import { LawAnatomyStrip } from './LawAnatomyStrip';
import { jurisdictionLabel, statePostalForJurisdiction } from './LawBrowseSections';
import type { LawNavTarget } from './law-view-model';

const DETAIL_SECTIONS = [
  { id: 'what-it-says', label: 'What it says' },
  { id: 'what-it-means', label: 'What it means' },
  { id: 'why-it-matters', label: 'Why it matters' },
  { id: 'rights-today', label: 'Your rights today' },
  { id: 'primary-sources', label: 'Primary sources' },
  { id: 'provenance', label: 'Provenance' },
] as const;

/**
 * The decade bucket a law's `effectiveYear` falls in, in the exact `"1960s"` shape Explore's
 * `era` facet expects (`lib/map-experience/filters.ts`). Undated laws (no `effectiveYear`) hand
 * off on jurisdiction alone rather than guessing an era.
 */
function eraBucketForYear(year: number | undefined): string | undefined {
  return year === undefined ? undefined : `${Math.floor(year / 10) * 10}s`;
}

/**
 * Builds the "Records in this jurisdiction and era" hand-off (docs/ui/patterns-lens-handoff.md
 * §2, design-direction-v9-surfaces.md §4.3). The subject carries only jurisdiction (as a state
 * postal code, when the law is a state law) and era (as a decade bucket) — never a documented
 * edge, because the catalog holds none between a law and a record. The reason string names
 * exactly that and nothing more; `buildLensHandoff` throws `CausalReasonStringError` if it ever
 * drifts into implying the archive documented cause and effect here.
 */
function buildLawRecordsHandoff(snapshot: (typeof SEED_LEGAL_SNAPSHOTS)[number]) {
  const jurisdiction = jurisdictionLabel(snapshot.jurisdictionId);
  const statePostal = statePostalForJurisdiction(snapshot.jurisdictionId);
  const era = eraBucketForYear(snapshot.effectiveYear);

  const reason = era
    ? `${jurisdiction}, ${era}. Same jurisdiction and era as this law, not a documented connection to it.`
    : `${jurisdiction}. Same jurisdiction as this law, not a documented connection to it.`;

  return buildLensHandoff(
    {
      ...(statePostal ? { state: statePostal } : {}),
      ...(era ? { era } : {}),
    },
    reason,
  );
}

export type LawDetailSectionsProps = {
  readonly snapshot: (typeof SEED_LEGAL_SNAPSHOTS)[number];
  readonly explainer?: LegalPlainLanguageExplainer;
  /** The law before/after this one in `/law`'s own default order — see `buildLawDetailViewModel`. */
  readonly previous?: LawNavTarget;
  readonly next?: LawNavTarget;
};

function toRecordNavTarget(target: LawNavTarget | undefined): RecordNavTarget | undefined {
  return target ? { href: `/law/${target.slug}`, label: target.title } : undefined;
}

export function LawDetailSections({ snapshot, explainer, previous, next }: LawDetailSectionsProps) {
  const recordsHandoff = buildLawRecordsHandoff(snapshot);
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

      {/*
       * Records in this jurisdiction and era (design-direction-v9-surfaces.md §4.3,
       * patterns-lens-handoff.md §2). The heading string is the contract: it must read exactly
       * this, verbatim, because the link below it is built from jurisdiction and era, never
       * from a documented edge between a law and a record, and the heading is the reader's
       * only warning of that before they click through.
       */}
      <OffRamp
        title="Records in this jurisdiction and era"
        actions={[
          { label: 'See these records', href: recordsHandoff.href, emphasis: 'copper' },
          { label: 'Methodology', href: '/how-it-works?s=methodology' },
        ]}
      >
        {recordsHandoff.reason}
      </OffRamp>

      <RecordNav previous={toRecordNavTarget(previous)} next={toRecordNavTarget(next)} />
    </>
  );
}

export type LawDetailIntroProps = {
  readonly snapshot: (typeof SEED_LEGAL_SNAPSHOTS)[number];
};

export function LawDetailIntro({ snapshot }: LawDetailIntroProps) {
  return (
    <>
      {/*
       * Design law (design-direction-v9-surfaces.md §4.3) leads this room with a framed
       * jurisdiction plate: an outline of the state or federal reach the law governs, never a
       * point, with a precision note that a law has a jurisdiction rather than a location.
       *
       * The catalog has no state-code-to-polygon join today. `statePostalForJurisdiction`
       * (`LawBrowseSections.tsx`) resolves a law's jurisdictionId to a USPS postal code, but
       * nothing in the codebase turns that code into a renderable outline — the closest thing,
       * `packages/domain/src/map/state-boundary-geometry.ts`, exposes point-in-polygon
       * containment only, not the polygon geometry itself. The design law is explicit for
       * exactly this case: "if the state code to polygon join is not ready, this route ships
       * without the plate rather than with a fabricated one." So there is no plate here, and
       * no placeholder rectangle standing in for one, until that join exists.
       */}
      <ReadingEntry
        pathname={`/law/${snapshot.id}`}
        crumbLabel={snapshot.title}
        title={snapshot.title}
        showCrumb={false}
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
