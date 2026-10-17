/**
 * Admin home — operations desk with actionable queue cards and env posture.
 */
import Link from 'next/link';
import { DeskTitleBar, Panel, StatGrid, StatTile } from '../../admin/design-system/ui';
import { redirect } from 'next/navigation';
import { readVerifiedAdminIdentity } from '../../admin/auth/supabase-server';
import { AdminHomeSessionCta } from '../../admin/ops/AdminHomeSessionCta';
import { loadOpsEnvironment, loadOpsQueueSummary } from '../../admin/ops/ops-summary';

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
  // Gate before the reads, not after: queue counts and env posture are staff-only, and
  // loadOpsQueueSummary() hits Postgres. This route sits outside every route-group layout,
  // so it has no RequireAdminAuth wrapper of its own.
  if (!(await readVerifiedAdminIdentity())) {
    redirect('/admin/login');
  }

  const [queues, env] = await Promise.all([
    loadOpsQueueSummary(),
    Promise.resolve(loadOpsEnvironment()),
  ]);

  const researchMetric = formatQueueMetric(
    queues.researchCasePending,
    queues.researchCaseSource,
    'Pending research cases',
  );
  const submissionsMetric = formatQueueMetric(
    queues.submissionsPending,
    queues.submissionsSource,
    'Submissions',
  );
  const storyMetric = formatQueueMetric(
    queues.storyPacketsPending,
    queues.storyPacketsSource,
    'Pending story packets',
  );

  const count = (metric: { text: string; unavailable: boolean }) =>
    metric.unavailable ? 'Unavailable' : metric.text;
  const tone = (metric: { unavailable: boolean }, value: string) =>
    metric.unavailable ? 'muted' : Number(value) > 0 ? 'attention' : 'default';

  return (
    <main className="ds-container ds-page" id="main">
      <DeskTitleBar
        eyebrow="Operations"
        title="Work"
        meta={
          <>
            <span>{env.appEnv}</span>
            <span aria-hidden="true">·</span>
            <span>{env.dataSource}</span>
            {env.productionBreakGlass ? (
              <>
                <span aria-hidden="true">·</span>
                <span>production break-glass</span>
              </>
            ) : null}
          </>
        }
        description="What is waiting for a decision. Staff decisions are audited; publication is a separate step."
      />

      <StatGrid label="Queues waiting for review">
        <StatTile
          label="Submissions"
          value={count(submissionsMetric)}
          tone={tone(submissionsMetric, submissionsMetric.text)}
          hint="Corrections, appeals, reports and leads"
          href="/admin/submissions"
        />
        <StatTile
          label="Inbox"
          value={count(researchMetric)}
          tone={tone(researchMetric, researchMetric.text)}
          hint="Research cases to triage"
          href="/admin/inbox"
        />
        <StatTile
          label="Story review"
          value={count(storyMetric)}
          tone={tone(storyMetric, storyMetric.text)}
          hint="Packets before they become articles"
          href="/admin/stories/review"
        />
      </StatGrid>

      <div className="admin-base-two-col">
        <Panel
          title="Jump to"
          description="The desks used most, in the order work flows through them."
        >
          <ul className="admin-base-linklist">
            <li>
              <Link href="/admin/quick-add">Quick add</Link>
              <span>Submit a source URL with a draft case</span>
            </li>
            <li>
              <Link href="/admin/cases">All research cases</Link>
              <span>Every state, not only the inbox</span>
            </li>
            <li>
              <Link href="/admin/catalog">Entities</Link>
              <span>Canonical records already in the archive</span>
            </li>
            <li>
              <Link href="/admin/releases">Releases</Link>
              <span>Stage decisions; activation needs the publication executor</span>
            </li>
          </ul>
        </Panel>
        <Panel title="Session" description="Who you are signed in as.">
          <AdminHomeSessionCta />
        </Panel>
      </div>
    </main>
  );
}
