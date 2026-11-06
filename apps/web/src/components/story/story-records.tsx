/**
 * "Records linked to this chapter": the story's small evidence collection.
 *
 * The linked set is exactly what `storyCitedEntities(doc)` returns (records pinned on a map inset
 * are "mapped in"; records in the story's related list are "referenced in"). Nothing is inferred
 * from names, packet ids or the bibliography, so the list says what is linked, never that it is
 * everything the chapter draws on.
 *
 * Resolution is honest about what the read returned:
 *  - complete: every linked id resolved to a public record;
 *  - partial: some did; the rest are counted, never named, never invented;
 *  - unavailable: linked ids exist but none resolved (read unavailable or records not released);
 *  - empty: nothing is linked. That is a statement about links, not about source material.
 */
import React from 'react';
import Link from 'next/link';
import type { CitesRelation } from '../../lib/release/build-cites-edge';
import { recordsHref } from '../../lib/records/records-query';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import { buildExploreHref, defaultExploreOverlayState } from '../../lib/map-experience/url-state';
import { storyCollectionToken } from '../../lib/discovery/story-collection';

void React;

export type StoryRecordsState = 'empty' | 'complete' | 'partial' | 'unavailable';

export type StoryRecordsProps = {
  readonly noun: string;
  /** Published slug. Enables the Records / Map / Chronology handoff for exactly the linked set. */
  readonly slug?: string;
  /** Output of `storyCitedEntities(doc)`: entity id to its strongest relation. */
  readonly linked: ReadonlyMap<string, CitesRelation>;
  /** Resolved public records for (a subset of) the linked ids. */
  readonly records: readonly { readonly id: string; readonly displayName: string }[];
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

export function StoryRecords({ noun, slug, linked, records, source }: StoryRecordsProps) {
  // Hrefs go through the shared codecs, never string concatenation.
  const token = slug === undefined ? '' : storyCollectionToken(slug);
  const exploreHref = buildExploreHref({
    filters: DEFAULT_EXPLORE_FILTERS,
    ...defaultExploreOverlayState(),
    ...(token === '' ? {} : { collection: token }),
  });
  const byId = new Map(records.map((record) => [record.id, record] as const));
  // Linked order and relation come from the derivation; only the display name comes from the read.
  const resolved = [...linked].flatMap(([id, relation]) => {
    const record = byId.get(id);
    return record ? [{ id, relation, displayName: record.displayName }] : [];
  });
  const missing = linked.size - resolved.length;
  const state = storyRecordsState(linked.size, resolved.length, source);

  return (
    <section
      className="ds-reading-appx__records"
      aria-labelledby="records-behind"
      data-state={state}
    >
      <h3 id="records-behind">Records linked to this {noun}</h3>
      {state === 'empty' ? (
        <p>
          No archive records are linked to this {noun} yet. That says nothing about the sources it
          was written from; those are under References.
        </p>
      ) : (
        <p>
          Records this {noun} links to directly, as the archive holds them. Other sources informed
          the text; those are under References. Open a record to read its evidence, or find it on
          the Atlas from there.
        </p>
      )}
      {state === 'unavailable' && source === 'failed' ? (
        <p className="ds-reading-appx__records-note">
          The linked records could not be retrieved. Reload to try again.
        </p>
      ) : state === 'unavailable' ? (
        <p className="ds-reading-appx__records-note">
          {linked.size} linked {linked.size === 1 ? 'record' : 'records'} could not be loaded right
          in this public release. Their availability could not be confirmed.
        </p>
      ) : null}
      {resolved.length > 0 ? (
        <ul className="ds-reading-appx__record-list">
          {resolved.map((record) => (
            <li key={record.id}>
              <Link href={`/entity/${record.id}`}>{record.displayName}</Link>
              <span className="ds-reading-appx__record-relation ds-mono">
                {record.relation} this {noun}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {state === 'partial' ? (
        <p className="ds-reading-appx__records-note">
          {missing} more linked {missing === 1 ? 'record' : 'records'} could not be loaded right in
          this public release. Their availability could not be confirmed.
        </p>
      ) : null}
      {slug !== undefined && resolved.length > 0 ? (
        <nav className="ds-reading-appx__records-explore" aria-label={`Explore the linked records`}>
          <p className="ds-reading-appx__records-note">
            Explore exactly the records this {noun} links to. This is not every source the {noun}{' '}
            drew on.
          </p>
          <ul className="ds-reading-appx__record-list">
            <li>
              <Link href={recordsHref({ collection: token })}>Records</Link>
            </li>
            <li>
              <Link href={exploreHref}>Map</Link>
            </li>
            <li>
              <Link href={recordsHref({ collection: token, layout: 'chronology' })}>
                Chronology
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </section>
  );
}
