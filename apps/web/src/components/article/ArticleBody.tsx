/**
 * Renders a hydrated article's body blocks in order, dispatching each typed
 * block to its component. Prose carries inline citation superscripts; data
 * blocks reuse the existing evidence components (chart, DataMoment, EraTimeline,
 * MapInsetMoment, DisputeBlock) and show their source numbers.
 */
import React from 'react';
import { DataMoment, type DataMomentMethodStance } from '../theme-spine/DataMoment';
import { DisputeBlock } from '../theme-spine/DisputeBlock';
import { EraTimeline } from '../theme-spine/EraTimeline';
import { MapInsetMoment } from '../theme-spine/MapInsetMoment';
import { ThemeImpactMetricChart } from '../theme-impact/ThemeImpactMetricChart';
import type { HydratedArticle, HydratedArticleBlock } from '../../lib/articles/hydrate';
import { ArticleCitationMarks, ArticleProse } from './ArticleProse';

void React;

export type ArticleBodyProps = {
  readonly article: HydratedArticle;
};

function methodStanceLabel(stance: string): DataMomentMethodStance {
  return stance === 'gated_causal_claim' ? 'gated causal claim' : 'juxtaposition';
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

function Block({
  block,
  refNumberById,
}: {
  readonly block: HydratedArticleBlock;
  readonly refNumberById: ReadonlyMap<string, number>;
}) {
  switch (block.type) {
    case 'heading':
      return block.level === 2 ? (
        <h2 className="ds-article__heading ds-article__heading--2">{block.text}</h2>
      ) : (
        <h3 className="ds-article__heading ds-article__heading--3">{block.text}</h3>
      );
    case 'paragraph':
      return (
        <ArticleProse
          className="ds-article__p"
          text={block.text}
          refNumberById={refNumberById}
        />
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
      return (
        <div className="ds-article__stat">
          <DataMoment
            figure={block.figure}
            claim={block.caption ?? block.claim}
            provenance={{
              source: block.provenance.source,
              capture: block.provenance.retrieved_at,
              confidence: block.methodStance,
            }}
            methodStance={methodStanceLabel(block.methodStance)}
          />
          <SourceLine numbers={block.sourceNumbers} />
        </div>
      );
    case 'primaryDocument':
      return (
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
      );
    case 'timeline':
      return (
        <div className="ds-article__timeline">
          <EraTimeline events={block.events} policyEras={block.policyEras} />
        </div>
      );
    case 'mapInset':
      return (
        <div className="ds-article__map">
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
        <div className="ds-article__dispute">
          <DisputeBlock
            label={block.label}
            sideA={block.sideA}
            sideB={block.sideB}
            standingLine="Both sources are in the archive. We show them side by side and let the contradiction stand."
          />
        </div>
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
  return (
    <div className="ds-article__body ds-prose">
      {article.blocks.map((block, index) => (
        <Block key={index} block={block} refNumberById={article.refNumberById} />
      ))}
    </div>
  );
}
