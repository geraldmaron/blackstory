/**
 * Readable Law chapter for `/how-it-works#law`. Browse and filter tools live at `/law/browse`.
 */
import React from 'react';
import Link from 'next/link';
import { LegalDisclaimer, humanizeLegalKind } from '../../components/legal';
import type { LegalCatalogSource } from '../../lib/legal/public-source';
import { EmptyList, Prose } from '../../components/room';
import { LAW_EDITION_BROWSE_LEDE } from './law-copy';
import { buildLawBrowseViewModel } from './law-view-model';
import { jurisdictionLabel } from './LawBrowseSections';

void React;

const LANDMARK_COUNT = 12;

export type LawHubSectionsProps = {
  readonly source: LegalCatalogSource;
};

export function LawHubSections({ source }: LawHubSectionsProps) {
  const view = buildLawBrowseViewModel({}, source);
  const landmarks = view.items.slice(0, LANDMARK_COUNT);
  const jurisdictionById = new Map(
    source.snapshots.map(
      (snapshot) => [snapshot.id, jurisdictionLabel(snapshot.jurisdictionId)] as const,
    ),
  );

  return (
    <>
      <Prose>
        <p>{LAW_EDITION_BROWSE_LEDE}</p>
        <p>
          This catalog loads from a separate legal reference, not from the entity records this
          archive pins to place. Where a law and a record share a jurisdiction and an era, that is a
          coincidence of scope, not a documented link.
        </p>
      </Prose>

      <LegalDisclaimer />

      {landmarks.length === 0 ? (
        <EmptyList title="Law catalog unavailable">
          The landmark list could not load just now. Nothing documented here is lost.
        </EmptyList>
      ) : (
        <ol className="ds-room-idx" aria-label="Landmark statutes and decisions">
          {landmarks.map((item) => (
            <li key={item.id} className="ds-room-idx__row">
              <Link className="ds-room-idx__name" href={`/law/${item.slug}`}>
                {item.title}
              </Link>
              <p className="ds-room-idx__meta">
                {[
                  item.effectiveYear?.toString(),
                  humanizeLegalKind(item.kind),
                  jurisdictionById.get(item.id) ?? 'Unknown jurisdiction',
                  item.citation,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {item.summary ? <p className="ds-law-idx__gloss">{item.summary}</p> : null}
            </li>
          ))}
        </ol>
      )}

      <Prose>
        <p>
          <Link href="/law/browse">Browse and filter the full law catalog</Link>
          {view.totalAvailable > 0
            ? ` (${view.totalAvailable.toLocaleString('en-US')} entries).`
            : '.'}{' '}
          Search by title, citation, kind, or topic.
        </p>
      </Prose>
    </>
  );
}

/** @deprecated Prefer {@link LawHubSections}. */
export const LawApparatusSections = LawHubSections;
export type LawApparatusSectionsProps = LawHubSectionsProps;
