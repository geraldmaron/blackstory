/**
 * "Records in this chapter": the archive records a story links to directly, each a link to its
 * record page, named with its kind, place and first documented decade.
 *
 * The linked set is exactly what `storyCitedEntities(doc)` returns (records pinned on a map inset
 * are "mapped in"; records in the story's related list are "referenced in"). Nothing is inferred
 * from names, packet ids or the bibliography, so the list says what is linked, never that it is
 * everything the story draws on.
 *
 * Resolution is honest about what the read returned:
 *  - complete: every linked id resolved to a public record;
 *  - partial: some did; the rest are counted, never named, never invented;
 *  - unavailable: linked ids exist but none resolved (read failed or records not released);
 *  - empty: nothing is linked, and the block renders nothing.
 */
import React from 'react';
import Link from 'next/link';
import type { CitesRelation } from '../../lib/release/build-cites-edge';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import { buildExploreHref, defaultExploreOverlayState } from '../../lib/map-experience/url-state';
import { storyCollectionToken } from '../../lib/discovery/story-collection';
import { kindLabelForMark } from '../entity/record-mark';
import { decadeLabel, documentedDecades } from '../../lib/discovery/collection-period';

void React;

export type StoryRecordsState = 'empty' | 'complete' | 'partial' | 'unavailable';

export type StoryRecordsProps = {
  readonly noun: string;
  /** Published slug. Enables the map handoff for exactly the linked set. */
  readonly slug?: string;
  /** Output of `storyCitedEntities(doc)`: entity id to its strongest relation. */
  readonly linked: ReadonlyMap<string, CitesRelation>;
  /** Resolved public records for (a subset of) the linked ids. */
  readonly records: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly kind?: string;
    readonly locationLabel?: string;
    readonly locationPrecision?: string;
    readonly eraBuckets?: readonly string[];
  }[];
  /** `source` from `listPublicEntityViewsByIds`. */
  readonly source: 'live' | 'none' | 'failed';
};

export function storyRecordsState(
  linkedCount: number,
  resolvedCount: number,
  source: 'live' | 'none' | 'failed',
): StoryRecordsState {
  if (linkedCount === 0) return 'empty';
  if (source === 'failed' || source === 'none' || resolvedCount === 0) return 'unavailable';
  return resolvedCount < linkedCount ? 'partial' : 'complete';
}

const plural = (count: number) => (count === 1 ? 'record' : 'records');

/** "Case · Washington, D.C. · 1850s": kind, a place only where one is public, first decade. */
export function storyRecordMeta(record: StoryRecordsProps['records'][number]): string {
  const decade = documentedDecades(record.eraBuckets ?? [])[0];
  // A place label's trailing note ("(county seat: Columbiana)") belongs on the record page.
  const place =
    record.locationPrecision === 'none'
      ? ''
      : (record.locationLabel ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return [kindLabelForMark(record.kind), place, decade === undefined ? '' : decadeLabel(decade)]
    .filter(Boolean)
    .join(' · ');
}

export function StoryRecords({ noun, slug, linked, records, source }: StoryRecordsProps) {
  const byId = new Map(records.map((record) => [record.id, record] as const));
  // Linked order comes from the derivation; only the display fields come from the read.
  const resolved = [...linked.keys()].flatMap((id) => {
    const record = byId.get(id);
    return record ? [{ ...record, id }] : [];
  });
  const missing = linked.size - resolved.length;
  const state = storyRecordsState(linked.size, resolved.length, source);
  if (state === 'empty') return null;

  const token = slug === undefined ? '' : storyCollectionToken(slug);
  const exploreHref = buildExploreHref({
    filters: DEFAULT_EXPLORE_FILTERS,
    ...defaultExploreOverlayState(),
    ...(token === '' ? {} : { collection: token }),
  });

  return (
    <section className="ds-story-records" aria-labelledby="story-records" data-state={state}>
      <h2 className="ds-section-heading ds-story-end__heading" id="story-records">
        Records in this {noun}
      </h2>
      {resolved.length > 0 ? (
        <ul className="ds-story-records__list">
          {resolved.map((record) => (
            <li key={record.id}>
              <Link className="ds-story-records__link" href={`/entity/${record.id}`}>
                <span className="ds-story-records__name">{record.displayName}</span>
                <span className="ds-story-records__meta">{storyRecordMeta(record)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {state === 'unavailable' && source === 'failed' ? (
        <p className="ds-story-records__note">
          The linked records could not be retrieved. Reload to try again.
        </p>
      ) : state === 'unavailable' ? (
        <p className="ds-story-records__note">
          {linked.size} linked {plural(linked.size)} could not be loaded right in this public
          release. Their availability could not be confirmed.
        </p>
      ) : state === 'partial' ? (
        <p className="ds-story-records__note">
          {missing} more linked {plural(missing)} could not be loaded right in this public release.
          Their availability could not be confirmed.
        </p>
      ) : null}
      {slug !== undefined && resolved.length > 0 ? (
        <Link className="ds-story-records__map" href={exploreHref}>
          Show {resolved.length === 1 ? 'it' : 'them'} on the map
        </Link>
      ) : null}
    </section>
  );
}
