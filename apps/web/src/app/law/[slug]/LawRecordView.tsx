/**
 * A law entry on the shared record anatomy: masthead, citation line, rail, record file. Its own
 * body (what the law means, why it matters, the rights it gives today) arrives as body beats.
 *
 * A law has a jurisdiction, not a location, so the rail carries no map. The design law asks for
 * a jurisdiction outline, but the catalog has no state-code-to-polygon join yet, and the rule for
 * exactly that case is to ship without the plate rather than fake one. The map action opens the
 * records sharing the law's state and era, and its label says exactly that ("Georgia records from
 * the 2020s on the map"), never that the law itself is on the map; `buildLensHandoff` refuses a
 * reason that implies cause.
 */
import React from 'react';
import Link from 'next/link';
import {
  faCalendar,
  faCircleHalfStroke,
  faLandmark,
  faScaleBalanced,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  formatRecordDate,
  RecordBeat,
  RecordConnections,
  RecordPage,
  RecordProse,
  type RecordFileRow,
  type RecordMetaItem,
} from '../../../components/patterns/RecordPage';
import { EvidenceList, type EvidenceItem } from '../../../components/evidence/EvidenceList';
import { METHODOLOGY_HOW_RECORD_GETS_IN_HREF } from '../../../components/evidence/editorial-links';
import { LEGAL_DISCLAIMER_BODY, LEGAL_SECTION_LABELS } from '../../../components/legal/copy';
import {
  humanizeLegalKind,
  humanizeLegalTopic,
  legalStatusDisplay,
} from '../../../components/legal/format';
import { buildLensHandoff } from '../../../lib/map-experience/lens-handoff';
import type { LegalSnapshotDocument } from '../../../lib/legal/public-source';
import { jurisdictionLabel, statePostalForJurisdiction } from '../LawBrowseSections';
import type { LawDetailViewModel } from '../law-view-model';

void React;

type LawView = Extract<LawDetailViewModel, { readonly kind: 'ok' }>;

/** The decade a law's `effectiveYear` falls in, in the `"1960s"` shape Explore's era facet takes. */
function eraBucketForYear(year: number | undefined): string | undefined {
  return year === undefined ? undefined : `${Math.floor(year / 10) * 10}s`;
}

/**
 * The map hand-off: records in the law's state (a state law) and decade, never a documented edge,
 * because the catalog holds none between a law and a record. The label is the whole claim: it names
 * exactly the filter the link applies. A federal law with no year has nothing to narrow on, so it
 * has no map action.
 */
export function buildLawRecordsHandoff(snapshot: LegalSnapshotDocument) {
  const statePostal = statePostalForJurisdiction(snapshot.jurisdictionId);
  const era = eraBucketForYear(snapshot.effectiveYear);
  if (!statePostal && !era) return undefined;
  const records = statePostal ? `${jurisdictionLabel(snapshot.jurisdictionId)} records` : 'Records';
  const label = era ? `${records} from the ${era} on the map` : `${records} on the map`;
  const handoff = buildLensHandoff(
    {
      ...(statePostal ? { state: statePostal } : {}),
      ...(era ? { era } : {}),
    },
    label,
  );
  return { href: handoff.href, label };
}

/** "public-domain" → "Public domain": a license tag a reader can read. */
function licenseWords(tag: string): string {
  const words = tag.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function LawRecordView({ snapshot, explainer, previous, next }: LawView) {
  const handoff = buildLawRecordsHandoff(snapshot);
  const jurisdiction = jurisdictionLabel(snapshot.jurisdictionId);

  const meta: RecordMetaItem[] = [
    { label: humanizeLegalKind(snapshot.kind), icon: faScaleBalanced },
    { label: jurisdiction, icon: faLandmark },
    ...(snapshot.effectiveYear
      ? [{ label: String(snapshot.effectiveYear), icon: faCalendar }]
      : []),
    { label: legalStatusDisplay(snapshot.lawStatus), icon: faCircleHalfStroke },
  ];

  const sources: EvidenceItem[] = (
    explainer?.primarySources.length
      ? explainer.primarySources.map((source) => ({
          title: source.label,
          href: source.url,
          ...(source.archivedUrl ? { archivedUrl: source.archivedUrl } : {}),
          note: licenseWords(source.licenseTag),
        }))
      : [
          {
            title: snapshot.citation.canonicalCitation,
            href: snapshot.citation.archive.sourceUrl,
            archivedUrl: snapshot.citation.archive.archivedCaptureUrl,
            note: licenseWords(snapshot.citation.licenseTag),
          },
        ]
  ).map((source, index) => ({ id: `source-${index + 1}`, source }));

  const retrieved = formatRecordDate(snapshot.citation.archive.retrievedAt);
  const reviewed = explainer ? formatRecordDate(explainer.reviewedAt) : undefined;
  const file: RecordFileRow[] = [
    {
      label: 'Citation',
      value: <span className="ds-mono">{snapshot.citation.canonicalCitation}</span>,
    },
    ...(reviewed ? [{ label: 'Last reviewed', value: <time>{reviewed}</time> }] : []),
    {
      label: 'Archived capture',
      value: (
        <>
          <a href={snapshot.citation.archive.archivedCaptureUrl} rel="noopener noreferrer">
            Archived copy of the official text
          </a>
          {retrieved ? (
            <>
              , retrieved <time>{retrieved}</time>
            </>
          ) : null}
        </>
      ),
    },
    ...(snapshot.topics.length > 0
      ? [{ label: 'Topics', value: snapshot.topics.map(humanizeLegalTopic).join(', ') }]
      : []),
    {
      label: 'Method',
      value: (
        <Link href={METHODOLOGY_HOW_RECORD_GETS_IN_HREF} prefetch={false}>
          How entries are checked against their sources
        </Link>
      ),
    },
  ];

  return (
    <RecordPage
      crumb={{ href: '/law', label: 'Law' }}
      title={snapshot.title}
      meta={meta}
      ledeText={explainer?.whatItSays ?? 'A plain-language explainer for this entry is in review.'}
      facts={[
        {
          label: 'Where',
          value: jurisdiction,
          detail: snapshot.jurisdictionId === 'us' ? 'Applies nationwide' : 'Applies statewide',
        },
        {
          label: 'When',
          value: snapshot.effectiveYear ? String(snapshot.effectiveYear) : 'Not dated yet',
          ...(snapshot.effectiveYear ? { detail: 'Took effect' } : {}),
        },
        {
          label: 'Evidence',
          value: (
            <a className="ds-recpage__grade" href="#sources">
              <FontAwesomeIcon
                icon={faScaleBalanced}
                className="ds-recpage__icon"
                aria-hidden="true"
              />
              Official text
            </a>
          ),
          detail: `${sources.length} primary source${sources.length === 1 ? '' : 's'}${
            retrieved ? `, archived ${retrieved}` : ''
          }`,
        },
      ]}
      actions={{
        ...(handoff ? { map: handoff } : {}),
        correctionHref: `/corrections?target=${encodeURIComponent(snapshot.id)}`,
      }}
      sourcesAnchor="sources"
      file={file}
      pager={{
        label: 'Laws in order',
        ...(previous ? { previous: { href: `/law/${previous.slug}`, label: previous.title } } : {}),
        ...(next ? { next: { href: `/law/${next.slug}`, label: next.title } } : {}),
      }}
    >
      {explainer ? (
        <>
          <RecordBeat id="meaning" title={LEGAL_SECTION_LABELS.whatItMeans}>
            <RecordProse>
              {explainer.whatItMeans.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </RecordProse>
            {explainer.termOfArtLinks && explainer.termOfArtLinks.length > 0 ? (
              <p className="ds-recpage__terms">
                Terms of art, defined by Cornell Wex:{' '}
                {explainer.termOfArtLinks.map((link, index) => (
                  <React.Fragment key={link.term}>
                    {index > 0 ? ', ' : null}
                    <a href={link.wexUrl} rel="noopener noreferrer">
                      {link.term}
                    </a>
                  </React.Fragment>
                ))}
              </p>
            ) : null}
          </RecordBeat>

          <RecordBeat id="why" title={LEGAL_SECTION_LABELS.whyItMatters}>
            <RecordProse>
              {explainer.whyItMatters.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </RecordProse>
          </RecordBeat>

          <RecordBeat id="rights" title={LEGAL_SECTION_LABELS.rightsToday}>
            {explainer.rightsToday.length > 0 ? (
              <RecordConnections
                connections={explainer.rightsToday.map((bullet) => ({
                  href: bullet.agencyUrl,
                  name: bullet.label,
                  relation: bullet.note ?? '',
                  external: true,
                }))}
              />
            ) : null}
            <p className="ds-recpage__aside">{LEGAL_DISCLAIMER_BODY}</p>
          </RecordBeat>
        </>
      ) : null}

      <RecordBeat id="sources" title="What the sources say">
        <EvidenceList items={sources} />
      </RecordBeat>
    </RecordPage>
  );
}
