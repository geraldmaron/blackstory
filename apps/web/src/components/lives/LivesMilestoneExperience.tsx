import Link from 'next/link';
import React from 'react';
import {
  JUXTAPOSITION_DISCLAIMER,
  LIVES_LENS_LABELS,
  LIVES_WORLD_DOMAIN_LABELS,
  type LivesAreaBundle,
  type LivesSourceRef,
} from '@repo/domain/statistics/lives';
import {
  DEFAULT_LIVES_MILESTONE,
  LIVES_MILESTONES,
  buildLivesMilestonePanels,
  type LivesMilestone,
  type LivesMilestoneContext,
  type LivesMilestonePanel,
} from '../../lib/lives/lives-milestones';
import { describeLivesCell } from '../../lib/lives/lives-format';

void React;

function SourceLinks({ sources }: { readonly sources: readonly LivesSourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="lives-milestone__sources" aria-label="Sources">
      {sources.map((source) => (
        <li key={source.url}>
          <a href={source.url} rel="noopener noreferrer">
            {source.label}
          </a>
          {source.archiveUrl ? (
            <>
              {' '}
              ·{' '}
              <a href={source.archiveUrl} rel="noopener noreferrer">
                Archived copy
              </a>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ContextBlock({ context }: { readonly context: LivesMilestoneContext }) {
  if (context.kind === 'count-note') {
    return (
      <aside className="lives-milestone__context" aria-label="What the count could see">
        <p className="lives-milestone__context-kicker">What the count could see</p>
        <h4>{context.heading}</h4>
        <p>{context.body}</p>
        <SourceLinks sources={context.citations} />
      </aside>
    );
  }

  const { beat } = context;
  return (
    <aside className="lives-milestone__context" aria-label="From the archive">
      <p className="lives-milestone__context-kicker">
        {LIVES_WORLD_DOMAIN_LABELS[beat.domain]} · {beat.claimType}
      </p>
      <h4>{beat.heading}</h4>
      {beat.speaker ? (
        <p className="lives-milestone__speaker">
          {beat.speaker.name}, {beat.speaker.place}, {beat.speaker.year}
          {beat.speaker.classNote ? ` · ${beat.speaker.classNote}` : ''}
        </p>
      ) : null}
      <p>{beat.body}</p>
      <SourceLinks sources={beat.citations} />
    </aside>
  );
}

function EraPanel({ panel }: { readonly panel: LivesMilestonePanel }) {
  const titleId = `lives-era-${panel.era.id}`;
  return (
    <article className="lives-era" aria-labelledby={titleId}>
      <header className="lives-era__header">
        <p className="lives-era__number" aria-hidden="true">
          {panel.era.label}
        </p>
        <div>
          <p className="lives-era__eyebrow">Counted in {panel.decade.decade}</p>
          <h3 id={titleId}>{panel.condition.label}</h3>
          <p className="lives-era__universe">
            Who this figure describes: {panel.condition.universe}.
          </p>
        </div>
      </header>

      <dl className="lives-era__values">
        {panel.values.map(({ lens, cell }) => {
          const display = describeLivesCell(cell);
          return (
            <div key={lens} className="lives-era__value" data-lens={lens}>
              <dt>
                <span>{LIVES_LENS_LABELS[lens]}</span>
                <small>{cell.definitionLabel}</small>
              </dt>
              <dd>
                <span className="lives-era__estimate">{display.text}</span>
                {display.detail ? <small>{display.detail}</small> : null}
              </dd>
              <span
                className="lives-era__bar"
                style={
                  {
                    '--lives-value': `${Math.max(0, Math.min(cell.estimate ?? 0, 100))}%`,
                  } as React.CSSProperties
                }
                aria-hidden="true"
              />
            </div>
          );
        })}
      </dl>

      <div className="lives-era__evidence">
        <p className="lives-era__source-label">Figure sources</p>
        <SourceLinks sources={panel.sources} />
      </div>

      {panel.context ? <ContextBlock context={panel.context} /> : null}

      {panel.rules.length > 0 ? (
        <section className="lives-era__rules" aria-label={`Rules beginning in ${panel.era.label}`}>
          <p className="lives-era__source-label">Rules that began in this stretch</p>
          <ul>
            {panel.rules.map((rule) => (
              <li key={rule.id}>
                <span>{rule.inForceFromYear}</span>{' '}
                {rule.href ? <Link href={rule.href}>{rule.name}</Link> : rule.name}
                <small>{rule.jurisdictionLabel}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export function LivesMilestoneExperience({
  bundle,
  milestone,
}: {
  readonly bundle: LivesAreaBundle;
  readonly milestone: LivesMilestone;
}) {
  const panels = buildLivesMilestonePanels(bundle, milestone);

  return (
    <div className="lives-milestone">
      <nav className="lives-milestone__choices" aria-label="Choose a life question">
        {LIVES_MILESTONES.map((choice) => (
          <Link
            key={choice.key}
            href={
              choice.key === DEFAULT_LIVES_MILESTONE.key
                ? '/lives'
                : `/lives?milestone=${choice.key}`
            }
            aria-current={choice.key === milestone.key ? 'page' : undefined}
          >
            <span>{choice.shortLabel}</span>
            <small>{choice.title}</small>
          </Link>
        ))}
      </nav>

      <header className="lives-milestone__opening">
        <p className="lives-milestone__kicker">One question across time</p>
        <h2>{milestone.title}</h2>
        <p>{milestone.question}</p>
        <p className="lives-milestone__orientation">
          Each panel uses one documented year from its stretch. The lines stop at every panel
          because definitions changed. This is comparison, not a claim of cause.
        </p>
      </header>

      {panels.length > 0 ? (
        <div className="lives-milestone__eras">
          {panels.map((panel) => (
            <EraPanel key={panel.era.id} panel={panel} />
          ))}
        </div>
      ) : (
        <section className="lives-milestone__unavailable">
          <h3>The evidence reader could not load.</h3>
          <p>
            BlackStory will not substitute empty panels for missing data. Use the evidence appendix
            to inspect the underlying tables and coverage notes.
          </p>
        </section>
      )}

      <footer className="lives-milestone__footer">
        <p>{JUXTAPOSITION_DISCLAIMER}</p>
        <Link href="/lives/explorer">Open the decade and region evidence appendix</Link>
      </footer>
    </div>
  );
}
