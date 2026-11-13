/**
 * Renders a hydrated story's body blocks in order. The body is a three-track grid: prose sits on
 * the 680px reading measure, and every artifact (chart, figure run, primary document, timeline,
 * map inset, dispute, archive image, table, video) breaks out onto the 964px wide track, open.
 * Nothing is folded into a drawer: the evidence is part of the reading, and it is what breaks the
 * column of prose.
 *
 * Consecutive `stat` blocks coalesce into one row of figure callouts: the numbers the chapter's
 * own data carries, set as numbers rather than left inside sentences.
 */
import React from 'react';
import { DisputeBlock } from '../theme-spine/DisputeBlock';
import { EraTimeline, timelinePoints } from '../theme-spine/EraTimeline';
import { MapInsetMoment } from '../theme-spine/MapInsetMoment';
import { ThemeImpactMetricChart } from '../theme-impact/ThemeImpactMetricChart';
import type {
  HydratedStory,
  HydratedStoryBlock,
  HydratedStoryStat,
} from '../../lib/stories/hydrate';
import { extractChapterHeadings } from '../../lib/stories/heading-anchors';
import { storyVideoSource, storyVideoWatchUrl } from '@repo/schemas';
import { StoryCitationMarks, StoryInline, StoryProse } from './StoryProse';
import { StoryVideo } from './StoryVideo';
import { StoryFigure } from './StoryFigure';
import { splitSectionHeading } from './story-text';
import { DisplayNumeral } from '@repo/ui';
// The artifacts' own sheets travel with the body, so every surface that renders one (the story
// page, /lives, the admin preview) gets them without remembering to import them.
import '../theme-spine/theme-spine.css';
import '../theme-impact/theme-impact.css';

void React;

export type StoryBodyProps = {
  readonly story: HydratedStory;
  /** Set each dated section's year as a copper numeral over its heading (the story page). */
  readonly numerals?: boolean;
};

/**
 * Anchor id for an h3 subheading. Prefixed with the block's own index in `story.blocks` (stable
 * and unique by construction) with a readable slug appended. h2 section headings get their id
 * from `extractChapterHeadings` instead, the same function the section spine reads, so the two
 * can never drift apart.
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

const VIDEO_PROVIDER_LABEL = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  archive: 'Internet Archive',
  loc: 'Library of Congress',
} as const;

const VIDEO_RIGHTS_LABEL = {
  public_domain: 'In the public domain',
  licensed: 'Used under license',
  fair_use: 'Used under fair use',
} as const;

/** The year span of a timeline, for its caption: "1790 to 2013". */
function timelineSpan(events: readonly { readonly date: string }[]): string | undefined {
  const years = events
    .map((event) => Number.parseInt(/^-?\d{1,4}/.exec(event.date.trim())?.[0] ?? '', 10))
    .filter((year) => Number.isFinite(year));
  if (years.length === 0) return undefined;
  const first = Math.min(...years);
  const last = Math.max(...years);
  return first === last ? String(first) : `${first} to ${last}`;
}

/** A run of consecutive stat blocks: figure callouts in one row on the wide track. */
function FigureCallouts({ stats }: { readonly stats: readonly HydratedStoryStat[] }) {
  return (
    <div className="ds-story-wide ds-story-figures" data-count={stats.length} data-ground="copper">
      {stats.map((stat, index) => (
        <figure className="ds-story-figures__item" key={index}>
          <span className="ds-story-figures__number">{stat.figure.replace(/_/g, ' ')}</span>
          <figcaption className="ds-story-figures__label">
            {stat.caption ?? stat.claim}
            <StoryCitationMarks numbers={stat.sourceNumbers} />
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Block({
  block,
  index,
  refNumberById,
  headingId,
  numerals = false,
}: {
  readonly block: HydratedStoryBlock;
  readonly index: number;
  readonly refNumberById: ReadonlyMap<string, number>;
  /** DOM anchor id for an h2 section heading, so the section spine can jump to it. */
  readonly headingId?: string;
  readonly numerals?: boolean;
}) {
  switch (block.type) {
    case 'heading': {
      const { year, title } = splitSectionHeading(block.text);
      // The year is drawn once as a numeral; the heading keeps it for assistive technology, so
      // its text (and the spine's) is unchanged.
      if (block.level === 2 && numerals && year) {
        return (
          <>
            <DisplayNumeral as="p" className="ds-story-year" decorative>
              {year}
            </DisplayNumeral>
            <h2 id={headingId} className="ds-section-heading ds-story-h2 ds-story-h2--dated">
              <span className="ds-visually-hidden">{year} · </span>
              {title}
            </h2>
          </>
        );
      }
      return block.level === 2 ? (
        <h2 id={headingId} className="ds-section-heading ds-story-h2">
          {block.text}
        </h2>
      ) : (
        <h3 id={headingAnchorId(index, block.text)} className="ds-story-h3">
          {block.text}
        </h3>
      );
    }
    case 'paragraph':
      return <StoryProse className="ds-story-p" text={block.text} refNumberById={refNumberById} />;
    case 'list': {
      // Call-outs. Each item is its own cited assertion, so the citation marks render per item
      // rather than once for the list: a line quoted on its own still arrives with its receipt.
      const items = block.items.map((item, itemIndex) => (
        <li className="ds-story-list__item" key={itemIndex}>
          <StoryProse as="span" text={item} refNumberById={refNumberById} />
        </li>
      ));
      return block.style === 'number' ? (
        <ol className="ds-story-list ds-story-list--number">{items}</ol>
      ) : (
        <ul className="ds-story-list">{items}</ul>
      );
    }
    case 'pullquote':
      return (
        <blockquote className="ds-story-quote">
          <StoryProse text={block.text} refNumberById={refNumberById} />
          {block.attribution ? <cite>{block.attribution}</cite> : null}
        </blockquote>
      );
    case 'figure':
      return (
        <figure className="ds-story-wide ds-story-chart">
          <ThemeImpactMetricChart observations={block.observations} />
          <figcaption className="ds-story-caption">
            {block.caption}
            <StoryCitationMarks numbers={block.sourceNumbers} />
          </figcaption>
        </figure>
      );
    case 'stat':
      // Stats never render standalone; StoryBody coalesces runs into FigureCallouts.
      return null;
    case 'primaryDocument':
      return (
        <figure className="ds-story-wide ds-story-doc" data-ground="sand">
          <div className="ds-story-doc__head">
            {block.dateLabel ? <p className="ds-story-doc__date">{block.dateLabel}</p> : null}
            <p className="ds-story-doc__title">{block.title}</p>
          </div>
          <div className="ds-story-doc__text">
            {block.quote ? (
              <blockquote className="ds-story-doc__quote">{block.quote}</blockquote>
            ) : null}
            <figcaption className="ds-story-doc__summary">
              {block.summary}
              <StoryCitationMarks numbers={block.sourceNumbers} />
            </figcaption>
          </div>
        </figure>
      );
    case 'timeline': {
      const events = timelinePoints(block.events);
      if (events.length === 0) return null;
      const span = timelineSpan(events);
      return (
        <div className="ds-story-wide ds-story-timeline">
          {span ? <p className="ds-story-timeline__span">Dated documents, {span}</p> : null}
          <EraTimeline events={events} policyEras={block.policyEras} />
        </div>
      );
    }
    case 'mapInset':
      return (
        <div className="ds-story-wide ds-story-map">
          <MapInsetMoment
            entityId={block.entityId}
            label={block.label}
            lat={block.lat}
            lng={block.lng}
            precision={block.precision}
          />
        </div>
      );
    case 'dispute':
      return (
        <DisputeBlock
          className="ds-story-wide"
          label={block.label}
          sideA={block.sideA}
          sideB={block.sideB}
          standingLine="Both sources are in the archive. They stand side by side, unresolved."
        />
      );
    case 'image':
      return (
        <StoryFigure
          className="ds-story-wide"
          image={block.image}
          {...(block.caption
            ? { caption: <StoryInline text={block.caption} refNumberById={refNumberById} /> }
            : {})}
        />
      );
    case 'table': {
      const [first, ...rest] = block.rows;
      const bodyRows = block.header ? rest : block.rows;
      const cell = (text: string) => (
        <StoryProse as="span" text={text} refNumberById={refNumberById} />
      );
      return (
        <figure className="ds-story-wide ds-reading-table">
          <div
            className="ds-reading-table__scroll"
            tabIndex={0}
            role="region"
            aria-label={block.caption}
          >
            <table>
              {block.header && first ? (
                <thead>
                  <tr>
                    {first.map((text, c) => (
                      <th key={c} scope="col">
                        {cell(text)}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {bodyRows.map((row, r) => (
                  <tr key={r}>
                    {row.map((text, c) => (
                      <td key={c}>{cell(text)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figcaption className="ds-story-caption">
            <StoryProse as="span" text={block.caption} refNumberById={refNumberById} />
          </figcaption>
        </figure>
      );
    }
    case 'video':
      return (
        <div className="ds-story-wide">
          <StoryVideo
            title={block.title}
            providerLabel={VIDEO_PROVIDER_LABEL[block.provider]}
            credit={block.credit}
            rights={VIDEO_RIGHTS_LABEL[block.rightsStatus]}
            watchUrl={storyVideoWatchUrl(block)}
            source={storyVideoSource(block)}
            {...(block.caption
              ? {
                  caption: (
                    <StoryProse as="span" text={block.caption} refNumberById={refNumberById} />
                  ),
                }
              : {})}
          />
        </div>
      );
    case 'divider':
      return <hr className="ds-story-divider" />;
    default:
      return null;
  }
}

export function StoryBody({ story, numerals = false }: StoryBodyProps) {
  const rendered: React.ReactNode[] = [];
  const blocks = story.blocks;
  const headingIdByBlockIndex = new Map(
    extractChapterHeadings(blocks).map((heading) => [heading.blockIndex, heading.id]),
  );
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    if (block.type === 'stat') {
      const run: HydratedStoryStat[] = [];
      let j = i;
      while (j < blocks.length && blocks[j]!.type === 'stat') {
        run.push(blocks[j] as HydratedStoryStat);
        j += 1;
      }
      rendered.push(<FigureCallouts key={i} stats={run} />);
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
        numerals={numerals}
        {...(headingId === undefined ? {} : { headingId })}
      />,
    );
  }
  return <div className="ds-reading__body ds-story-body">{rendered}</div>;
}
