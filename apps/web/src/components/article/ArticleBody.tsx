/**
 * Renders a hydrated article's body blocks in order, dispatching each typed
 * block to its component. Prose carries inline citation superscripts; data
 * blocks reuse the existing evidence components (chart, DataMoment, EraTimeline,
 * MapInsetMoment, DisputeBlock) and show their source numbers.
 *
 * Reading-surface conventions (tuned on the redlining chapter, then rolled out):
 *  - Charts/graphs (`figure`) render open and are never collapsible — the data
 *    picture is part of the argument, not an aside.
 *  - Evidence artifacts (`primaryDocument`, `timeline`, `dispute`, `mapInset`)
 *    render as `<details>` disclosures that begin collapsed, so the prose reads
 *    as prose and the reader opens the receipt when they want it. No JS: the
 *    native element carries the state and stays accessible.
 *  - Consecutive `stat` blocks coalesce into one compact comparison rail instead
 *    of a vertical wall of full-width cards.
 */
import React from 'react';
import { DisputeBlock } from '../theme-spine/DisputeBlock';
import { EraTimeline } from '../theme-spine/EraTimeline';
import { MapInsetMoment } from '../theme-spine/MapInsetMoment';
import { ThemeImpactMetricChart } from '../theme-impact/ThemeImpactMetricChart';
import type {
  HydratedArticle,
  HydratedArticleBlock,
  HydratedArticleStat,
} from '../../lib/articles/hydrate';
import { ArticleCitationMarks, ArticleProse } from './ArticleProse';

void React;

export type ArticleBodyProps = {
  readonly article: HydratedArticle;
};

/**
 * Anchor id for a heading block. Prefixed with the block's own index in `article.blocks` —
 * stable and guaranteed unique by construction — with a readable slug appended so the URL
 * fragment still says something about the section. The same function backs both the id this
 * module renders onto the heading and `chapterToc`'s rail entries below, so the two can never
 * drift apart.
 */
export function headingAnchorId(index: number, text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length > 0 ? `section-${index}-${slug}` : `section-${index}`;
}

/** "In this chapter": the article's own level-2 section headings, in reading order. */
export function chapterToc(
  article: HydratedArticle,
): readonly { readonly id: string; readonly text: string }[] {
  const entries: { id: string; text: string }[] = [];
  article.blocks.forEach((block, index) => {
    if (block.type === 'heading' && block.level === 2) {
      entries.push({ id: headingAnchorId(index, block.text), text: block.text });
    }
  });
  return entries;
}

function SourceLine({ numbers }: { readonly numbers: readonly number[] }) {
  if (numbers.length === 0) return null;
  return (
    <p className="ds-article-source-line">
      Source
      <ArticleCitationMarks numbers={numbers} />
    </p>
  );
}

/**
 * A collapsed-by-default evidence disclosure. The native `<details>` element
 * keeps the open/closed state without JavaScript and stays keyboard- and
 * screen-reader-accessible. `kind` labels the drawer ("Primary document",
 * "Timeline", …); `lead` is the one-line teaser the reader sees while closed.
 */
function ArtifactDrawer({
  kind,
  lead,
  children,
}: {
  readonly kind: string;
  readonly lead: string;
  readonly children: React.ReactNode;
}) {
  return (
    <details className="ds-article__drawer">
      <summary className="ds-article__drawer-summary">
        <span className="ds-article__drawer-kind ds-mono">{kind}</span>
        <span className="ds-article__drawer-lead">{lead}</span>
        <span className="ds-article__drawer-cue" aria-hidden="true" />
      </summary>
      <div className="ds-article__drawer-body">{children}</div>
    </details>
  );
}

/** A run of consecutive stat blocks, laid out as a compact comparison rail. */
function StatRail({ stats }: { readonly stats: readonly HydratedArticleStat[] }) {
  return (
    <div
      className="ds-article__statrail"
      data-count={stats.length}
      role="group"
      aria-label="Key figures"
    >
      {stats.map((stat, index) => (
        <div className="ds-article__statcell" key={index}>
          <span className="ds-article__statfigure">{stat.figure.replace(/_/g, ' ')}</span>
          <span className="ds-article__statlabel">{stat.caption ?? stat.claim}</span>
          <SourceLine numbers={stat.sourceNumbers} />
        </div>
      ))}
    </div>
  );
}

function Block({
  block,
  index,
  refNumberById,
}: {
  readonly block: HydratedArticleBlock;
  readonly index: number;
  readonly refNumberById: ReadonlyMap<string, number>;
}) {
  switch (block.type) {
    case 'heading': {
      const id = headingAnchorId(index, block.text);
      return block.level === 2 ? (
        <h2 id={id} className="ds-article__heading ds-article__heading--2">
          {block.text}
        </h2>
      ) : (
        <h3 id={id} className="ds-article__heading ds-article__heading--3">
          {block.text}
        </h3>
      );
    }
    case 'paragraph':
      return (
        <ArticleProse className="ds-article__p" text={block.text} refNumberById={refNumberById} />
      );
    case 'list':
      // Call-outs. Each item is its own cited assertion, so the citation marks render
      // per item rather than once for the list — a bullet quoted on its own still
      // arrives with its receipt.
      return block.style === 'number' ? (
        <ol className="ds-article__list ds-article__list--number">
          {block.items.map((item, index) => (
            <li className="ds-article__list-item" key={index}>
              <ArticleProse as="span" text={item} refNumberById={refNumberById} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="ds-article__list">
          {block.items.map((item, index) => (
            <li className="ds-article__list-item" key={index}>
              <ArticleProse as="span" text={item} refNumberById={refNumberById} />
            </li>
          ))}
        </ul>
      );
    case 'pullquote':
      return (
        <blockquote className="ds-article__pullquote">
          <p>{block.text}</p>
          {block.attribution ? (
            <cite className="ds-article__pullquote-cite">{block.attribution}</cite>
          ) : null}
        </blockquote>
      );
    case 'figure':
      return (
        <figure className="ds-article__figure">
          <ThemeImpactMetricChart observations={block.observations} />
          <figcaption className="ds-article__figcaption">
            {block.caption}
            <ArticleCitationMarks numbers={block.sourceNumbers} />
          </figcaption>
        </figure>
      );
    case 'stat':
      // Stats never render standalone here; ArticleBody coalesces consecutive
      // stat blocks into a single StatRail. This case is unreachable but kept
      // exhaustive for the switch.
      return null;
    case 'primaryDocument':
      return (
        <ArtifactDrawer
          kind={block.dateLabel ? `Primary document · ${block.dateLabel}` : 'Primary document'}
          lead={block.title}
        >
          <figure className="ds-article__document">
            <div className="ds-article__document-head">
              {block.dateLabel ? (
                <span className="ds-article__document-date ds-mono">{block.dateLabel}</span>
              ) : null}
              <span className="ds-article__document-title">{block.title}</span>
            </div>
            {block.quote ? (
              <blockquote className="ds-article__document-quote">{block.quote}</blockquote>
            ) : null}
            <figcaption className="ds-article__document-summary">
              {block.summary}
              <ArticleCitationMarks numbers={block.sourceNumbers} />
            </figcaption>
          </figure>
        </ArtifactDrawer>
      );
    case 'timeline':
      return (
        <ArtifactDrawer kind="Timeline" lead={`${block.events.length} dated documents, in order`}>
          <div className="ds-article__timeline">
            <EraTimeline events={block.events} policyEras={block.policyEras} />
          </div>
        </ArtifactDrawer>
      );
    case 'mapInset':
      return (
        <ArtifactDrawer kind="Map" lead={block.label}>
          <div className="ds-article__map">
            <MapInsetMoment
              entityId={block.entityId}
              label={block.label}
              lat={block.lat}
              lng={block.lng}
              precision={block.precision}
            />
          </div>
        </ArtifactDrawer>
      );
    case 'dispute':
      return (
        <ArtifactDrawer kind="Two sources disagree" lead={block.label}>
          <div className="ds-article__dispute">
            <DisputeBlock
              label={block.label}
              sideA={block.sideA}
              sideB={block.sideB}
              standingLine="Both sources are in the archive. We show them side by side and let the contradiction stand."
            />
          </div>
        </ArtifactDrawer>
      );
    case 'image':
      return (
        <figure className="ds-article__image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.image.url} alt={block.image.alt} loading="lazy" />
          <figcaption className="ds-article__figcaption">
            {block.caption ? <span>{block.caption} · </span> : null}
            <span className="ds-article__credit">{block.image.credit}</span>
          </figcaption>
        </figure>
      );
    default:
      return null;
  }
}

export function ArticleBody({ article }: ArticleBodyProps) {
  const rendered: React.ReactNode[] = [];
  const blocks = article.blocks;
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    if (block.type === 'stat') {
      // Absorb the whole run of consecutive stats into one comparison rail.
      const run: HydratedArticleStat[] = [];
      let j = i;
      while (j < blocks.length && blocks[j]!.type === 'stat') {
        run.push(blocks[j] as HydratedArticleStat);
        j += 1;
      }
      rendered.push(<StatRail key={i} stats={run} />);
      i = j - 1;
      continue;
    }
    rendered.push(
      <Block key={i} block={block} index={i} refNumberById={article.refNumberById} />,
    );
  }
  return <div className="ds-article__body ds-prose">{rendered}</div>;
}
