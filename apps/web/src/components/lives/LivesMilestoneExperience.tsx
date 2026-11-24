import Link from 'next/link';
import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  LIVES_WORLD_DOMAIN_LABELS,
  livesWorldMediationLine,
  type LivesAreaBundle,
  type LivesConditionGap,
  type LivesSourceRef,
} from '@repo/domain/statistics/lives';
import { Segmented } from '@repo/ui';
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
import type { HydratedStory } from '../../lib/stories/hydrate';
import { StoryBody } from '../story/StoryBody';
import { StoryReferences } from '../story/StoryReferences';
import { LivesAccount } from './LivesAccount';
import { LivesTurn } from './LivesTurn';
import { livesTurnFor } from '../../lib/lives/lives-turns';
import { describeLivesCell, livesBarScaleNote, livesBarShare } from '../../lib/lives/lives-format';
import { DisclosureCaret } from './DisclosureCaret';
import { LIVES_ARCHIVE_READINGS } from '../../lib/lives/lives-archive';
import { ArchiveFigure } from '../page';
import { LivesEraScrubber, type ScrubberEra } from './LivesEraScrubber';
import { LivesRuleCard } from './LivesRuleCard';

void React;

/** The question's opening object: one original historical document, read closely, with its limits. */
function ArchiveReading({ milestone }: { readonly milestone: LivesMilestone }) {
  const reading = LIVES_ARCHIVE_READINGS[milestone.key];
  return (
    <section className="lives-archive" aria-labelledby="lives-archive-title">
      <ArchiveFigure
        image={reading.image}
        caption={reading.caption}
        href={reading.source.url}
        rights={reading.rights}
      >
        <details className="lives-archive__transcript">
          <summary>
            Read the image in words
            <DisclosureCaret />
          </summary>
          <p>{reading.transcription}</p>
        </details>
      </ArchiveFigure>
      <div className="lives-archive__reading">
        <p className="lives-archive__meta">
          <span className="lives-archive__date">{reading.date}</span>
          <span>{reading.place}</span>
        </p>
        <h3 id="lives-archive-title" className="lives-archive__title">
          {reading.title}
        </h3>
        {reading.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p className="lives-note">
          <strong>Scope of this evidence.</strong> {reading.notice}
        </p>
        <p className="lives-archive__question">{reading.question}</p>
        <ul className="lives-archive__links" aria-label="Follow this historical example">
          {reading.connections.map((connection) => (
            <li key={connection.href}>
              <Link className="lives-archive__link" href={connection.href}>
                {connection.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {reading.companion ? (
        <section className="lives-archive__account" aria-labelledby="lives-account-title">
          <p className="lives-archive__meta">
            <span className="lives-archive__date">{reading.companion.date}</span>
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
    <ul className="lives-sources" aria-label="Sources">
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
        <h4>{context.heading}</h4>
        <p>{context.body}</p>
        <SourceLinks sources={context.citations} />
      </aside>
    );
  }

  const { beat } = context;
  return (
    <aside className="lives-milestone__context" aria-label="From the archive">
      <p className="lives-milestone__context-domain">
        {LIVES_WORLD_DOMAIN_LABELS[beat.domain]}, from the record
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
        <p className="lives-milestone__connections">
          {beat.entities
            .filter((entity) => entity.href)
            .map((entity, index) => (
              <React.Fragment key={entity.id}>
                {index > 0 ? ' · ' : null}
                <Link href={entity.href!}>{entity.label}</Link>
              </React.Fragment>
            ))}
        </p>
      ) : null}
    </aside>
  );
}

type ReaderPanel = LivesMilestonePanel<HydratedStory>;

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
  const measure =
    gap.unit === 'years'
      ? rounded === 1
        ? 'year'
        : 'years'
      : gap.unit === 'per_1000'
        ? 'per 1,000'
        : rounded === 1
          ? 'point'
          : 'points';
  return (
    <p className="lives-era__gap">
      <strong>
        About {rounded} {measure} apart
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

/**
 * The era's published comparison, said once. Its values are printed on the era strip above, so
 * the panel carries what the strip cannot: who each figure counts, the distance between them, the
 * overlap warning and the source.
 */
function FigureSection({ figure }: { readonly figure: LivesMilestoneFigure }) {
  const scale = livesBarScaleNote(figure.condition.unit);
  return (
    <section className="lives-era__comparison" aria-label={figure.condition.label}>
      <p className="lives-era__universe">
        {figure.condition.universe}. {livesMilestonePeriod(figure)}.{scale ? ` ${scale}` : ''}
      </p>
      <ul className="lives-era__definitions">
        {figure.values.map(({ lens, cell }) => {
          const display = describeLivesCell(cell, figure.condition.unit);
          return (
            <li key={lens}>
              {cell.definitionLabel ?? LIVES_LENS_LABELS[lens]}
              {cell.estimate === undefined ? ` · ${display.text}` : ''}
              {display.detail ? ` · ${display.detail}` : ''}
            </li>
          );
        })}
      </ul>
      {figure.condition.gap ? <GapLine gap={figure.condition.gap} /> : null}
      {figure.decade.decade >= 2010 &&
      ['homeownership', 'high_school', 'unemployed'].includes(figure.condition.key) ? (
        <p className="lives-era__definition">
          In this measure, Black includes Hispanic origin; white excludes Hispanic origin. Hispanic
          includes people of any race. These categories overlap. Each percentage uses the group’s
          own denominator, not a share of one combined total.
        </p>
      ) : null}
      <SourceLinks sources={figure.sources} />
    </section>
  );
}

/**
 * One era, in the order a reader should meet it: a person first (docs/content/neo-voice.md, Law 1),
 * then the history, then the count, then the rules that began. Census method sits one tap away once
 * there is prose to read, so the page is about lives before it is about the count.
 */
function EraPanel({
  panel,
  milestone,
}: {
  readonly panel: ReaderPanel;
  readonly milestone: LivesMilestone;
}) {
  const turn = livesTurnFor(milestone.key, panel.era.id);
  const titleId = `lives-era-${panel.era.id}`;
  const { narrative, figure } = panel;
  const hasSide =
    panel.rules.length > 0 || panel.context !== null || (narrative?.references.length ?? 0) > 0;
  return (
    <article
      className={hasSide ? 'lives-era' : 'lives-era lives-era--single'}
      id={`era-${panel.era.id}`}
      aria-labelledby={titleId}
    >
      {/* Until an era has a narrative, the decades are its heading. */}
      <header className="lives-era__header">
        <p className="lives-era__place">{narrative ? narrative.doc.placeLabel : 'United States'}</p>
        {narrative ? (
          <>
            <p className="lives-era__years">{panel.era.label}</p>
            <h3 id={titleId}>{narrative.doc.title}</h3>
          </>
        ) : (
          <h3 id={titleId} className="lives-era__years lives-era__years--heading">
            {panel.era.label}
          </h3>
        )}
      </header>

      <div className="lives-era__main">
        {panel.accounts.length > 0 ? (
          <section className="lives-era__accounts" aria-label="In their own words">
            {panel.accounts.map((beat) => (
              <LivesAccount key={beat.id} beat={beat} />
            ))}
          </section>
        ) : null}

        {narrative ? (
          <section className="lives-era__narrative" aria-label="What happened in this stretch">
            <StoryBody story={narrative} />
          </section>
        ) : null}

        {figure ? (
          <FigureSection figure={figure} />
        ) : (
          <p className="lives-era__no-figure">
            <strong>No comparison for this stretch.</strong> {panel.figureAbsence}
          </p>
        )}

        {turn ? <LivesTurn turn={turn} /> : null}
      </div>

      {hasSide ? (
        <div className="lives-era__side">
          {panel.rules.length > 0 ? (
            <section className="lives-era__rules" aria-labelledby={`${titleId}-rules`}>
              <h4 className="lives-era__side-title" id={`${titleId}-rules`}>
                Rules that began
              </h4>
              <ul className="lives-rules__list">
                {panel.rules.map((rule) => (
                  <LivesRuleCard key={rule.id} rule={rule} />
                ))}
              </ul>
            </section>
          ) : null}

          {panel.context ? (
            narrative ? (
              <details className="lives-era__drawer">
                <summary>
                  How the count worked in these years
                  <DisclosureCaret />
                </summary>
                <ContextBlock context={panel.context} />
              </details>
            ) : (
              <ContextBlock context={panel.context} />
            )
          ) : null}

          {narrative && narrative.references.length > 0 ? (
            <details className="lives-era__drawer">
              <summary>
                Sources for this stretch ({narrative.references.length})
                <DisclosureCaret />
              </summary>
              <StoryReferences references={narrative.references} />
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** The scrubber's view of one era: each group's mark on the measure's own scale. */
function scrubberEra(panel: ReaderPanel): ScrubberEra {
  const { figure } = panel;
  return {
    id: panel.era.id,
    label: panel.era.label,
    // Every group, including one this era did not publish, so its absence is said on the strip.
    marks: figure
      ? LIVES_LENSES.map((lens) => {
          const cell = figure.condition.cells[lens];
          const published = figure.values.some((value) => value.lens === lens);
          return {
            lens,
            label: LIVES_LENS_LABELS[lens],
            at:
              !published || cell.estimate === undefined
                ? null
                : livesBarShare(cell.estimate, figure.condition.unit),
            text: describeLivesCell(cell, figure.condition.unit).text,
          };
        })
      : null,
  };
}

export function LivesMilestoneExperience({
  bundle,
  milestone,
  narratives,
}: {
  readonly bundle: LivesAreaBundle;
  readonly milestone: LivesMilestone;
  /** Era narratives by era id, already numbered continuously. Absent until a column is written. */
  readonly narratives?: ReadonlyMap<string, HydratedStory>;
}) {
  const panels = buildLivesMilestonePanels(bundle, milestone, narratives);
  const measured = panels.find((panel) => panel.figure !== null)?.figure ?? null;

  return (
    <div className="lives-milestone">
      <div className="lives-milestone__picker">
        <Segmented
          label="Choose a life question"
          linkAs={Link}
          value={milestone.key}
          options={LIVES_MILESTONES.map((choice) => ({
            value: choice.key,
            label: choice.title,
            href:
              choice.key === DEFAULT_LIVES_MILESTONE.key
                ? '/lives'
                : `/lives?milestone=${choice.key}`,
          }))}
        />
      </div>

      <h2 className="lives-milestone__question">{milestone.question}</h2>

      <ArchiveReading milestone={milestone} />

      {panels.length > 0 ? (
        <LivesEraScrubber
          measure={measured ? measured.condition.label : null}
          scaleNote={measured ? livesBarScaleNote(measured.condition.unit) : null}
          eras={panels.map(scrubberEra)}
          panels={panels.map((panel) => (
            <EraPanel key={panel.era.id} panel={panel} milestone={milestone} />
          ))}
        />
      ) : (
        <section className="lives-milestone__unavailable">
          <h3>The evidence reader could not load.</h3>
          <p>
            BlackStory will not substitute empty panels for missing data. The evidence appendix has
            the underlying tables and coverage notes.
          </p>
        </section>
      )}

      <p className="lives-milestone__footer">
        <Link href="/lives/explorer">Every decade and region, with the cited tables</Link>
      </p>
    </div>
  );
}
