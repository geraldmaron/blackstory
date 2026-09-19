/**
 * Public law reference browse surface at `/law`.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { WalkOffRamp } from '../walk-off-ramp';
import { LAW_EDITION_BROWSE_LEDE } from './law-copy';
import { buildLawBrowseViewModel, type RawLawBrowseParams } from './law-view-model';
import { loadLegalCatalog } from '../../lib/legal/public-source';
import { LawBrowseSections } from './LawBrowseSections';
import { humanizeLegalKind, humanizeLegalTopic } from '../../components/legal';
import { DocumentColophon, OrientationInstrument, ReadingEntry, Room } from '../../components/room';
import './law-browse.css';
import '../reading-room.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/law',
  title: 'Law',
  description:
    'Plain-language statutes, regulations, and court decisions that shaped what could be built, owned, attended and voted for.',
});

type LawPageProps = {
  readonly searchParams: Promise<RawLawBrowseParams>;
};

export default async function LawPage({ searchParams }: LawPageProps) {
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

  const topicCounts = new Map<string, number>();
  for (const snapshot of catalog) {
    for (const topic of snapshot.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }
  const topTopics = [...topicCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([topic, count]) => ({
      label: humanizeLegalTopic(topic),
      href: `/law?topic=${encodeURIComponent(topic)}#browse`,
      note: `${count.toLocaleString('en-US')} entries`,
      icon: 'law' as const,
    }));

  const rail = (
    <OrientationInstrument
      where="Statutes and rulings, in plain language"
      moves={[
        ...topTopics,
        { label: 'How this catalog is built', href: '/methodology', icon: 'methodology' as const },
      ].slice(0, 3)}
    />
  );

  return (
    <Room rail={rail}>
      <ReadingEntry pathname="/law" title="Law" lede={LAW_EDITION_BROWSE_LEDE} showCrumb={false} />
      <DocumentColophon
        facts={[`${catalog.length.toLocaleString('en-US')} law entries`, ...kindMeta]}
      />

      <LawBrowseSections view={view} catalog={catalog} />

      <WalkOffRamp>
        This catalog is jurisdictional. It does not invent a documented join to a record.
      </WalkOffRamp>
    </Room>
  );
}
