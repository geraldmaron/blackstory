/**
 * Renders a hydrated story's body blocks in order, dispatching each typed
 * block to its component. Prose carries inline citation superscripts; data
 * blocks reuse the existing evidence components (chart, DataMoment, EraTimeline,
 * MapInsetMoment, DisputeBlock) and show their source numbers.
 *
 * Reading-surface conventions (tuned on the redlining chapter, then rolled out):
 *  - Charts/graphs (`figure`) render open and are never collapsible — the data
 *    picture is part of the argument, not an aside.
 *  - Primary documents begin open so the evidence is part of the reading experience.
 *    Other evidence drawers remain collapsible. Native details keep keyboard access
 *    and work without JavaScript.
 *  - Consecutive `stat` blocks coalesce into one compact comparison rail instead
 *    of a vertical wall of full-width cards.
 */
import React from 'react';
import { DisputeBlock } from '../theme-spine/DisputeBlock';
import { EraTimeline } from '../theme-spine/EraTimeline';
import { MapInsetMoment } from '../theme-spine/MapInsetMoment';
import { ThemeImpactMetricChart } from '../theme-impact/ThemeImpactMetricChart';
import type {
  HydratedStory,
  HydratedStoryBlock,
  HydratedStoryStat,
} from '../../lib/stories/hydrate';
import { extractChapterHeadings } from '../../lib/stories/heading-anchors';
import { StoryCitationMarks, StoryProse } from './StoryProse';
import { ArchiveFigure } from '../room/Evidence';
import { DestinationIcon } from '../patterns/DestinationIcon';

void React;

export type StoryBodyProps = {
  readonly story: HydratedStory;
};

/**
 * Anchor id for an h3 subheading. Prefixed with the block's own index in `story.blocks` —
 * stable and guaranteed unique by construction — with a readable slug appended so the URL
 * fragment still says something about the section. h2 section headings get their id from
 * `extractChapterHeadings` instead (the same function the rail's "In this chapter" nav reads),
 * so the two can never drift apart; h3s have no rail entry to stay in sync with.
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

function SourceLine({ numbers }: { readonly numbers: readonly number[] }) {
  if (numbers.length === 0) return null;
  return (
    <p className="ds-reading-source-line">
      Source
      <StoryCitationMarks numbers={numbers} />
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
  open = false,
}: {
  readonly kind: string;
  readonly lead: string;
  readonly children: React.ReactNode;
  readonly open?: boolean;
}) {
  return (
    <details className="ds-reading__drawer" open={open}>
      <summary className="ds-reading__drawer-summary">
        <span className="ds-reading__drawer-kind ds-mono">
          <DestinationIcon id="artifact" /> {kind}
        </span>
        <span className="ds-reading__drawer-lead">{lead}</span>
        <span className="ds-reading__drawer-cue" aria-hidden="true" />
      </summary>
      <div className="ds-reading__drawer-body">{children}</div>
    </details>
  );
}

/** A run of consecutive stat blocks, laid out as a compact comparison rail. */
function StatRail({ stats }: { readonly stats: readonly HydratedStoryStat[] }) {
  return (
    <div
      className="ds-reading__statrail"
      data-count={stats.length}
      role="group"
      aria-label="Key figures"
    >
      {stats.map((stat, index) => (
        <div className="ds-reading__statcell" key={index}>
          <span className="ds-reading__statfigure">{stat.figure.replace(/_/g, ' ')}</span>
          <span className="ds-reading__statlabel">{stat.caption ?? stat.claim}</span>
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
  headingId,
}: {
  readonly block: HydratedStoryBlock;
  readonly index: number;
  readonly refNumberById: ReadonlyMap<string, number>;
  /** DOM anchor id for an h2 section heading, so the rail's "In this chapter" nav can jump to it. */
  readonly headingId?: string;
}) {
  switch (block.type) {
    case 'heading': {
      const id = headingAnchorId(index, block.text);
      return block.level === 2 ? (
        <h2 id={headingId} className="ds-reading__heading ds-reading__heading--2">
          {block.text}
        </h2>
      ) : (
        <h3 id={id} className="ds-reading__heading ds-reading__heading--3">
          {block.text}
        </h3>
      );
    }
    case 'paragraph':
      return (
        <StoryProse className="ds-reading__p" text={block.text} refNumberById={refNumberById} />
      );
    case 'list':
      // Call-outs. Each item is its own cited assertion, so the citation marks render
      // per item rather than once for the list — a bullet quoted on its own still
      // arrives with its receipt.
      return block.style === 'number' ? (
        <ol className="ds-reading__list ds-reading__list--number">
          {block.items.map((item, index) => (
            <li className="ds-reading__list-item" key={index}>
              <StoryProse as="span" text={item} refNumberById={refNumberById} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="ds-reading__list">
          {block.items.map((item, index) => (
            <li className="ds-reading__list-item" key={index}>
              <StoryProse as="span" text={item} refNumberById={refNumberById} />
            </li>
          ))}
        </ul>
      );
    case 'pullquote':
      return (
        <blockquote className="ds-reading__pullquote">
          <p>{block.text}</p>
          {block.attribution ? (
            <cite className="ds-reading__pullquote-cite">{block.attribution}</cite>
          ) : null}
        </blockquote>
      );
    case 'figure':
      return (
        <figure className="ds-reading__figure">
          <ThemeImpactMetricChart observations={block.observations} />
          <figcaption className="ds-reading__figcaption">
            {block.caption}
            <StoryCitationMarks numbers={block.sourceNumbers} />
          </figcaption>
        </figure>
      );
    case 'stat':
      // Stats never render standalone here; StoryBody coalesces consecutive
      // stat blocks into a single StatRail. This case is unreachable but kept
      // exhaustive for the switch.
      return null;
    case 'primaryDocument':
      return (
        <ArtifactDrawer
          open
          kind={block.dateLabel ? `Primary document · ${block.dateLabel}` : 'Primary document'}
          lead={block.title}
        >
          <figure className="ds-reading__document">
            {block.quote ? (
              <blockquote className="ds-reading__document-quote">{block.quote}</blockquote>
            ) : null}
            <figcaption className="ds-reading__document-summary">
              {block.summary}
              <StoryCitationMarks numbers={block.sourceNumbers} />
            </figcaption>
          </figure>
        </ArtifactDrawer>
      );
    case 'timeline':
      return (
        <ArtifactDrawer kind="Timeline" lead={`${block.events.length} dated documents, in order`}>
          <div className="ds-reading__timeline">
            <EraTimeline events={block.events} policyEras={block.policyEras} />
          </div>
        </ArtifactDrawer>
      );
    case 'mapInset':
      return (
        <ArtifactDrawer kind="Map" lead={block.label}>
          <div className="ds-reading__map">
            <MapInsetMoment
              entityId={block.entityId}
              label={block.label}
              lat={block.lat}
              lng={block.lng}
              precision={block.precision}
              kind={block.kind}
              topicTags={block.topicTags}
              displayName={block.displayName}
              {...(block.topicIds !== undefined ? { topicIds: block.topicIds } : {})}
            />
          </div>
        </ArtifactDrawer>
      );
    case 'dispute':
      return (
        <ArtifactDrawer kind="Two sources disagree" lead={block.label}>
          <div className="ds-reading__dispute">
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
        <ArchiveFigure image={block.image} {...(block.caption ? { caption: block.caption } : {})} />
      );
    default:
      return null;
  }
}

export function StoryBody({ story }: StoryBodyProps) {
  const rendered: React.ReactNode[] = [];
  const blocks = story.blocks;
  const headingIdByBlockIndex = new Map(
    extractChapterHeadings(blocks).map((heading) => [heading.blockIndex, heading.id]),
  );
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    if (block.type === 'stat') {
      // Absorb the whole run of consecutive stats into one comparison rail.
      const run: HydratedStoryStat[] = [];
      let j = i;
      while (j < blocks.length && blocks[j]!.type === 'stat') {
        run.push(blocks[j] as HydratedStoryStat);
        j += 1;
      }
      rendered.push(<StatRail key={i} stats={run} />);
      i = j - 1;
      continue;
    }
    const headingId = headingIdByBlockIndex.get(i);
    rendered.push(
      <Block
        key={i}
        block={block}
        index={i}
        refNumberById={story.refNumberById}
        {...(headingId === undefined ? {} : { headingId })}
      />,
    );
  }
  return <div className="ds-reading__body ds-prose">{rendered}</div>;
}
