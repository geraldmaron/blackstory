/**
 * Entity detail page for public records.
 *
 * Standable place/school/event/institution records 308 to `/place/{slug}` (collision form
 * when names collide). People, street-precision residences, and other non-standable records
 * still render here. Door Rest pin walks stay on the stand allowlist; Place itself resolves
 * the wider corpus via the search index.
 *
 * On the v9 room kit (a Record room with a right rail), dressed in the record chrome
 * (`components/entity/RecordChrome.tsx`): one type scale, one icon language, pills for the
 * facts a reader glances at, tiles for the facts a reader checks, numbered beats for the
 * prose, and an apparatus band for everything that stands behind the page.
 */

import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  faArrowUpRightFromSquare,
  faMapLocationDot,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { PublicEntityView } from '../../../data/public-seed';
import { EntitySensitivityBanner } from '../../../components/entity/EntitySensitivityBanner';
import { RecordVisitBlock } from '../../../components/patterns/RecordVisitBlock';
import '../../../components/entity/entity-page.css';
import { EntityMastMedia } from '../../../components/entity/EntityMastMedia';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { EntityTopicTags } from '../../../components/entity/EntityTopicTags';
import {
  meterLevelForCoverage,
  meterLevelForTier,
  RecordFactTile,
  RecordGradePill,
  RecordKindPill,
  RecordPill,
  recordSectionIcon,
  RecordSmallTitle,
  RecordStatusPill,
} from '../../../components/entity/RecordChrome';
import { HowToReadThisRecord } from '../../../components/trust';
import { Breadcrumb, Room, SourceList, type RoomSource } from '../../../components/room';
import { MapsExternalLink } from '../../../components/map-experience/MapsExternalLink';
import {
  RECORD_GAP_COPY,
  THIN_RECORD_COPY,
  type RecordGapKind,
} from '../../../components/entity/copy';
import { humanizeToken } from '../../../components/entity/format';
import { confidenceIconFor } from '../../../lib/map-experience/confidence-icons';
import { geoAnchorFor } from '../../../lib/map-experience/entity-geo';
import { buildExternalMapsSearchUrl } from '../../../lib/geography/external-maps-url';
import { shouldShowVisitBlock } from '../../../lib/geography/visit-handoff';
import {
  buildExploreHref,
  defaultExploreOverlayState,
} from '../../../lib/map-experience/url-state';
import {
  displayEncodingFor,
  kindFamilyEncodingForKind,
  mapToneFromTopics,
} from '../../../lib/map-experience/kind-encoding';
import { kindIconFor } from '../../../lib/map-experience/kind-icons';
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
import { buildEntityAnatomyInputs, whereTileLabel } from './entity-anatomy-facts';
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
 * The gaps disclosed once, in the band, in the approved vocabulary. Takes the claims the page
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

/** Distinct sources behind the accepted claims: the number the Evidence tile counts. */
function distinctSourceCount(claims: PublicEntityView['claims']): number {
  const sources = new Set<string>();
  for (const claim of claims) {
    const key = (claim.citationHref ?? claim.citationSource ?? claim.citationLabel ?? '').trim();
    if (key.length > 0) sources.add(key);
  }
  return sources.size;
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
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
    ...(entity.visit !== undefined ? { visit: entity.visit } : {}),
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
  const publicAddress = anatomyInputs.whereLabel;
  /* The tile takes a fifth of the measure; a long composed address goes to the jurisdiction. */
  const whereTile = whereTileLabel(entity, publicAddress);
  const showVisit = shouldShowVisitBlock(visitInput);
  const whereMapsHref =
    !showVisit && geoAnchor
      ? buildExternalMapsSearchUrl({
          lat: geoAnchor.lat,
          lng: geoAnchor.lng,
          query: publicAddress,
        })
      : undefined;
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
  const kindEncoding = displayEncodingFor(entity.kind, mapTone);
  const gradeWord = anatomyInputs.evidenceLabel.split(' · ')[0] ?? anatomyInputs.evidenceLabel;
  const sourceCount = distinctSourceCount(displayClaims);
  const decadeCount = entity.eraBuckets?.length ?? 0;
  const evidenceHref = entityEvidenceHref(`/entity/${entity.id}`);
  const correctionsHref = `/corrections?target=${encodeURIComponent(entity.id)}`;
  const locationPrecisionLabel = `${humanizeToken(entity.locationPrecision)} precision`;

  /*
   * The rail: where the record is, what is on the page, and the record's own file. The
   * apparatus that a reader checks (sources, rubric, gaps) sits in the band under the column.
   */
  const rail = (
    <>
      {showVisit ? (
        <RecordVisitBlock
          className="ds-record-visit--rail"
          showLocator={geoAnchor !== undefined}
          {...visitInput}
        />
      ) : null}

      <nav className="ds-record-toc" aria-label="On this record">
        <RecordSmallTitle as="span" icon="toc" className="ds-record-toc__title">
          On this record
        </RecordSmallTitle>
        <ol className="ds-record-toc__list">
          {sectionsOnThisRecord.map((section, index) => (
            <li key={section.id}>
              <a className="ds-record-toc__link" href={`#${section.id}`}>
                <span className="ds-record-toc__index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="ds-record-toc__label">{section.label}</span>
                {section.count === undefined ? null : (
                  <span className="ds-rec-count">{section.count}</span>
                )}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section className="ds-rec-file" aria-labelledby="record-file-heading">
        <RecordSmallTitle id="record-file-heading" icon="provenance">
          Record file
        </RecordSmallTitle>
        <dl className="ds-rec-file__rows">
          <div className="ds-rec-file__row">
            <dt>Maturity</dt>
            <dd>{humanizeToken(entity.recordMaturity)}</dd>
          </div>
          <div className="ds-rec-file__row">
            <dt>Coverage</dt>
            <dd>{humanizeToken(entity.researchCoverage)}</dd>
          </div>
          <div className="ds-rec-file__row">
            <dt>Updated</dt>
            <dd className="ds-mono">{formatRecordDate(entity.revision.recordUpdatedAt)}</dd>
          </div>
          <div className="ds-rec-file__row">
            <dt>Release</dt>
            <dd className="ds-mono ds-rec-file__release">{entity.revision.releaseId}</dd>
          </div>
        </dl>
        <Link className="ds-rec-file__correct" href={correctionsHref} prefetch={false}>
          <FontAwesomeIcon icon={faPenToSquare} className="ds-rec-inline-icon" aria-hidden="true" />
          Submit a correction
        </Link>
      </section>
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
        <span>Sourcing, inclusion and known gaps: the apparatus behind the page above.</span>
      </div>
      <div className="ds-record-appx__cols">
        {sources.length > 0 ? (
          <section aria-labelledby="sources-heading">
            <RecordSmallTitle
              id="sources-heading"
              icon="bibliography"
              className="ds-record-appx__title"
            >
              Bibliography
              <span className="ds-rec-count">{sources.length}</span>
            </RecordSmallTitle>
            <SourceList sources={sources} />
          </section>
        ) : null}

        {inclusionBasis.length > 0 ? (
          <section aria-labelledby="why-heading">
            <RecordSmallTitle id="why-heading" icon="why" className="ds-record-appx__title">
              Why this is here
            </RecordSmallTitle>
            <ul className="ds-record-rail-block__reasons">
              {inclusionBasis.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="ds-record-appx__notes">
          {thinRecord || gaps.length > 0 ? (
            <section aria-labelledby="gaps-heading">
              <RecordSmallTitle id="gaps-heading" icon="gaps" className="ds-record-appx__title">
                Still researching
              </RecordSmallTitle>
              {thinRecord ? <p>{THIN_RECORD_COPY.body}</p> : null}
              {gaps.length > 0 ? (
                <ul className="ds-rec-gaps">
                  {gaps.map((gap) => (
                    <li key={gap}>{RECORD_GAP_COPY[gap].title}</li>
                  ))}
                </ul>
              ) : null}
              <p>
                These are gaps in the research, not an absence of history.{' '}
                <Link href={correctionsHref} prefetch={false}>
                  Submit a correction
                </Link>
                .
              </p>
            </section>
          ) : null}

          {citingStories.length > 0 ? (
            <section aria-labelledby="cited-by-heading">
              <RecordSmallTitle
                id="cited-by-heading"
                icon="cited"
                className="ds-record-appx__title"
              >
                Cited in
              </RecordSmallTitle>
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
              <div className="ds-rec-pills" aria-label="Record at a glance">
                <RecordKindPill
                  kind={entity.kind}
                  {...(mapTone ? { mapTone } : {})}
                  href={exploreHrefForKind(anatomyInputs.kind)}
                />
                {standingLabel !== undefined && entity.status ? (
                  <RecordStatusPill status={entity.status} label={standingLabel} />
                ) : null}
                <RecordPill
                  tone="era"
                  icon={recordSectionIcon('era')}
                  {...(anatomyInputs.eraHref ? { href: anatomyInputs.eraHref } : {})}
                >
                  {anatomyInputs.eraLabel}
                </RecordPill>
                <RecordGradePill tier={anatomyInputs.evidenceTier} href={evidenceHref}>
                  {gradeWord}
                </RecordGradePill>
              </div>
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

          {/* The fact strip: what this is, where, when, how well sourced, and how far the
              research has gone, as tiles a reader checks once; then the ways out. */}
          <div className="ds-rec-facts">
            <dl className="ds-rec-facts__tiles">
              <RecordFactTile
                icon={kindIconFor(entity.kind, mapTone)}
                iconColor={kindEncoding.shade}
                label="Kind"
                value={
                  <Link href={exploreHrefForKind(anatomyInputs.kind)} prefetch={false}>
                    {anatomyInputs.kindLabel}
                  </Link>
                }
                support={
                  mapTone
                    ? humanizeToken(mapTone)
                    : `Filed with ${kindFamilyEncodingForKind(entity.kind).label.toLowerCase()}`
                }
              />
              <RecordFactTile
                icon={recordSectionIcon('where')}
                label="Where"
                value={
                  whereMapsHref ? (
                    <MapsExternalLink
                      href={whereMapsHref}
                      placeLabel={publicAddress}
                      title={`Where: ${publicAddress}. Open in your maps app.`}
                    >
                      {whereTile}
                    </MapsExternalLink>
                  ) : (
                    <span title={whereTile === publicAddress ? undefined : publicAddress}>
                      {whereTile}
                    </span>
                  )
                }
                support={locationPrecisionLabel}
              />
              <RecordFactTile
                icon={recordSectionIcon('era')}
                label="Era"
                value={
                  anatomyInputs.eraHref ? (
                    <Link href={anatomyInputs.eraHref} prefetch={false}>
                      {anatomyInputs.eraLabel}
                    </Link>
                  ) : (
                    anatomyInputs.eraLabel
                  )
                }
                support={
                  decadeCount > 0
                    ? `${plural(decadeCount, 'decade')} on record`
                    : 'No dated span yet'
                }
              />
              <RecordFactTile
                className={`ds-rec-tile--evidence ds-rec-tile--evidence-${anatomyInputs.evidenceTier}`}
                icon={confidenceIconFor(anatomyInputs.evidenceTier)}
                label="Evidence"
                value={
                  <Link href={evidenceHref} prefetch={false}>
                    {gradeWord}
                  </Link>
                }
                meter={{
                  level: meterLevelForTier(anatomyInputs.evidenceTier),
                  tone: anatomyInputs.evidenceTier,
                  label: `Evidence ${gradeWord}`,
                }}
                support={
                  sourceCount === 0
                    ? `${plural(displayClaims.length, 'claim')}`
                    : `${plural(displayClaims.length, 'claim')} from ${plural(sourceCount, 'source')}`
                }
              />
              <RecordFactTile
                icon={recordSectionIcon('trust')}
                label="Coverage"
                value={humanizeToken(entity.researchCoverage)}
                meter={{
                  level: meterLevelForCoverage(entity.researchCoverage),
                  tone: 'coverage',
                  label: `Research coverage ${humanizeToken(entity.researchCoverage)}`,
                }}
                support={humanizeToken(entity.recordMaturity)}
              />
            </dl>
            <div className="ds-rec-facts__actions">
              <Link className="ds-cta ds-cta--copper" href={exploreHref} scroll={false}>
                <FontAwesomeIcon
                  icon={faMapLocationDot}
                  className="ds-rec-inline-icon"
                  aria-hidden="true"
                />
                See it on the map
              </Link>
              {whereMapsHref ? (
                <MapsExternalLink
                  className="ds-cta ds-cta--quiet"
                  href={whereMapsHref}
                  placeLabel={publicAddress}
                  title={`Open ${publicAddress} in your maps app.`}
                >
                  <FontAwesomeIcon
                    icon={faArrowUpRightFromSquare}
                    className="ds-rec-inline-icon"
                    aria-hidden="true"
                  />
                  Open in maps
                </MapsExternalLink>
              ) : null}
              <Link className="ds-cta ds-cta--quiet" href={correctionsHref} prefetch={false}>
                <FontAwesomeIcon
                  icon={faPenToSquare}
                  className="ds-rec-inline-icon"
                  aria-hidden="true"
                />
                Correct this record
              </Link>
            </div>
          </div>
        </>
      }
    >
      <EntityTopicTags entity={entity} />

      {entity.sensitivity ? (
        <EntitySensitivityBanner sensitivity={entity.sensitivity} entityKind={entity.kind} />
      ) : null}

      {showVisit ? <RecordVisitBlock className="ds-record-visit--main" {...visitInput} /> : null}

      <EntityRoomSections
        entity={entity}
        evidenceClaims={evidenceClaims}
        entityLinkCatalog={entityLinkCatalog}
        {...(crossReferences.length > 0 ? { crossReferences } : {})}
      />

      <section className="ds-rec-session" aria-labelledby="session-heading">
        <RecordSmallTitle id="session-heading" icon="continue" as="h2">
          Keep reading
        </RecordSmallTitle>
        <p className="ds-rec-session__note">
          Step through the archive one record at a time, in catalog order or at random.
        </p>
        <EntitySessionNavClient currentId={entity.id} orderedIds={orderedIds} />
      </section>
    </Room>
  );
}
