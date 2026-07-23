/**
 * Entity detail page for place/school/event/institution public records. v6 edition:
 * Surface stack with gutter mosaic atmosphere, RecordAnatomyPanel orientation, and
 * fail-closed media/geo/map states. Session nav and force-dynamic routing preserved.
 *
 * Must stay dynamic: App Hosting mounts DATABASE_URL at RUNTIME only. Build-time static
 * `/entity/[id]` for seed-cluster ids previously baked `seed-snapshot` while non-seed ids
 * still read live Postgres (`rel_seed_001`). Same class of split as the map hero.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditionAtmosphereMosaic } from '../../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import {
  EDITION_MOSAIC_COUNT_DETAIL,
} from '../../../components/patterns/edition-atmosphere/edition-atmosphere-config';
import {
  RecordAnatomyPanel,
  type RecordAnatomyFact,
} from '../../../components/patterns/RecordAnatomyPanel';
import { KindBadge } from '../../../components/map-experience';
import { MapsExternalLink } from '../../../components/map-experience/MapsExternalLink';
import { EntitySensitivityBanner } from '../../../components/entity/EntitySensitivityBanner';
import '../../../components/entity/entity-page.css';
import { EntityMastMedia } from '../../../components/entity/EntityMastMedia';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { EntityTopicTags } from '../../../components/entity/EntityTopicTags';
import { HowToReadThisRecord } from '../../../components/trust';
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
import { isDisplayableJurisdictionLabel } from '../../../lib/public-data/map-projection';
import {
  buildWhyThisAppearsForEntity,
  toEvidenceClaimInputs,
  whyAppearsEvidenceById,
} from './adapters';
import {
  buildEntityAnatomyInputs,
  buildEntityAnatomyPlace,
} from './entity-anatomy-facts';
import { deriveHistoricalFraming } from './entity-view-model';
import { EntityEditionSections } from './EntityEditionSections';
import { EntitySessionNavClient } from './entity-session-nav-client';
import {
  entityEditionMosaicSeedFor,
  entityEditionPanelClassName,
  entityEditionRootClassName,
  entityEditionStackClassName,
} from './entity-panel-chrome';
import './entity-edition.css';

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
  const mapTone = mapToneFromTopics(entity.topicTags);
  const whyThisAppears = (() => {
    try {
      return buildWhyThisAppearsForEntity(entity);
    } catch {
      return undefined;
    }
  })();
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

  const anatomyInputs = buildEntityAnatomyInputs(entity, mapTone);
  const anatomyPlace = buildEntityAnatomyPlace(entity, geoAnchor);
  const kindIcon =
    anatomyInputs.mapTone !== undefined
      ? {
          variant: 'record-kind' as const,
          kind: anatomyInputs.kind,
          mapTone: anatomyInputs.mapTone,
        }
      : { variant: 'record-kind' as const, kind: anatomyInputs.kind };
  const anatomyFacts: readonly RecordAnatomyFact[] = [
    {
      key: 'kind',
      label: 'Kind',
      value: (
        <Link
          className="ds-record-anatomy__fact-link"
          href={exploreHrefForKind(anatomyInputs.kind)}
          aria-label={`Browse ${anatomyInputs.kindLabel} records`}
        >
          {anatomyInputs.kindLabel}
        </Link>
      ),
      icon: kindIcon,
    },
    {
      key: 'where',
      label: 'Where',
      value: anatomyInputs.whereLabel,
      icon: { variant: 'record-where' },
    },
    {
      key: 'era',
      label: 'Era',
      value: anatomyInputs.eraHref ? (
        <Link
          className="ds-record-anatomy__fact-link"
          href={anatomyInputs.eraHref}
          aria-label={`Browse records from the ${anatomyInputs.eraLabel}`}
        >
          {anatomyInputs.eraLabel}
        </Link>
      ) : (
        anatomyInputs.eraLabel
      ),
      icon: { variant: 'record-era' },
    },
    {
      key: 'evidence',
      label: 'Evidence',
      value: (
        <Link
          className="ds-record-anatomy__fact-link"
          href={entityEvidenceHref(`/entity/${entity.id}`)}
          aria-label={`View ${anatomyInputs.evidenceLabel} on this record`}
        >
          {anatomyInputs.evidenceLabel}
        </Link>
      ),
      icon: { variant: 'record-evidence', tier: anatomyInputs.evidenceTier },
    },
  ];

  return (
    <div className={entityEditionRootClassName()} data-entity-edition="v6">
      <EditionAtmosphereMosaic seedKey={entityEditionMosaicSeedFor(entity.id)} count={EDITION_MOSAIC_COUNT_DETAIL} />
      <main className="ds-container ds-page" id="main">
        <div className={entityEditionStackClassName()}>
          <article className={entityEditionPanelClassName('intro')}>
            <header className="ds-entity-edition__header">
              <span className="ds-entity-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-entity-edition__kicker">Record</p>
                <p className="ds-entity-edition__meta-row">
                  <KindBadge kind={entity.kind} {...(mapTone !== undefined ? { mapTone } : {})} />
                  {jurisdictionLabel ? (
                    <>
                      <span className="ds-entity-edition__meta-sep" aria-hidden="true">
                        ·
                      </span>
                      <span className="ds-mono">{jurisdictionLabel}</span>
                    </>
                  ) : null}
                  <span className="ds-entity-edition__meta-sep" aria-hidden="true">
                    ·
                  </span>
                  <span>{framingLabel}</span>
                </p>
                <h1 className="ds-entity-edition__title">{entity.displayName}</h1>
                <LinkedProse
                  className="ds-entity-edition__lede"
                  text={entity.summary}
                  skipEntityIds={[entity.id]}
                  catalog={entityLinkCatalog}
                />
                <EntityTopicTags entity={entity} />
              </div>
            </header>
            <div className="ds-entity-edition__intro-grid">
              <div className="ds-entity-edition__media">
                <EntityMastMedia
                  entityId={entity.id}
                  entityName={entity.displayName}
                  kind={entity.kind}
                  {...(jurisdictionLabel !== undefined ? { jurisdictionLabel } : {})}
                  {...(entity.primaryImage !== undefined ? { primaryImage: entity.primaryImage } : {})}
                  priority
                />
              </div>
            </div>
          </article>

          <article
            className={entityEditionPanelClassName('anatomy')}
            aria-labelledby="entity-anatomy-heading"
          >
            <header className="ds-entity-edition__header">
              <span className="ds-entity-edition__index" aria-hidden="true">
                01
              </span>
              <div>
                <p className="ds-entity-edition__kicker">Anatomy</p>
                <h2 className="ds-entity-edition__panel-heading" id="entity-anatomy-heading">
                  Record at a glance
                </h2>
              </div>
            </header>
            <RecordAnatomyPanel
              facts={anatomyFacts}
              {...(anatomyPlace ? { place: anatomyPlace } : {})}
              aria-label="Record anatomy"
            />
            <p className="ds-entity-edition__actions">
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
                View on national map
              </Link>
            </p>
            <p className="ds-entity-edition__precision">
              Location precision: <strong>{entity.locationPrecision}</strong>. Showing{' '}
              {entity.locationLabel}. Exact residential addresses are never rendered on public pages.
            </p>
          </article>

          <div className="ds-entity-edition__trust">
            <HowToReadThisRecord variant="compact" />
          </div>

          {entity.sensitivity ? (
            <EntitySensitivityBanner sensitivity={entity.sensitivity} entityKind={entity.kind} />
          ) : null}

          <EntityEditionSections
            entity={entity}
            framing={framing}
            whyThisAppears={whyThisAppears}
            whyAppearsEvidenceById={whyAppearsEvidenceById(entity)}
            evidenceClaims={evidenceClaims}
            entityLinkCatalog={entityLinkCatalog}
          />

          <EntitySessionNavClient
            currentId={entity.id}
            orderedIds={orderedIds}
          />
        </div>
      </main>
    </div>
  );
}
