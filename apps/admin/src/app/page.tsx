/**
 * Admin home — operations desk with actionable queue cards and env posture.
 */
import Link from 'next/link';
import { AdminHomeSessionCta } from '../ops/AdminHomeSessionCta';
import { loadOpsEnvironment, loadOpsQueueSummary } from '../ops/ops-summary';

function formatQueueMetric(
  value: number | undefined,
  source: 'live' | 'unavailable',
  label: string,
): { text: string; unavailable: boolean } {
  if (source === 'unavailable') {
    return { text: `${label} unavailable`, unavailable: true };
  }
  return { text: String(value ?? 0), unavailable: false };
}

export default async function AdminHomePage() {
  const [queues, env] = await Promise.all([
    loadOpsQueueSummary(),
    Promise.resolve(loadOpsEnvironment()),
  ]);

  const publicOriginLabel = env.publicSiteOrigin ?? 'public origin unset';
  const researchMetric = formatQueueMetric(
    queues.researchCasePending,
    queues.researchCaseSource,
    'Pending research cases',
  );
  const storyMetric = formatQueueMetric(
    queues.storyPacketsPending,
    queues.storyPacketsSource,
    'Pending story packets',
  );

  return (
    <main className="admin-home admin-ops" id="main">
      <section className="admin-ops__panel" aria-labelledby="admin-home-title">
        <p className="admin-ops__eyebrow">Operations</p>
        <h1 className="admin-ops__title" id="admin-home-title">
          BlackStory Admin
        </h1>
        <p className="admin-ops__lede">
          Triage research cases, review story packets, browse the catalog, and manage releases.
        </p>

        <p className="admin-ops__env" aria-label="Runtime environment">
          <span>{env.appEnv}</span>
          <span aria-hidden="true"> · </span>
          <span>{env.firebaseProjectId}</span>
          <span aria-hidden="true"> · </span>
          <span>{env.authMode}</span>
          <span aria-hidden="true"> · </span>
          <span>{publicOriginLabel}</span>
          {env.productionBreakGlass ? (
            <>
              <span aria-hidden="true"> · </span>
              <span>production break-glass</span>
            </>
          ) : null}
        </p>

        <nav className="admin-ops__queues" aria-label="Operations queues">
          <Link className="admin-ops__card" href="/inbox">
            <span className="admin-ops__card-label">Inbox</span>
            {researchMetric.unavailable ? (
              <span className="admin-ops__card-metric" role="status">
                unavailable
              </span>
            ) : (
              <span className="admin-ops__card-metric">
                {researchMetric.text} pending
              </span>
            )}
            <span className="admin-ops__card-detail">
              Decide on candidates and relevance review
            </span>
          </Link>

          <Link className="admin-ops__card" href="/stories/review">
            <span className="admin-ops__card-label">Story review</span>
            {storyMetric.unavailable ? (
              <span className="admin-ops__card-metric" role="status">
                unavailable
              </span>
            ) : (
              <span className="admin-ops__card-metric">
                {storyMetric.text} pending
              </span>
            )}
            <span className="admin-ops__card-detail">
              Review staged story packets (approve does not publish)
            </span>
          </Link>

          <Link className="admin-ops__card" href="/catalog">
            <span className="admin-ops__card-label">Catalog</span>
            <span className="admin-ops__card-metric">What exists</span>
            <span className="admin-ops__card-detail">
              Browse canonical entities and places
            </span>
          </Link>

          <Link className="admin-ops__card" href="/cases">
            <span className="admin-ops__card-label">All cases</span>
            <span className="admin-ops__card-metric">Every state</span>
            <span className="admin-ops__card-detail">
              Search research cases beyond the inbox
            </span>
          </Link>

          <Link className="admin-ops__card" href="/releases">
            <span className="admin-ops__card-label">Releases</span>
            <span className="admin-ops__card-metric">Publication desk</span>
            <span className="admin-ops__card-detail">
              Preview and activate release candidates
            </span>
          </Link>

          <Link className="admin-ops__card" href="/quick-add">
            <span className="admin-ops__card-label">Quick add</span>
            <span className="admin-ops__card-metric">New intake</span>
            <span className="admin-ops__card-detail">
              Stage or commit a URL into quarantine
            </span>
          </Link>
        </nav>

        <AdminHomeSessionCta />
      </section>
    </main>
  );
}
