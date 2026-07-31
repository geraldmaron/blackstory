/**
 * `/records` — the crawlable, non-spatial record index (SP-09, repo-92n2.9).
 *
 * The epic's first binding correction: a map answers "what happened near here" well and "what is
 * documented about X" badly, so the archive keeps a browsable index at its own URL rather than
 * hiding one inside the homepage and canonicalising it away.
 *
 * This is also the landing surface for three previously public URL families — `/search`,
 * `/history` and `/facts` all resolve here in one hop — so it must never 404 and must render
 * something honest for any param combination a stale bookmark carries.
 *
 * Plate posture: Parked. This room never shows the map; the off-ramp hands the narrowing to it.
 */
import type { Metadata } from 'next';
import { getSharedPublicEntities } from '../(map)/shared-map-data';
import { buildRecordsIndex, parseRecordsQuery } from '../../lib/records/build-records-index';
import { RecordsIndexRoom } from './RecordsIndex';
import '../reading-room.css';
import './records-index.css';

type RecordsPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';

/**
 * The canonical is self-referential and carries the narrowing, because a filtered page is a
 * distinct, useful set — pointing every combination at bare `/records` is exactly the mistake
 * §4 names. `prev`/`next` are emitted as real link relations alongside the anchors in the body.
 */
export async function generateMetadata({ searchParams }: RecordsPageProps): Promise<Metadata> {
  const query = parseRecordsQuery(await searchParams);
  const { data: entities } = await getSharedPublicEntities();
  const model = buildRecordsIndex(entities, query);
  const absolute = (path: string): string => new URL(path, SITE_URL).toString();

  const title =
    model.constraints.length > 0
      ? `Records · ${model.constraints.map((constraint) => constraint.label).join(' · ')}`
      : 'Records';

  return {
    title,
    description:
      'Every record in the active release as a browsable list: kind, place, era and evidence grade, filterable and linkable without opening the map.',
    alternates: { canonical: absolute(model.canonicalPath) },
    other: {
      ...(model.previousHref !== undefined ? { 'link:prev': absolute(model.previousHref) } : {}),
      ...(model.nextHref !== undefined ? { 'link:next': absolute(model.nextHref) } : {}),
    },
  };
}

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const query = parseRecordsQuery(await searchParams);
  const { data: entities } = await getSharedPublicEntities();
  const model = buildRecordsIndex(entities, query);

  return (
    <>
      {/*
        Emitted here rather than through `alternates` because Next's metadata API has no first
        class rel=prev/next, and a paged index without them teaches a crawler that page 2 is an
        unrelated document.
      */}
      {model.previousHref === undefined ? null : (
        <link rel="prev" href={new URL(model.previousHref, SITE_URL).toString()} />
      )}
      {model.nextHref === undefined ? null : (
        <link rel="next" href={new URL(model.nextHref, SITE_URL).toString()} />
      )}
      <RecordsIndexRoom model={model} releaseLabel="Active release" />
    </>
  );
}
