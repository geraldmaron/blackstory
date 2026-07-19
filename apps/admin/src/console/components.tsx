/**
 * Renders the accessible administration shell, fixture tables, and permission-gated action previews.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CONSOLE_SURFACES } from './fixtures';
import type { ConsoleAction, ConsoleDataSource, ConsoleSurface, PublicationDiff } from './model';

const LIVE_BACKED_SURFACE_IDS = new Set(['candidate-queue', 'research-cases']);

function recordCountLabel(count: number, dataSource: ConsoleDataSource): string {
  switch (dataSource) {
    case 'live':
      return `${count} live record${count === 1 ? '' : 's'}`;
    case 'fixture':
      return `${count} sample fixture${count === 1 ? '' : 's'}`;
    case 'unavailable':
      return 'Unavailable — sample fixtures';
  }
}

function recordTableCaption(surfaceLabel: string, count: number, dataSource: ConsoleDataSource): string {
  switch (dataSource) {
    case 'live':
      return `${surfaceLabel}: ${count} live record${count === 1 ? '' : 's'}`;
    case 'fixture':
      return `${surfaceLabel}: ${count} sample fixture${count === 1 ? '' : 's'}`;
    case 'unavailable':
      return `${surfaceLabel}: unavailable — sample fixtures`;
  }
}

function overviewCountLabel(
  surface: ConsoleSurface,
  liveCounts?: { readonly candidates: number | null },
): string {
  if (LIVE_BACKED_SURFACE_IDS.has(surface.id) && liveCounts) {
    if (liveCounts.candidates === null) {
      return 'Unavailable — sample fixtures';
    }
    const count = liveCounts.candidates;
    return `${count} pending research case${count === 1 ? '' : 's'}`;
  }
  return `${surface.rows.length} sample fixture${surface.rows.length === 1 ? '' : 's'}`;
}

export function ConsoleLegacyBanner() {
  return (
    <div
      className="console-legacy-banner"
      role="note"
      aria-label="Legacy console notice"
    >
      <p>
        <strong>Legacy fixture shell.</strong> Live triage is{' '}
        <Link href="/inbox">Inbox</Link> and <Link href="/cases">Cases</Link>.
      </p>
      <div className="console-legacy-banner__actions">
        <Link className="console-legacy-banner__primary" href="/inbox">
          Open inbox
        </Link>
        <Link className="console-legacy-banner__secondary" href="/">
          Operations home
        </Link>
      </div>
    </div>
  );
}

export function ConsoleShell({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <a className="ds-visually-hidden" href="#console-content">
        Skip to console content
      </a>
      <header className="console-header">
        <div>
          <p className="console-kicker">Legacy fixture shell</p>
          <Link className="console-brand" href="/console">
            BlackStory Admin
          </Link>
        </div>
        <p className="console-session" aria-label="Authentication status">
          IAP + Firebase session required
        </p>
      </header>
      <ConsoleLegacyBanner />
      <div className="console-frame">
        <nav className="console-nav" aria-label="Legacy console workspaces">
          <p className="console-nav__label">Fixture workspaces</p>
          <ul>
            {CONSOLE_SURFACES.map((surface) => (
              <li key={surface.id}>
                <Link href={`/console/${surface.id}`}>{surface.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="console-main" id="console-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}

export function ConsoleOverview({
  liveCounts,
}: {
  readonly liveCounts?: { readonly candidates: number | null };
}) {
  return (
    <div className="console-page">
      <header className="console-page__header">
        <p className="console-kicker">Legacy fixture shell</p>
        <h1>Administration console</h1>
        <p>
          Fixture workspaces for publication-boundary previews and guarded-action contracts.
          Catalog, sources, and releases are live desks on Operations home — this shell does not
          publish or replace Inbox triage.
        </p>
      </header>
      <section aria-labelledby="workspace-heading">
        <h2 id="workspace-heading">Workspaces</h2>
        <div className="console-card-grid">
          {CONSOLE_SURFACES.map((surface) => (
            <article className="console-card" key={surface.id}>
              <p className="console-kicker">{surface.eyebrow}</p>
              <h3>
                <Link href={`/console/${surface.id}`}>{surface.label}</Link>
              </h3>
              <p>{surface.description}</p>
              <p className="console-count">{overviewCountLabel(surface, liveCounts)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DiffSummary({ diff }: { readonly diff: PublicationDiff }) {
  return (
    <div className="console-diff" aria-label="Resulting publication diff">
      <p className="console-diff__title">Resulting publication diff</p>
      <dl>
        <div>
          <dt>Added</dt>
          <dd>{diff.added}</dd>
        </div>
        <div>
          <dt>Changed</dt>
          <dd>{diff.changed}</dd>
        </div>
        <div>
          <dt>Removed</dt>
          <dd>{diff.removed}</dd>
        </div>
        <div>
          <dt>Unchanged</dt>
          <dd>{diff.unchanged}</dd>
        </div>
      </dl>
      <p className="console-mono">Candidate: {diff.releaseCandidateId}</p>
    </div>
  );
}

function PermissionGatedAction({ action }: { readonly action: ConsoleAction }) {
  const reasonId = `${action.id}-reason`;
  return (
    <article className="console-action">
      <div className="console-action__heading">
        <div>
          <h3>{action.label}</h3>
          <p className="console-permission">Required permission: {action.permission}</p>
        </div>
        <span className="console-badge">Server gated</span>
      </div>
      <p>
        Target: <code>{action.destination}</code> through <code>{action.endpoint}</code>
      </p>
      {action.bulk ? (
        <p>
          Preview required · maximum {action.bulk.maximumItems} items · rollback token issued
        </p>
      ) : null}
      {action.privilegedAction ? (
        <fieldset>
          <legend>High-impact authorization</legend>
          <label htmlFor={reasonId}>Decision reason (required)</label>
          <textarea
            aria-describedby={`${reasonId}-help`}
            id={reasonId}
            name="reason"
            required
            rows={3}
          />
          <p id={`${reasonId}-help`}>
            Sign in again recently and add a decision reason before the server will run this action.
          </p>
        </fieldset>
      ) : null}
      <DiffSummary diff={action.publicationDiff} />
      <button
        className="console-button"
        disabled
        title="Live handlers are intentionally not connected in this shell"
        type="button"
      >
        Preview action
      </button>
      <p className="console-action__note">
        Disabled fixture control. A trusted server handler must import the existing administrator
        authorizer before this action can execute.
      </p>
    </article>
  );
}

export function ConsoleSurfacePage({
  surface,
  dataSource,
}: {
  readonly surface: ConsoleSurface;
  readonly dataSource: ConsoleDataSource;
}) {
  const countLabel = recordCountLabel(surface.rows.length, dataSource);
  const tableCaption = recordTableCaption(surface.label, surface.rows.length, dataSource);
  const useResearchCaseQueue = LIVE_BACKED_SURFACE_IDS.has(surface.id);
  const showLegacyGuardedActions = !useResearchCaseQueue && dataSource === 'fixture';

  return (
    <div className="console-page">
      <header className="console-page__header">
        <p className="console-kicker">{surface.eyebrow}</p>
        <h1>{surface.label}</h1>
        <p>{surface.description}</p>
        {useResearchCaseQueue ? (
          <p>
            Live triage moved to <Link href="/inbox">Inbox</Link> and{' '}
            <Link href="/cases">Cases</Link> with full detail and decisions. This fixture surface
            does not accept new decisions or publish.
          </p>
        ) : (
          <p>
            Sample records and disabled action previews only — use Operations home for live desks.
            Nothing here publishes or edits active public projections.
          </p>
        )}
      </header>
      <div className="console-notice" role="note">
        <strong>Immutable publication boundary.</strong> Drafts and release candidates only — never
        edit active public projections.
      </div>
      <section aria-labelledby="records-heading">
        <div className="console-section-heading">
          <h2 id="records-heading">Review records</h2>
          <span>{countLabel}</span>
        </div>
        {useResearchCaseQueue ? (
          <p>
            Open the <Link href="/inbox">Inbox</Link> for searchable queues, full case sheets,
            and live send-to-relevance / exclude / needs-evidence actions.
          </p>
        ) : (
          <div className="console-table-wrap">
            <table>
              <caption className="ds-visually-hidden">{tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">Record</th>
                  <th scope="col">Status</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {surface.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <span className="console-mono">{row.id}</span>
                      <span>{row.title}</span>
                    </th>
                    <td>{row.status}</td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {showLegacyGuardedActions ? (
        <section aria-labelledby="actions-heading">
          <div className="console-section-heading">
            <h2 id="actions-heading">Guarded actions (fixture)</h2>
            <span>Not live — use Inbox / Releases desks</span>
          </div>
          <div className="console-actions">
            {surface.actions.map((action) => (
              <PermissionGatedAction action={action} key={action.id} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
