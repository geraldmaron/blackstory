/**
 * Canonical fact detail page at `/facts/{slug}`.
 *
 * Bare fact ids and stale slugs 301 to the current slug. Deprecated/superseded/corrected records
 * stay resolvable with a banner never 404. Emits Article JSON-LD (never ClaimReview).
 */
import { notFound, permanentRedirect } from 'next/navigation';
import { Card } from '@repo/ui';
import {
  FactCitationList,
  FactConfidencePanel,
  FactJsonLdScript,
  FactRevisionPanel,
  FactStatusBanner,
  FactSubjectList,
  humanizeToken,
} from '../../../components/facts';
import {
  CommonMisreadings,
  HowToReadThisRecord,
  RevisionUpdateChrome,
} from '../../../components/trust';
import { buildFactJsonPath, buildFactPath, buildFactRevisionPath } from '@repo/domain';
import { getPublicEntity } from '../../../data/public-seed';
import { listPublicFactStaticParams, resolvePublicFact } from '../resolve-public-fact';

type FactPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function generateStaticParams() {
  return [...listPublicFactStaticParams()];
}

export async function generateMetadata({ params }: FactPageProps) {
  const { id } = await params;
  const resolved = resolvePublicFact(id);
  if (resolved.kind === 'redirect') {
    return { alternates: { canonical: resolved.destination } };
  }
  if (resolved.kind !== 'ok') {
    return { title: 'Fact not found' };
  }
  return {
    title: resolved.fact.shortStatement,
    description: resolved.fact.statement,
    alternates: {
      canonical: buildFactPath(resolved.fact.id, resolved.fact.slug),
      types: {
        'application/json': buildFactJsonPath(resolved.fact.id),
      },
    },
  };
}

export default async function FactDetailPage({ params }: FactPageProps) {
  const { id } = await params;
  const resolved = resolvePublicFact(id);
  if (resolved.kind === 'not_found' || resolved.kind === 'not_public') {
    notFound();
  }
  if (resolved.kind === 'redirect') {
    permanentRedirect(resolved.destination);
  }

  const fact = resolved.fact;
  const currentRevision = fact.revisions[fact.revisions.length - 1];
  const subjectLabels = Object.fromEntries(
    fact.subjects.flatMap((subject) => {
      const entity = getPublicEntity(subject.entityId);
      return entity?.displayName ? [[subject.entityId, entity.displayName] as const] : [];
    }),
  );

  return (
    <main className="ds-container ds-page" id="main">
      <FactJsonLdScript fact={fact} />

      <header className="ds-entity-mast">
        <p className="ds-page__eyebrow">
          Fact · {humanizeToken(fact.claimType)} · <span className="ds-mono">{fact.id}</span>
        </p>
        <h1 className="ds-page__title">{fact.shortStatement}</h1>
        <p className="ds-page__lede">{fact.statement}</p>
      </header>

      <div className="ds-stack" style={{ marginTop: 'var(--ds-space-6)' }}>
        <FactStatusBanner fact={fact} />
        <RevisionUpdateChrome fact={fact} />
        <HowToReadThisRecord />

        <section aria-labelledby="subjects-heading">
          <p className="ds-section__kicker">Graph</p>
          <h2 className="ds-section__title" id="subjects-heading">
            Subjects
          </h2>
          <div style={{ marginTop: 'var(--ds-space-4)' }}>
            <FactSubjectList
              subjects={fact.subjects}
              labelledBy="subjects-heading"
              {...(Object.keys(subjectLabels).length > 0 ? { labelsByEntityId: subjectLabels } : {})}
            />
          </div>
        </section>

        <FactConfidencePanel fact={fact} />

        <section aria-labelledby="citations-heading">
          <p className="ds-section__kicker">Sources</p>
          <h2 className="ds-section__title" id="citations-heading">
            Citations
          </h2>
          <div style={{ marginTop: 'var(--ds-space-4)' }}>
            <FactCitationList citations={fact.citations} labelledBy="citations-heading" />
          </div>
        </section>

        {fact.counterClaims.length > 0 ? (
          <section aria-labelledby="counterclaims-heading">
            <p className="ds-section__kicker">Pre-bunking</p>
            <h2 className="ds-section__title" id="counterclaims-heading">
              Common misreadings
            </h2>
            <div style={{ marginTop: 'var(--ds-space-4)' }}>
              <CommonMisreadings
                counterClaims={fact.counterClaims}
                labelledBy="counterclaims-heading"
              />
            </div>
          </section>
        ) : null}

        <section aria-labelledby="revision-heading">
          <p className="ds-section__kicker">History</p>
          <h2 className="ds-section__title" id="revision-heading">
            Revision history
          </h2>
          <div style={{ marginTop: 'var(--ds-space-4)' }}>
            <FactRevisionPanel
              fact={fact}
              {...(currentRevision?.revisionNumber !== undefined
                ? { currentRevisionNumber: currentRevision.revisionNumber }
                : {})}
              labelledBy="revision-heading"
            />
          </div>
        </section>

        <Card title="Machine-readable export" as="section">
          <p className="ds-sans" style={{ margin: 0 }}>
            <a href={buildFactJsonPath(fact.id)}>Download this fact as JSON</a> (CSL-JSON citations +
            extension block). JSON-LD uses schema.org <span className="ds-mono">Article</span>, never
            ClaimReview.
          </p>
          {currentRevision ? (
            <p className="ds-sans" style={{ margin: 'var(--ds-space-2) 0 0 0' }}>
              Current revision permalink:{' '}
              <a href={buildFactRevisionPath(fact.id, currentRevision.revisionNumber)}>
                /facts/{fact.id}/rev/{currentRevision.revisionNumber}
              </a>
            </p>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
