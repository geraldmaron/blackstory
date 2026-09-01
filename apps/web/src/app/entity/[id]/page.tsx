/**
 * Entity detail page for public records.
 *
 * Standable place/school/event/institution records 308 to `/place/{slug}` (collision form
 * when names collide). People, street-precision residences, and other non-standable records
 * still render here. Door Rest pin walks stay on the stand allowlist; Place itself resolves
 * the wider corpus via the search index.
 *
 * On the v9 room kit (a Record room with a right rail), not the retired v6 edition stack.
 */

import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { PublicEntityView } from '../../../data/public-seed';
import { EntitySensitivityBanner } from '../../../components/entity/EntitySensitivityBanner';
import { RecordVisitBlock } from '../../../components/patterns/RecordVisitBlock';
import '../../../components/entity/entity-page.css';
import { EntityMastMedia } from '../../../components/entity/EntityMastMedia';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { EntityTopicTags } from '../../../components/entity/EntityTopicTags';
import { HowToReadThisRecord } from '../../../components/trust';
import {
  Breadcrumb,
  Room,
  SourceList,
  TrustBlock,
  type RoomSource,
} from '../../../components/room';
import { KindGlyph } from '../../../components/map-experience/KindGlyph';
import {
  RECORD_GAP_COPY,
  THIN_RECORD_COPY,
  type RecordGapKind,
} from '../../../components/entity/copy';
import { humanizeToken } from '../../../components/entity/format';
import { geoAnchorFor } from '../../../lib/map-experience/entity-geo';
import { resolvePublicAddressLine } from '../../../lib/geography/public-address';
import { shouldShowVisitBlock } from '../../../lib/geography/visit-handoff';
import {
  buildExploreHref,
  defaultExploreOverlayState,
} from '../../../lib/map-experience/url-state';
import { mapToneFromTopics } from '../../../lib/map-experience/kind-encoding';
import { entityEvidenceHref, exploreHrefForKind } from '../../../lib/map-experience/metadata-hrefs';
import { buildEntityPageMetadata } from '../../../lib/seo/metadata-builders';
import { getPublicSearchIndex, resolvePublicEntityView } from '../../../lib/public-data/source';
import { resolveEntityCrossReferences } from '../../../lib/theme-impact/source';
import { resolveCitesEdgeIndex } from '../../../lib/articles/source';
import { storiesCiting } from '../../../lib/release/build-cites-edge';
import { isDisplayableJurisdictionLabel } from '../../../lib/public-data/map-projection';
import { canStandHere, isInternalRecordLabel } from '../../../lib/place/public-place-path';
import { placeHrefForEntity, placeSlugCollisionCounts } from '../../../lib/place/place-slug';
import { toEvidenceClaimInputs, withoutSummaryEchoClaims } from './adapters';
import { buildEntityAnatomyInputs } from './entity-anatomy-facts';
import { deriveRecordStanding, isThinRecord } from './entity-view-model';
import { EntityRoomSections, recordSectionIndex } from './EntityRoomSections';
import { EntitySessionNavClient } from './entity-session-nav-client';
import '../../record-page.css';
import './record-room.css';

/**
 * Incrementally regenerated, not force-dynamic.
 *
 * `force-dynamic` here dated from the era when the catalog was an expensive per-request
 * Postgres pull. Its cost was measured on 2026-08-09: every response carried Next's dynamic
 * `cache-control: private, no-cache, no-store`, which overrides the `s-maxage=3600` rule this
 * route already declares in `next.config.mjs`, so `x-vercel-cache` was MISS on 100% of entity
 * requests and every reader hit a function.
 *
 * `revalidate` keeps the original guarantee intact (nothing renders at build, so a build
 * without `DATABASE_URL` can never bake the Dunbar seed into a page) while letting a rendered
 * page be reused. 3600s matches the Cache-Control this route already advertises; visible
 * staleness for an in-place correction is bounded by that plus the 30m catalog TTL.
 */
export const revalidate = 3600;
export const dynamicParams = true;

type EntityPageProps = {
  readonly params: Promise<{ id: string }>;
};

function entityLinkCatalogFromNeighbors(
  entity: NonNullable<Awaited<ReturnType<typeof resolvePublicEntityView>>['data']>,
): readonly EntityLinkCatalogEntry[] {
  const seen = new Set<string>();
  const catalog: EntityLinkCatalogEntry[] = [];
  for (const neighbor of [...(entity.relatedNeighbors ?? []), ...(entity.continueLearning ?? [])]) {
    if (seen.has(neighbor.id) || neighbor.displayName.trim().length === 0) {
      continue;
    }
    seen.add(neighbor.id);
    catalog.push({ id: neighbor.id, displayName: neighbor.displayName });
  }
  return catalog;
}

export async function generateStaticParams() {
  // Deliberately empty: prerender nothing, render every id on demand, then let `revalidate`
  // cache it. `dynamicParams = true` is what makes that safe.
  //
  // This used to enumerate every id from the search index, guarded by a
  // `shouldUseLivePublicProjections()` check for builds with no database. That was inert while
  // the route was `force-dynamic` (Next ignores static params for a force-dynamic route). Under
  // `revalidate` it would become live again, and on Vercel `DATABASE_URL` *is* present at build
  // time, so the guard would pass and the build would pull the full catalog and prerender ~4,092
  // entity pages. On-demand rendering reaches the same cached steady state without paying that
  // at build, and keeps the no-database build safe for the same reason it was safe before.
  return [];
}

export async function generateMetadata({ params }: EntityPageProps) {
  const { id } = await params;
  const resolved = await resolvePublicEntityView(id);
  if (!resolved.data) {
    return { title: 'Record not found' };
  }
  return buildEntityPageMetadata({
    id: resolved.data.id,
    displayName: resolved.data.displayName,
    summary: resolved.data.summary,
    kind: resolved.data.kind,
    ...(resolved.data.primaryImage !== undefined
      ? { imageUrl: resolved.data.primaryImage.url }
      : {}),
  });
}

/**
 * One entry per distinct source, so the rail reads as a bibliography rather than a repeat of the
 * claim text. The v6 page printed the same bare hostname twice for a single source.
 */
function sourceLabel(claim: PublicEntityView['claims'][number]): string {
  const raw = (claim.citationLabel || claim.citationSource || '').trim();
  const href = claim.citationHref;
  const publisher = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
  if (!href) return publisher;

  // A bare host is not a citation, it is a domain. The document's own URL path is the only
  // title-like string the projection carries, so when the label is just the host, the last
  // meaningful path segment is humanised and appended. It is the source's own slug, not a
  // guess at what the page is called.
  const looksLikeHost = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(publisher);
  if (!looksLikeHost) return publisher;

  let path: string;
  try {
    path = new URL(href).pathname;
  } catch {
    return publisher;
  }
  const segments = path.split('/').filter((segment) => segment.length > 0);
  const last = segments.at(-1);
  if (!last) return publisher;
  const title = decodeURIComponent(last)
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (title.length === 0) return publisher;
  return `${publisher}: ${title.charAt(0).toUpperCase()}${title.slice(1)}`;
}

function toRoomSources(claims: PublicEntityView['claims']): readonly RoomSource[] {
  const seen = new Map<string, RoomSource>();
  for (const claim of claims) {
    const href = claim.citationHref;
    const key = href ?? claim.citationSource ?? claim.citationLabel;
    if (!key || seen.has(key)) continue;
    seen.set(key, { text: sourceLabel(claim), ...(href ? { href } : {}) });
  }
  return [...seen.values()];
}

/**
 * The gaps disclosed once, in the rail, in the approved vocabulary. Takes the claims the page
 * actually renders, not the raw set: a record whose only claim was suppressed as a summary echo
 * has nothing under "What the sources say", and the disclosure has to agree with the page.
 */
function resolveRecordGaps(
  entity: PublicEntityView,
  displayClaims: readonly PublicEntityView['claims'][number][],
): readonly RecordGapKind[] {
  const gaps: RecordGapKind[] = [];
  if (entity.historicalContext.trim().length === 0) gaps.push('context');
  if (displayClaims.length === 0) gaps.push('claims');
  if (entity.timeline.length === 0) gaps.push('timeline');
  if ((entity.relatedNeighbors?.length ?? 0) === 0) gaps.push('related');
  return gaps;
}

/** ISO timestamps are release plumbing; a reader wants a date. */
function formatRecordDate(value: string | undefined): string {
  if (!value) return 'Not yet tracked';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params;
  const resolved = await resolvePublicEntityView(id);
  const entity = resolved.data;
  if (!entity) {
    notFound();
  }

  // Standable records use the human `/place/{slug}` address. Collisions carry `--{id}`.
  if (canStandHere(entity) && !isInternalRecordLabel(entity.displayName)) {
    let collisions: ReadonlyMap<string, number> | undefined;
    try {
      const index = await getPublicSearchIndex();
      collisions = placeSlugCollisionCounts(index.data);
    } catch {
      collisions = undefined;
    }
    permanentRedirect(placeHrefForEntity(entity, collisions));
  }

  const standingLabel = deriveRecordStanding(entity);
  const jurisdictionLabel = isDisplayableJurisdictionLabel(entity.jurisdictionLabel)
    ? entity.jurisdictionLabel.trim()
    : undefined;
  const mapTone = mapToneFromTopics(entity.topicIds ?? entity.topicTags);
  const displayClaims = withoutSummaryEchoClaims(entity.claims, entity.summary);
  const evidenceClaims = toEvidenceClaimInputs(displayClaims);
  const geoAnchor = entity.geoAnchor ?? geoAnchorFor(entity.id);
  const publicAddress = resolvePublicAddressLine({
    displayName: entity.displayName,
    locationLabel: entity.locationLabel,
    jurisdictionLabel: entity.jurisdictionLabel,
    locationPrecision: entity.locationPrecision,
    kind: entity.kind,
  });
  const visitInput = {
    displayName: entity.displayName,
    locationLabel: entity.locationLabel,
    jurisdictionLabel: entity.jurisdictionLabel,
    locationPrecision: entity.locationPrecision,
    kind: entity.kind,
    claims: entity.claims,
    ...(entity.status !== undefined ? { status: entity.status } : {}),
    ...(entity.livingStatus !== undefined ? { livingStatus: entity.livingStatus } : {}),
    ...(entity.sensitivityClass !== undefined ? { sensitivityClass: entity.sensitivityClass } : {}),
    ...(entity.placeAdvisories !== undefined ? { placeAdvisories: entity.placeAdvisories } : {}),
    ...(geoAnchor ? { lat: geoAnchor.lat, lng: geoAnchor.lng } : {}),
  };
  const entityLinkCatalog = entityLinkCatalogFromNeighbors(entity);
  const exploreHref = buildExploreHref({
    filters: {
      era: 'all',
      kind: 'all',
      tone: 'all',
      theme: 'all',
      status: 'all',
      confidence: 'all',
    },
    ...defaultExploreOverlayState(),
    selected: entity.id,
    ...(geoAnchor ? { viewport: { lat: geoAnchor.lat, lng: geoAnchor.lng, zoom: 11 } } : {}),
  });
  const { data: searchIndex } = await getPublicSearchIndex();
  const orderedIds = searchIndex.map((doc) => doc.id);
  const crossReferences = await resolveEntityCrossReferences(entity.id);
  const citingStories = storiesCiting(await resolveCitesEdgeIndex(), entity.id);

  const anatomyInputs = buildEntityAnatomyInputs(entity, mapTone);
  const sources = toRoomSources(entity.claims);
  // Rubric sentences, whole. They used to be truncated into chips next to the title.
  const inclusionBasis = entity.notabilityLabels ?? [];
  const gaps = resolveRecordGaps(entity, [...displayClaims]);
  const thinRecord = isThinRecord(entity);
  const sectionsOnThisRecord = recordSectionIndex({
    entity,
    evidenceClaims,
    ...(crossReferences.length > 0 ? { crossReferences } : {}),
  });

  /*
   * The rail is what a reader consults beside the record: where it is, and what is on the page.
   *
   * It used to carry the whole apparatus: anatomy, map, sources, citing chapters, inclusion
   * rubric, provenance, gaps and a how-to-read block, which meant a record opened on a sidebar
   * of eight stacked boxes. The facts moved up into the strip under the masthead, where they are
   * read once; the apparatus moved down into the band, where it is checked. What is left is the
   * locator and a table of contents for the column beside it.
   */
  const rail = (
    <>
      {shouldShowVisitBlock(visitInput) ? (
        <RecordVisitBlock
          className="ds-record-visit--rail"
          showLocator={geoAnchor !== undefined}
          {...visitInput}
        />
      ) : null}

      <nav className="ds-record-toc" aria-label="On this record">
        <span className="ds-record-toc__title">On this record</span>
        {sectionsOnThisRecord.map((section) => (
          <a className="ds-record-toc__link" href={`#${section.id}`} key={section.id}>
            {section.label}
            {section.count === undefined ? null : <span className="ds-mono">{section.count}</span>}
          </a>
        ))}
      </nav>
    </>
  );

  /*
   * The apparatus band. Every fact here is load-bearing for a reader checking the archive's
   * work, and none of it is what a reader came for, so it sits under the record rather than
   * beside the first paragraph of it.
   */
  const apparatus = (
    <div className="ds-record-appx">
      <div className="ds-record-appx__head">
        <h2>About this record</h2>
        <span>Provenance, sourcing and known gaps: the apparatus behind the page above.</span>
      </div>
      <div className="ds-record-appx__cols">
        {sources.length > 0 ? (
          <section aria-labelledby="sources-heading">
            <h3 className="ds-record-appx__title" id="sources-heading">
              Bibliography
            </h3>
            <SourceList sources={sources} />
          </section>
        ) : null}

        <section aria-labelledby="provenance-heading">
          <h3 className="ds-record-appx__title" id="provenance-heading">
            Provenance
          </h3>
          <TrustBlock
            label="Record provenance"
            facts={[
              { label: 'Maturity', value: humanizeToken(entity.recordMaturity) },
              { label: 'Coverage', value: humanizeToken(entity.researchCoverage) },
              { label: 'Updated', value: formatRecordDate(entity.revision.recordUpdatedAt) },
              { label: 'Release', value: entity.revision.releaseId },
            ]}
          />
        </section>

        <div className="ds-record-appx__notes">
          {inclusionBasis.length > 0 ? (
            <section aria-labelledby="why-heading">
              <h3 className="ds-record-appx__title" id="why-heading">
                Why this is here
              </h3>
              <ul className="ds-record-rail-block__reasons">
                {inclusionBasis.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {thinRecord || gaps.length > 0 ? (
            <section aria-labelledby="gaps-heading">
              <h3 className="ds-record-appx__title" id="gaps-heading">
                Still researching
              </h3>
              {thinRecord ? <p>{THIN_RECORD_COPY.body}</p> : null}
              {gaps.length > 0 ? (
                <p>
                  {gaps.map((gap) => RECORD_GAP_COPY[gap].title).join('. ')}. These are gaps in the
                  research, not an absence of history.{' '}
                  <Link href={`/corrections?target=${entity.id}`} prefetch={false}>
                    Submit a correction
                  </Link>
                  .
                </p>
              ) : null}
            </section>
          ) : null}

          {citingStories.length > 0 ? (
            <section aria-labelledby="cited-by-heading">
              <h3 className="ds-record-appx__title" id="cited-by-heading">
                Cited in
              </h3>
              <ul className="ds-record-rail-block__chapters">
                {citingStories.map((story) => (
                  <li key={story.slug}>
                    <Link href={story.href} prefetch={false}>
                      {story.title}
                    </Link>
                    <span className="ds-record-rail-block__relation ds-mono">{story.relation}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <HowToReadThisRecord variant="compact" />
        </div>
      </div>
    </div>
  );

  return (
    <Room
      rail={rail}
      foot={apparatus}
      masthead={
        <>
          {/*
           * The masthead. The record's own photograph, at the width of the page, with the record
           * written over it, rather than a text header followed by a picture of the thing the
           * header just named.
           *
           * `data-media` is load-bearing. Roughly nine records in ten have no rights-cleared
           * photograph and fall back to the kind mark, which is a pale plate with a silhouette on
           * it: stretched full bleed under white display type it is both a contrast failure and a
           * claim the archive has imagery it does not have. A mark masthead is short, the mark
           * keeps its own proportion, and the title sits under it on the canvas instead of over it.
           */}
          <figure
            className="ds-record-mast"
            data-media={entity.primaryImage !== undefined ? 'photo' : 'mark'}
          >
            <EntityMastMedia
              entityId={entity.id}
              entityName={entity.displayName}
              kind={entity.kind}
              {...(jurisdictionLabel !== undefined ? { jurisdictionLabel } : {})}
              {...(entity.primaryImage !== undefined ? { primaryImage: entity.primaryImage } : {})}
              priority
            />
            <figcaption className="ds-record-mast__over">
              <Breadcrumb pathname={`/entity/${entity.id}`} hereLabel={entity.displayName} />
              <p className="ds-record-mast__facts">
                <span className="ds-record-mast__kind">
                  <KindGlyph kind={entity.kind} {...(mapTone ? { mapTone } : {})} size={12} />
                  {anatomyInputs.kindLabel}
                </span>
                {[publicAddress, anatomyInputs.eraLabel, standingLabel]
                  .filter((fact): fact is string => fact !== undefined)
                  .map((fact) => (
                    <span key={fact}>{fact}</span>
                  ))}
              </p>
              <h1 className="ds-record-mast__title">{entity.displayName}</h1>
              <p className="ds-record-mast__lede">
                <LinkedProse
                  as="span"
                  text={entity.summary}
                  skipEntityIds={[entity.id]}
                  catalog={entityLinkCatalog}
                />
              </p>
            </figcaption>
          </figure>

          {/* One strip, four facts, sticky under the bar: what this is, where, when, and how
              well sourced. These were four boxes stacked down the rail, above the map, above
              the sources: read once and then in the way for the rest of the page. */}
          <dl className="ds-record-strip">
            <div>
              <dt>Kind</dt>
              <dd>
                <Link href={exploreHrefForKind(anatomyInputs.kind)} prefetch={false}>
                  {anatomyInputs.kindLabel}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{publicAddress}</dd>
            </div>
            <div>
              <dt>Era</dt>
              <dd>
                {anatomyInputs.eraHref ? (
                  <Link href={anatomyInputs.eraHref} prefetch={false}>
                    {anatomyInputs.eraLabel}
                  </Link>
                ) : (
                  anatomyInputs.eraLabel
                )}
              </dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>
                <Link href={entityEvidenceHref(`/entity/${entity.id}`)} prefetch={false}>
                  {anatomyInputs.evidenceLabel}
                </Link>
              </dd>
            </div>
            <div className="ds-record-strip__go">
              <Link className="ds-cta ds-cta--copper" href={exploreHref} scroll={false}>
                See it on the map
              </Link>
            </div>
          </dl>
        </>
      }
    >
      <EntityTopicTags entity={entity} />

      {entity.sensitivity ? (
        <EntitySensitivityBanner sensitivity={entity.sensitivity} entityKind={entity.kind} />
      ) : null}

      {shouldShowVisitBlock(visitInput) ? (
        <RecordVisitBlock className="ds-record-visit--main" {...visitInput} />
      ) : null}

      <EntityRoomSections
        entity={entity}
        evidenceClaims={evidenceClaims}
        entityLinkCatalog={entityLinkCatalog}
        {...(crossReferences.length > 0 ? { crossReferences } : {})}
      />

      <EntitySessionNavClient currentId={entity.id} orderedIds={orderedIds} />
    </Room>
  );
}
