/**
 * Entity detail scaffold for seed public records.
 * Full projection depth (BB-019) and evidence UI (BB-053) remain placeholders.
 */

import { notFound } from 'next/navigation';
import {
  Card,
  Citation,
  Confidence,
  MapFrame,
  Notice,
  Timeline,
} from '@black-book/ui';
import { SeedDataNotice } from '../../../components/SeedDataNotice';
import { getPublicEntity, listPublicEntities } from '../../../data/public-seed';

type EntityPageProps = {
  readonly params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return listPublicEntities().map((entity) => ({ id: entity.id }));
}

export async function generateMetadata({ params }: EntityPageProps) {
  const { id } = await params;
  const entity = getPublicEntity(id);
  if (!entity) {
    return { title: 'Record not found' };
  }
  return {
    title: entity.displayName,
    description: entity.summary,
  };
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params;
  const entity = getPublicEntity(id);
  if (!entity) {
    notFound();
  }

  const related = entity.relatedIds
    .map((relatedId) => getPublicEntity(relatedId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <main className="bb-container bb-page" id="main">
      <header className="bb-entity-mast">
        <p className="bb-page__eyebrow">
          {entity.kind} · {entity.jurisdictionLabel}
        </p>
        <h1 className="bb-page__title">{entity.displayName}</h1>
        <p className="bb-page__lede">{entity.summary}</p>
      </header>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <SeedDataNotice compact />

        <div className="bb-entity-layout">
          <div className="bb-stack">
            <section aria-labelledby="relevance-heading">
              <p className="bb-section__kicker">Relevance</p>
              <h2 className="bb-section__title" id="relevance-heading">
                Why this appears
              </h2>
              <p className="bb-section__lede">{entity.relevanceExplanation}</p>
              {/* TODO(BB-054): replace with released “why this appears” narrative from projections */}
            </section>

            <section aria-labelledby="claims-heading">
              <p className="bb-section__kicker">Claims</p>
              <h2 className="bb-section__title" id="claims-heading">
                Accepted claims
              </h2>
              {entity.claims.length === 0 ? (
                <p className="bb-sans" style={{ color: 'var(--bb-ink-muted)' }}>
                  No published claims are attached to this seed fixture yet.
                </p>
              ) : (
                <div className="bb-stack" style={{ marginTop: 'var(--bb-space-4)' }}>
                  {entity.claims.map((claim) => (
                    <Card
                      key={claim.id}
                      title={`${claim.predicate.replaceAll('_', ' ')}: ${claim.object}`}
                      meta={<span className="bb-mono">{claim.id}</span>}
                    >
                      <div className="bb-row" style={{ marginBottom: 'var(--bb-space-3)' }}>
                        <Confidence level={claim.confidenceLevel} />
                        <span className="bb-mono">score {claim.confidenceScore.toFixed(2)}</span>
                      </div>
                      <Citation
                        source={claim.citationSource}
                        label={claim.citationLabel}
                        {...(claim.citationHref ? { href: claim.citationHref } : {})}
                      />
                      {claim.disputed ? (
                        <div style={{ marginTop: 'var(--bb-space-3)' }}>
                          <Notice tone="dispute" title="Preserved contradiction">
                            {claim.disputeNote}
                          </Notice>
                        </div>
                      ) : null}
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="timeline-heading">
              <p className="bb-section__kicker">Chronology</p>
              <h2 className="bb-section__title" id="timeline-heading">
                Timeline
              </h2>
              <div style={{ marginTop: 'var(--bb-space-4)' }}>
                <Timeline labelledBy="timeline-heading" items={entity.timeline} />
              </div>
            </section>

            <section aria-labelledby="related-heading">
              <p className="bb-section__kicker">More</p>
              <h2 className="bb-section__title" id="related-heading">
                Related records
              </h2>
              {related.length === 0 ? (
                <p className="bb-sans" style={{ color: 'var(--bb-ink-muted)' }}>
                  No related sample records.
                </p>
              ) : (
                <ul className="bb-story-rail" aria-labelledby="related-heading">
                  {related.map((item) => (
                    <li key={item.id}>
                      <a className="bb-story-link" href={`/entity/${item.id}`}>
                        <span className="bb-story-link__meta">{item.kind}</span>
                        <h3 className="bb-story-link__title">{item.displayName}</h3>
                        <p className="bb-story-link__summary">{item.summary}</p>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="bb-placeholder" role="note">
              <p className="bb-placeholder__title">Evidence & projection depth</p>
              <p style={{ margin: 0 }}>
                Full evidence browser, revision history, and immutable snapshot payloads arrive with
                BB-019 public projections and BB-053 evidence UI. This scaffold renders seed-safe
                fields only.
              </p>
              {/* TODO(BB-015/BB-019): route person/location fields through public serializers + redaction */}
            </div>
          </div>

          <aside className="bb-entity-aside" aria-label="Record context">
            <Notice tone="warning" title={`Location precision: ${entity.locationPrecision}`}>
              Showing {entity.locationLabel}. Exact residential addresses are never rendered on
              public pages.
            </Notice>

            <Card
              title="Record maturity"
              meta={<span className="bb-mono">{entity.recordMaturity}</span>}
              as="section"
            >
              <p className="bb-sans" style={{ margin: 0 }}>
                Research coverage: <strong>{entity.researchCoverage}</strong>. Maturity labels
                follow the product constitution vocabulary and will be projection-backed in BB-019.
              </p>
            </Card>

            <MapFrame
              title={`${entity.displayName} map context`}
              caption="Schematic pin — not survey-grade geometry."
              pins={[
                {
                  id: entity.id,
                  label: entity.displayName,
                  x: entity.mapPin.x,
                  y: entity.mapPin.y,
                },
              ]}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
