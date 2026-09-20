import Link from 'next/link';
import React from 'react';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import {
  JUXTAPOSITION_DISCLAIMER,
  LIVES_LENS_LABELS,
  LIVES_WORLD_DOMAIN_LABELS,
  livesWorldMediationLine,
  type LivesAreaBundle,
  type LivesConditionGap,
  type LivesSourceRef,
} from '@repo/domain/statistics/lives';
import {
  DEFAULT_LIVES_MILESTONE,
  LIVES_MILESTONES,
  buildLivesMilestonePanels,
  livesMilestonePeriod,
  type LivesMilestone,
  type LivesMilestoneContext,
  type LivesMilestoneFigure,
  type LivesMilestonePanel,
} from '../../lib/lives/lives-milestones';
import type { HydratedArticle } from '../../lib/articles/hydrate';
import { ArticleBody } from '../article/ArticleBody';
import { ArticleReferences } from '../article/ArticleReferences';
import { LivesAccount } from './LivesAccount';
import { describeLivesCell } from '../../lib/lives/lives-format';
import { LIVES_ARCHIVE_READINGS } from '../../lib/lives/lives-archive';
import { ArchiveFigure, RoomHandoff } from '../room';
import { LivesRuleCard } from './LivesRuleCard';
import { DestinationIcon } from '../patterns/DestinationIcon';

void React;

const MILESTONE_ICONS: Record<LivesMilestone['key'], DestinationIconId> = {
  home: 'home',
  place: 'place',
  school: 'school',
  education: 'publication',
  work: 'institution',
  count: 'data',
};
/** Rules shown open in an era; the rest stay one tap away so no rule is dropped for length. */
const LIVES_RULES_OPEN = 4;

function ArchiveReading({ milestone }: { readonly milestone: LivesMilestone }) {
  const reading = LIVES_ARCHIVE_READINGS[milestone.key];
  return (
    <section className="lives-archive" aria-labelledby="lives-archive-title">
      <header className="lives-archive__head">
        <p className="lives-milestone__kicker">
          <DestinationIcon id="artifact" /> Encounter the evidence
        </p>
        <p className="lives-archive__date">{reading.date}</p>
        <p className="lives-archive__place">{reading.place}</p>
        <h3 id="lives-archive-title">{reading.title}</h3>
      </header>
      <ArchiveFigure
        image={reading.image}
        caption={reading.caption}
        href={reading.source.url}
        rights={reading.rights}
      >
        <details className="lives-archive__transcript">
          <summary>Read the image in words</summary>
          <p>{reading.transcription}</p>
        </details>
      </ArchiveFigure>
      <div className="lives-archive__reading">
        {reading.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p className="lives-archive__notice">
          <strong>Scope of this evidence.</strong> {reading.notice}
        </p>
        <a className="lives-archive__citation" href={reading.source.url}>
          {reading.source.label}
        </a>
        <aside className="lives-archive__question">
          <DestinationIcon id="questions" />
          <p>{reading.question}</p>
        </aside>
        <nav aria-label="Follow this historical example">
          {reading.connections.map((connection) => (
            <RoomHandoff key={connection.href} {...connection} />
          ))}
        </nav>
      </div>
      {reading.companion ? (
        <section className="lives-archive__account" aria-labelledby="lives-account-title">
          <p className="lives-milestone__kicker">
            <DestinationIcon id={reading.companion.quote ? 'person' : 'place'} />{' '}
            {reading.companion.date}
          </p>
          <h4 id="lives-account-title">{reading.companion.title}</h4>
          {reading.companion.quote ? <blockquote>“{reading.companion.quote}”</blockquote> : null}
          <p>{reading.companion.body}</p>
          <p className="lives-archive__account-scope">{reading.companion.scope}</p>
          <a className="lives-archive__citation" href={reading.companion.source.url}>
            {reading.companion.source.label}
          </a>
        </section>
      ) : null}
    </section>
  );
}

function SourceLinks({ sources }: { readonly sources: readonly LivesSourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="lives-milestone__sources" aria-label="Sources">
      {sources.map((source) => (
        <li key={`${source.url}|${source.label}`}>
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
        {LIVES_WORLD_DOMAIN_LABELS[beat.domain]} · From the record
      </p>
      <h4>{beat.heading}</h4>
      {beat.speaker ? (
        <p className="lives-milestone__speaker">
          {beat.speaker.name}, {beat.speaker.place}, {beat.speaker.year}
          {beat.speaker.classNote ? ` · ${beat.speaker.classNote}` : ''}
          {' · '}
          {livesWorldMediationLine(beat.speaker)}
        </p>
      ) : null}
      <p>{beat.body}</p>
      <SourceLinks sources={beat.citations} />
      {beat.entities.some((entity) => entity.href) ? (
        <nav className="lives-milestone__connections" aria-label="Related records">
          {beat.entities
            .filter((entity) => entity.href)
            .map((entity) => (
              <Link key={entity.id} href={entity.href!}>
                <DestinationIcon id="records" /> {entity.label}
              </Link>
            ))}
        </nav>
      ) : null}
    </aside>
  );
}

type ReaderPanel = LivesMilestonePanel<HydratedArticle>;

/**
 * The distance between the Black and white figures, in words. It is a derived measurement with its
 * formula attached, which docs/methodology/juxtaposition-not-causation.md allows, and it stays
 * inside one panel: two eras are never subtracted from each other. "Apart" carries no direction,
 * so it reads the same whether the Black figure is the lower one (owning a home) or the higher one
 * (looking for work).
 */
function GapLine({ gap }: { readonly gap: LivesConditionGap }) {
  const [first, second] = gap.betweenLenses;
  const rounded = Math.round(gap.points);
  return (
    <p className="lives-era__gap">
      <strong>
        About {rounded} {rounded === 1 ? 'point' : 'points'} apart
      </strong>{' '}
      <span>
        {LIVES_LENS_LABELS[first]} and {LIVES_LENS_LABELS[second]}.
        {gap.uncertainty !== undefined && gap.uncertainty >= 0.5
          ? ` Give or take ${Math.round(gap.uncertainty)}.`
          : ''}{' '}
        {gap.formula}
      </span>
    </p>
  );
}

function FigureSection({ figure }: { readonly figure: LivesMilestoneFigure }) {
  return (
    <>
      <section className="lives-era__comparison" aria-label={figure.condition.label}>
        <h4 className="lives-era__measure">
          <DestinationIcon id="data" /> {figure.condition.label}
        </h4>
        <p className="lives-era__universe">
          Who this figure describes: {figure.condition.universe}. {livesMilestonePeriod(figure)}.
        </p>
        <dl className="lives-era__values">
          {figure.values.map(({ lens, cell }) => {
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
        {figure.condition.gap ? <GapLine gap={figure.condition.gap} /> : null}
        {figure.decade.decade >= 2010 &&
        ['homeownership', 'high_school', 'unemployed'].includes(figure.condition.key) ? (
          <p className="lives-era__definition">
            In this measure, Black includes Hispanic origin; white excludes Hispanic origin.
            Hispanic includes people of any race. These categories overlap. Each percentage uses the
            group’s own denominator, not a share of one combined total.
          </p>
        ) : null}
      </section>
      <div className="lives-era__evidence">
        <p className="lives-era__source-label">
          <DestinationIcon id="source" /> Figure sources
        </p>
        <SourceLinks sources={figure.sources} />
      </div>
    </>
  );
}

/**
 * One era, in the order a reader should meet it: a person first (docs/content/neo-voice.md, Law 1),
 * then the history, then the count, then the rules that began. Census method sits one tap away once
 * there is prose to read, so the page is about lives before it is about the count.
 */
function EraPanel({ panel }: { readonly panel: ReaderPanel }) {
  const titleId = `lives-era-${panel.era.id}`;
  const { narrative, figure } = panel;
  const title = narrative?.doc.title ?? figure?.condition.label ?? panel.era.label;
  return (
    <article className="lives-era" id={`era-${panel.era.id}`} aria-labelledby={titleId}>
      <header className="lives-era__header">
        <p className="lives-era__number">
          <span>{panel.era.start}s</span>
          <span>–{panel.era.end}s</span>
        </p>
        <div>
          <p className="lives-era__eyebrow">
            {narrative ? narrative.doc.placeLabel : 'United States'} · {panel.era.label}
          </p>
          <h3 id={titleId}>{title}</h3>
        </div>
      </header>

      {panel.accounts.length > 0 ? (
        <section className="lives-era__accounts" aria-label="In their own words">
          <p className="lives-era__source-label">
            <DestinationIcon id="person" /> In their own words
          </p>
          {panel.accounts.map((beat) => (
            <LivesAccount key={beat.id} beat={beat} />
          ))}
        </section>
      ) : null}

      {narrative ? (
        <section className="lives-era__narrative" aria-label="What happened in this stretch">
          <ArticleBody article={narrative} />
        </section>
      ) : null}

      {figure ? (
        <FigureSection figure={figure} />
      ) : (
        <p className="lives-era__no-figure">
          <strong>No comparison for this stretch.</strong> {panel.figureAbsence}
        </p>
      )}

      {panel.rules.length > 0 ? (
        <section className="lives-era__rules" aria-label={`Rules beginning in ${panel.era.label}`}>
          <p className="lives-era__source-label">
            <DestinationIcon id="law" /> Rules that began in this stretch
          </p>
          <ul className="lives-rules__list">
            {panel.rules.slice(0, LIVES_RULES_OPEN).map((rule) => (
              <LivesRuleCard key={rule.id} rule={rule} />
            ))}
          </ul>
          {panel.rules.length > LIVES_RULES_OPEN ? (
            <details className="lives-era__more-rules">
              <summary>
                {panel.rules.length - LIVES_RULES_OPEN} more{' '}
                {panel.rules.length - LIVES_RULES_OPEN === 1 ? 'rule' : 'rules'} began in this
                stretch
              </summary>
              <ul className="lives-rules__list">
                {panel.rules.slice(LIVES_RULES_OPEN).map((rule) => (
                  <LivesRuleCard key={rule.id} rule={rule} />
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {panel.context ? (
        narrative ? (
          <details className="lives-era__drawer">
            <summary>How the count worked in these years</summary>
            <ContextBlock context={panel.context} />
          </details>
        ) : (
          <ContextBlock context={panel.context} />
        )
      ) : null}

      {narrative && narrative.references.length > 0 ? (
        <details className="lives-era__drawer">
          <summary>Sources for this stretch ({narrative.references.length})</summary>
          <ArticleReferences references={narrative.references} />
        </details>
      ) : null}
    </article>
  );
}

export function LivesMilestoneExperience({
  bundle,
  milestone,
  narratives,
}: {
  readonly bundle: LivesAreaBundle;
  readonly milestone: LivesMilestone;
  /** Era narratives by era id, already numbered continuously. Absent until a column is written. */
  readonly narratives?: ReadonlyMap<string, HydratedArticle>;
}) {
  const panels = buildLivesMilestonePanels(bundle, milestone, narratives);

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
            <DestinationIcon id={MILESTONE_ICONS[choice.key]} size="md" />
            <span>{choice.title}</span>
          </Link>
        ))}
      </nav>

      <header className="lives-milestone__opening">
        <p className="lives-milestone__kicker">One question across time</p>
        <h2>{milestone.title}</h2>
        <p>{milestone.question}</p>
        <p className="lives-milestone__orientation">
          Start with an original historical object, then follow the national evidence across time.
          Local examples keep their own dates and places. They do not represent every family or
          explain a national rate.
        </p>
      </header>

      <ArchiveReading milestone={milestone} />

      {panels.length > 0 ? (
        <div className="lives-milestone__eras">
          <div className="lives-milestone__timeline-head">
            <h3>Across the years</h3>
            <p>
              Each stop carries a sourced national comparison where one was published. A stretch
              with no comparison appears only when there’s sourced history to tell. Definitions and
              survey periods remain separate.
            </p>
            <nav className="lives-milestone__year-links" aria-label="Jump to a documented era">
              {panels.map((panel) => (
                <a key={panel.era.id} href={`#era-${panel.era.id}`}>
                  <DestinationIcon id="time" /> {panel.era.label}
                </a>
              ))}
            </nav>
          </div>
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
