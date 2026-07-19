/**
 * Renders the accessible administration shell, fixture tables, and permission-gated action previews.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CONSOLE_SURFACES } from './fixtures';
import type { ConsoleAction, ConsoleSurface, PublicationDiff } from './model';

export function ConsoleShell({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <a className="ds-visually-hidden" href="#console-content">
        Skip to console content
      </a>
      <header className="console-header">
        <div>
          <p className="console-kicker">Private operations</p>
          <Link className="console-brand" href="/console">
            BlackStory Admin
          </Link>
        </div>
        <p className="console-session" aria-label="Authentication status">
          IAP + Firebase session required
        </p>
      </header>
      <div className="console-frame">
        <nav className="console-nav" aria-label="Administration console">
          <p className="console-nav__label">Workspaces</p>
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

export function ConsoleOverview() {
  return (
    <div className="console-page">
      <header className="console-page__header">
        <p className="console-kicker">Research and publication</p>
        <h1>Administration console</h1>
        <p>
          Review canonical drafts, build immutable release candidates, and inspect operational
          controls. This shell uses fixture data and exposes no live mutation handlers.
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
              <p className="console-count">{surface.rows.length} fixture records</p>
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
          <label htmlFor={reasonId}>Operator reason (required)</label>
          <textarea
            aria-describedby={`${reasonId}-help`}
            id={reasonId}
            name="reason"
            required
            rows={3}
          />
          <p id={`${reasonId}-help`}>
            A fresh Firebase authentication event and this durable reason are required by the
            server before execution.
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

export function ConsoleSurfacePage({ surface }: { readonly surface: ConsoleSurface }) {
  return (
    <div className="console-page">
      <header className="console-page__header">
        <p className="console-kicker">{surface.eyebrow}</p>
        <h1>{surface.label}</h1>
        <p>{surface.description}</p>
      </header>
      <div className="console-notice" role="note">
        <strong>Immutable publication boundary.</strong> Changes are staged in canonical drafts or
        release candidates. Active public projections are never edited directly.
      </div>
      <section aria-labelledby="records-heading">
        <div className="console-section-heading">
          <h2 id="records-heading">Review records</h2>
          <span>{surface.rows.length} fixture records</span>
        </div>
        <div className="console-table-wrap">
          <table>
            <caption className="ds-visually-hidden">{surface.label} fixture records</caption>
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
      </section>
      <section aria-labelledby="actions-heading">
        <div className="console-section-heading">
          <h2 id="actions-heading">Guarded actions</h2>
          <span>Authorization is server-side</span>
        </div>
        <div className="console-actions">
          {surface.actions.map((action) => (
            <PermissionGatedAction action={action} key={action.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
