/**
 * Entity detail page for place/school/event/institution public records.
 *
 * On the v9 room kit (a Record room with a right rail), not the retired v6 edition stack. The
 * split is the point: the rail holds the apparatus a reader consults: the glance facts, the
 * map and its precision caveat, the sources, the provenance and the research gaps, and the
 * column holds only what a person reads, so the record opens on its own history rather than on
 * four numbered boxes of metadata. The measure and the centring come from the `record` surface
 * class, which is why this route no longer sets a width of its own.
 *
 * Must stay dynamic: App Hosting mounts DATABASE_URL at RUNTIME only. Build-time static
 * `/entity/[id]` for seed-cluster ids previously baked `seed-snapshot` while non-seed ids
 * still read live Postgres (`rel_seed_001`). Same class of split as the map hero.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapsExternalLink } from '../../../components/map-experience/MapsExternalLink';
import type { PublicEntityView } from '../../../data/public-seed';
import { EntitySensitivityBanner } from '../../../components/entity/EntitySensitivityBanner';
import { EntityLocationCinematicMap } from '../../../components/entity/EntityLocationCinematicMap';
import '../../../components/entity/entity-page.css';
import { EntityMastMedia } from '../../../components/entity/EntityMastMedia';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { EntityTopicTags } from '../../../components/entity/EntityTopicTags';
import { HowToReadThisRecord } from '../../../components/trust';
import {
  Anatomy,
  Note,
  Precision,
  Room,
  RoomHeader,
  SourceList,
  TrustBlock,
  type RoomSource,
} from '../../../components/room';
import { RECORD_GAP_COPY, type RecordGapKind } from '../../../components/entity/copy';
import { humanizeToken } from '../../../components/entity/format';
import { geoAnchorFor } from '../../../lib/map-experience/entity-geo';
import { buildExternalMapsSearchUrl } from '../../../lib/geography/external-maps-url';
import {
  buildExploreHref,
  defaultExploreOverlayState,
} from '../../../lib/map-experience/url-state';
import { mapToneFromTopics } from '../../../lib/map-experience/kind-encoding';
import {
  entityEvidenceHref,
  exploreHrefForKind,
} from '../../../lib/map-experience/metadata-hrefs';
import { buildEntityPageMetadata } from '../../../lib/seo/metadata-builders';
import {
  getPublicSearchIndex,
  resolvePublicEntityView,
} from '../../../lib/public-data/source';
import { shouldUseLivePublicProjections } from '../../../lib/public-data/live-policy';
import { resolveEntityCrossReferences } from '../../../lib/theme-impact/source';
import { isDisplayableJurisdictionLabel } from '../../../lib/public-data/map-projection';
import { toEvidenceClaimInputs } from './adapters';
import { buildEntityAnatomyInputs } from './entity-anatomy-facts';
import { deriveHistoricalFraming } from './entity-view-model';
import { EntityRoomSections } from './EntityRoomSections';
import { EntitySessionNavClient } from './entity-session-nav-client';
import '../../record-page.css';
import './record-room.css';

/** Runtime Postgres reads; never bake Dunbar seed at build without DATABASE_URL. */
export const dynamic = 'force-dynamic';

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
  // Build time has no live Postgres connection (App Hosting mounts DATABASE_URL at runtime
  // only): skip enumeration rather than throw. This route is force-dynamic, so an empty
  // static param list is harmless; every id still renders on-demand at request time.
  if (!shouldUseLivePublicProjections()) {
    return [];
  }
  const { data: index } = await getPublicSearchIndex();
  return index.map((doc) => ({ id: doc.id }));
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
  const publisher = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
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

/** The gaps disclosed once, in the rail, in the approved vocabulary. */
function resolveRecordGaps(entity: PublicEntityView): readonly RecordGapKind[] {
  const gaps: RecordGapKind[] = [];
  if (entity.historicalContext.trim().length === 0) gaps.push('context');
  if (entity.claims.length === 0) gaps.push('claims');
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

  const framing = deriveHistoricalFraming(entity);
  const framingLabel = framing === 'present_day' ? 'Present-day record' : 'Historical record';
  const jurisdictionLabel = isDisplayableJurisdictionLabel(entity.jurisdictionLabel)
    ? entity.jurisdictionLabel.trim()
    : undefined;
  const mapTone = mapToneFromTopics(entity.topicIds ?? entity.topicTags);
  const evidenceClaims = toEvidenceClaimInputs(entity.claims);
  const geoAnchor = entity.geoAnchor ?? geoAnchorFor(entity.id);
  const mapsHref = buildExternalMapsSearchUrl({
    ...(geoAnchor ? { lat: geoAnchor.lat, lng: geoAnchor.lng } : {}),
    query: entity.locationLabel,
  });
  const entityLinkCatalog = entityLinkCatalogFromNeighbors(entity);
  const exploreHref = buildExploreHref({
    filters: { era: 'all', kind: 'all', tone: 'all', theme: 'all', status: 'all', confidence: 'all' },
    ...defaultExploreOverlayState(),
    selected: entity.id,
    ...(geoAnchor ? { viewport: { lat: geoAnchor.lat, lng: geoAnchor.lng, zoom: 11 } } : {}),
  });
  const { data: searchIndex } = await getPublicSearchIndex();
  const orderedIds = searchIndex.map((doc) => doc.id);
  const crossReferences = await resolveEntityCrossReferences(entity.id);

  const anatomyInputs = buildEntityAnatomyInputs(entity, mapTone);
  const sources = toRoomSources(entity.claims);
  // Rubric sentences, whole. They used to be truncated into chips next to the title.
  const inclusionBasis = entity.notabilityLabels ?? [];
  const gaps = resolveRecordGaps(entity);

  const rail = (
    <>
      <section className="ds-record-rail-block" aria-labelledby="anatomy-heading">
        <h2 className="ds-room-rail-group__title" id="anatomy-heading">
          At a glance
        </h2>
        <Anatomy
          label="Record anatomy"
          cells={[
            {
              label: 'Kind',
              value: (
                <Link href={exploreHrefForKind(anatomyInputs.kind)} prefetch={false}>
                  {anatomyInputs.kindLabel}
                </Link>
              ),
            },
            { label: 'Where', value: anatomyInputs.whereLabel },
            {
              label: 'Era',
              value: anatomyInputs.eraHref ? (
                <Link href={anatomyInputs.eraHref} prefetch={false}>
                  {anatomyInputs.eraLabel}
                </Link>
              ) : (
                anatomyInputs.eraLabel
              ),
            },
            {
              label: 'Evidence',
              value: (
                <Link href={entityEvidenceHref(`/entity/${entity.id}`)} prefetch={false}>
                  {anatomyInputs.evidenceLabel}
                </Link>
              ),
            },
          ]}
        />
      </section>

      {geoAnchor ? (
        <section className="ds-record-rail-block" aria-labelledby="where-heading">
          <h2 className="ds-room-rail-group__title" id="where-heading">
            Where
          </h2>
          <EntityLocationCinematicMap
            entityId={entity.id}
            lat={geoAnchor.lat}
            lng={geoAnchor.lng}
            label={entity.locationLabel}
            precision={entity.locationPrecision}
          />
          <Precision
            resolution={`${entity.locationPrecision} precision`}
            caveat="Exact residential addresses are never rendered on public pages."
          />
          <p className="ds-record-rail-block__actions">
            {mapsHref ? (
              <MapsExternalLink
                className="ds-cta ds-cta--copper"
                href={mapsHref}
                placeLabel={entity.locationLabel}
                title={`Open ${entity.locationLabel} in your maps app`}
              >
                Open in maps
              </MapsExternalLink>
            ) : null}
            <Link className="ds-cta ds-cta--quiet" href={exploreHref} scroll={false}>
              View on the map
            </Link>
          </p>
        </section>
      ) : null}

      {sources.length > 0 ? (
        <section className="ds-record-rail-block" aria-labelledby="sources-heading">
          <h2 className="ds-room-rail-group__title" id="sources-heading">
            Sources
          </h2>
          <SourceList sources={sources} />
        </section>
      ) : null}

      {inclusionBasis.length > 0 ? (
        <section className="ds-record-rail-block" aria-labelledby="why-heading">
          <h2 className="ds-room-rail-group__title" id="why-heading">
            Why this is here
          </h2>
          <ul className="ds-record-rail-block__reasons">
            {inclusionBasis.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ds-record-rail-block" aria-labelledby="provenance-heading">
        <h2 className="ds-room-rail-group__title" id="provenance-heading">
          About this record
        </h2>
        <TrustBlock
          label="Record provenance"
          facts={[
            { label: 'Maturity', value: humanizeToken(entity.recordMaturity) },
            { label: 'Coverage', value: humanizeToken(entity.researchCoverage) },
            { label: 'Sources', value: `${sources.length} cited` },
            { label: 'Updated', value: formatRecordDate(entity.revision.recordUpdatedAt) },
          ]}
        />
        {gaps.length > 0 ? (
          <Note kind="STILL RESEARCHING">
            {gaps.map((gap) => RECORD_GAP_COPY[gap].title).join('. ')}. These are gaps in the
            research, not an absence of history.
          </Note>
        ) : null}
        <p className="ds-record-rail-block__release ds-mono">{entity.revision.releaseId}</p>
      </section>

      <div className="ds-record-rail-block">
        <HowToReadThisRecord variant="compact" />
      </div>
    </>
  );

  return (
    <Room rail={rail}>
      <RoomHeader
        pathname={`/entity/${entity.id}`}
        crumbLabel={entity.displayName}
        kicker={anatomyInputs.kindLabel}
        title={entity.displayName}
        lede={
          /* `as="span"`: RoomHeader's lede is already a <p>, and LinkedProse defaults to one,
             which nested a paragraph inside a paragraph and threw a hydration error. */
          <LinkedProse
            as="span"
            text={entity.summary}
            skipEntityIds={[entity.id]}
            catalog={entityLinkCatalog}
          />
        }
        meta={[anatomyInputs.whereLabel, anatomyInputs.eraLabel, framingLabel]}
        showPath={false}
      />

      {entity.primaryImage !== undefined ? (
        <figure className="ds-record-mast">
          <EntityMastMedia
            entityId={entity.id}
            entityName={entity.displayName}
            kind={entity.kind}
            {...(jurisdictionLabel !== undefined ? { jurisdictionLabel } : {})}
            primaryImage={entity.primaryImage}
            priority
          />
        </figure>
      ) : null}

      <EntityTopicTags entity={entity} />

      {entity.sensitivity ? (
        <EntitySensitivityBanner sensitivity={entity.sensitivity} entityKind={entity.kind} />
      ) : null}

      <EntityRoomSections
        entity={entity}
        framing={framing}
        evidenceClaims={evidenceClaims}
        entityLinkCatalog={entityLinkCatalog}
        {...(crossReferences.length > 0 ? { crossReferences } : {})}
      />

      <EntitySessionNavClient currentId={entity.id} orderedIds={orderedIds} />
    </Room>
  );
}
