/**
 * Homepage beat 04: evidence-before-assertion methodology weight with pipeline sketch,
 * publish rules, dignity line, and methodology CTA.
 */

import React from 'react';
import Link from 'next/link';
import { ResearchPipelineSketch } from '../trust/ResearchPipelineSketch';
import { HomeEditionHeader } from './HomeEditionHeader';

void React;

const PUBLISH_RULES = [
  {
    title: 'Every record is documented',
    body: 'People, places, schools, and events carry accepted claims, citations, and confidence you can read yourself.',
  },
  {
    title: 'Contradictions stay visible',
    body: 'When sources disagree, the record says so. Confidence is never a color alone, and disputes stay part of the story.',
  },
  {
    title: 'Dignity is a rule, not a tone',
    body: 'Street-level residences stay off the public map. Living people stay protected. Presence is never framed as deficit.',
  },
] as const;

export function HomeHowThisWorks() {
  return (
    <section className="ds-home-edition__beat" id="beat-d" aria-labelledby="home-method-heading">
      <HomeEditionHeader
        index="04"
        kicker="Evidence before assertion"
        title="How records reach the map."
        lede="Discovery finds candidates. People verify. The publish gate decides what reaches the public record. Models never write it alone."
        id="home-method-heading"
      />

      <div className="ds-home-edition__method-compose">
        <div className="ds-home-edition__pipeline-wrap">
          <ResearchPipelineSketch compact />
        </div>
        <ol className="ds-home-edition__publish-rules">
          {PUBLISH_RULES.map((item, index) => (
            <li key={item.title}>
              <span className="ds-home-edition__publish-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="ds-home-edition__publish-title">{item.title}</p>
                <p className="ds-home-edition__publish-desc">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="ds-home-edition__dignity-line">
        <strong>Dignity</strong>
        People are named with role and context. No anonymous decoration, no alarm framing, no
        crime-heat rendering on the map.
      </p>

      <p className="ds-home-edition__beat-cta">
        <Link className="ds-cta ds-cta--copper" href="/methodology">
          Read the methodology
        </Link>
      </p>
    </section>
  );
}
