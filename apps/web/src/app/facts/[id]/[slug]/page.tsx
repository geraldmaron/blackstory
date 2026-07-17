/**
 * Canonical fact detail page at `/facts/{id}/{slug}`.
 *
 * Cosmetic slug mismatches 301 to the current slug. Deprecated/superseded/corrected records stay
 * resolvable with a banner never 404. Emits Article JSON-LD (never ClaimReview).
 */
import { notFound, permanentRedirect } from 'next/navigation';
import { Card } from '@black-book/ui';
import { SeedDataNotice } from '../../../../components/SeedDataNotice';
import {
  FactCitationList,
  FactConfidencePanel,
  FactJsonLdScript,
  FactRevisionPanel,
  FactStatusBanner,
  FactSubjectList,
  humanizeToken,
} from '../../../../components/facts';
import {
  CommonMisreadings,
  HowToReadThisRecord,
  RevisionUpdateChrome,
} from '../../../../components/trust';
import { buildFactJsonPath, buildFactRevisionPath, slugifyFactStatement } from '@black-book/domain';
import { listPublicFactStaticParams, resolvePublicFact } from '../../resolve-public-fact';

type FactPageProps = {
  readonly params: Promise<{ readonly id: string; readonly slug: string }>;
};

export async function generateStaticParams() {
  return [...listPublicFactStaticParams()];
}

export async function generateMetadata({ params }: FactPageProps) {
  const { id, slug } = await params;
  const resolved = resolvePublicFact(id, slug);
  if (resolved.kind !== 'ok') {
    return { title: 'Fact not found' };
  }
  return {
    title: resolved.fact.shortStatement,
    description: resolved.fact.statement,
    alternates: {
      canonical: `/facts/${resolved.fact.id}/${slugifyFactStatement(resolved.fact.shortStatement)}`,
      types: {
        'application/json': buildFactJsonPath(resolved.fact.id),
      },
    },
  };
}

export default async function FactDetailPage({ params }: FactPageProps) {
  const { id, slug } = await params;
  const resolved = resolvePublicFact(id, slug);
  if (resolved.kind === 'not_found' || resolved.kind === 'not_public') {
    notFound();
  }
  if (resolved.kind === 'redirect') {
    permanentRedirect(resolved.destination);
  }

  const fact = resolved.fact;
  const currentRevision = fact.revisions[fact.revisions.length - 1];

  return (
    <main className="bb-container bb-page" id="main">
      <FactJsonLdScript fact={fact} />

      <header className="bb-entity-mast">
        <p className="bb-page__eyebrow">
          Fact · {humanizeToken(fact.claimType)} · <span className="bb-mono">{fact.id}</span>
        </p>
        <h1 className="bb-page__title">{fact.shortStatement}</h1>
        <p className="bb-page__lede">{fact.statement}</p>
      </header>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <SeedDataNotice compact />
        <FactStatusBanner fact={fact} />
        <RevisionUpdateChrome fact={fact} />
        <HowToReadThisRecord />

        <section aria-labelledby="subjects-heading">
          <p className="bb-section__kicker">Graph</p>
          <h2 className="bb-section__title" id="subjects-heading">
            Subjects
          </h2>
          <div style={{ marginTop: 'var(--bb-space-4)' }}>
            <FactSubjectList subjects={fact.subjects} labelledBy="subjects-heading" />
          </div>
        </section>

        <FactConfidencePanel fact={fact} />

        <section aria-labelledby="citations-heading">
          <p className="bb-section__kicker">Sources</p>
          <h2 className="bb-section__title" id="citations-heading">
            Citations
          </h2>
          <div style={{ marginTop: 'var(--bb-space-4)' }}>
            <FactCitationList citations={fact.citations} labelledBy="citations-heading" />
          </div>
        </section>

        {fact.counterClaims.length > 0 ? (
          <section aria-labelledby="counterclaims-heading">
            <p className="bb-section__kicker">Pre-bunking</p>
            <h2 className="bb-section__title" id="counterclaims-heading">
              Common misreadings
            </h2>
            <div style={{ marginTop: 'var(--bb-space-4)' }}>
              <CommonMisreadings
                counterClaims={fact.counterClaims}
                labelledBy="counterclaims-heading"
              />
            </div>
          </section>
        ) : null}

        <section aria-labelledby="revision-heading">
          <p className="bb-section__kicker">History</p>
          <h2 className="bb-section__title" id="revision-heading">
            Revision history
          </h2>
          <div style={{ marginTop: 'var(--bb-space-4)' }}>
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
          <p className="bb-sans" style={{ margin: 0 }}>
            <a href={buildFactJsonPath(fact.id)}>Download this fact as JSON</a> (CSL-JSON citations + extension
            block). JSON-LD uses schema.org <span className="bb-mono">Article</span>, never ClaimReview.
          </p>
          {currentRevision ? (
            <p className="bb-sans" style={{ margin: 'var(--bb-space-2) 0 0 0' }}>
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
