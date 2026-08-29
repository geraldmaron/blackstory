/**
 * Public law reference browse surface at `/law`.
 *
 * v9 room kit edition with shared browse/filter surface. Preserves GET
 * browse URL contract (`q`, `kind`, `topic`) and auto-submit facet selects.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { WalkOffRamp } from '../walk-off-ramp';
import { LAW_EDITION_BROWSE_LEDE } from './law-copy';
import { buildLawBrowseViewModel, type RawLawBrowseParams } from './law-view-model';
import { loadLegalCatalog } from '../../lib/legal/public-source';
import {
  LawBrowseSections,
  jurisdictionLabel,
  statePostalForJurisdiction,
} from './LawBrowseSections';
import { humanizeLegalKind } from '../../components/legal';
import { Room, RoomHeader, RailGroup } from '../../components/room';
import '../reading-room.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/law',
  title: 'Law',
  description:
    'Plain-language access to landmark civil-rights statutes, regulations, and court decisions.',
});

type LawPageProps = {
  readonly searchParams: Promise<RawLawBrowseParams>;
};

export default async function LawBrowsePage({ searchParams }: LawPageProps) {
  const params = await searchParams;
  const source = await loadLegalCatalog();
  const catalog = source.snapshots;
  const view = buildLawBrowseViewModel(params, source);

  const kindCounts = new Map<string, number>();
  for (const snapshot of catalog) {
    kindCounts.set(snapshot.kind, (kindCounts.get(snapshot.kind) ?? 0) + 1);
  }
  const kindMeta = [...kindCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(
      ([kind, count]) =>
        `${count} ${humanizeLegalKind(kind).toLowerCase()}${count === 1 ? '' : 's'}`,
    );

  const jurisdictionCounts = new Map<
    string,
    { readonly label: string; readonly postal: string | undefined; count: number }
  >();
  for (const snapshot of catalog) {
    const label = jurisdictionLabel(snapshot.jurisdictionId);
    const postal = statePostalForJurisdiction(snapshot.jurisdictionId);
    const existing = jurisdictionCounts.get(label);
    if (existing) existing.count += 1;
    else jurisdictionCounts.set(label, { label, postal, count: 1 });
  }
  const byJurisdiction = [...jurisdictionCounts.values()]
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      label: entry.label,
      count: entry.count,
      href: entry.postal ? `/explore?state=${entry.postal}` : '/explore',
    }));

  const rail = (
    <>
      <p className="ds-room-note">
        These jurisdiction links hand the reader to the Atlas by place of authority alone. The
        archive does not document that any specific record was decided under, or is otherwise
        connected to, a given law.
      </p>
      <RailGroup title="By jurisdiction" entries={byJurisdiction} limit={12} />
    </>
  );

  return (
    <Room rail={rail}>
      <RoomHeader
        pathname="/law"
        kicker="Reference"
        title={
          <>
            Civil rights <em>law</em>
          </>
        }
        lede={
          <>
            {LAW_EDITION_BROWSE_LEDE} This catalogue holds the statutes, regulations, constitutional
            amendments and landmark decisions themselves. It is linked to a place only by
            jurisdiction and era, never by a documented evidentiary join.
          </>
        }
        meta={[`${catalog.length.toLocaleString('en-US')} law entries`, ...kindMeta]}
      />

      <LawBrowseSections view={view} catalog={catalog} />

      <WalkOffRamp title="The place">
        This catalogue is jurisdictional. It does not invent a documented join to the place you
        opened it from.
      </WalkOffRamp>
    </Room>
  );
}
