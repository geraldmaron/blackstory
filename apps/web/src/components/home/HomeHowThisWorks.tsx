/**
 * Homepage “How this works” section — evidence-before-assertion copy, compact
 * research-pipeline sketch reused from /methodology, three trust points, and a
 * single methodology CTA.
 *
 * Theme-aware (`ds-section` + ordinary `--ds-*` tokens): follows light and dark
 * reader themes. Pipeline-sketch CSS is imported by `app/(map)/page.tsx` (and
 * methodology) so this module stays unit-testable under node/tsx without CSS
 * loaders.
 */

import React from 'react';
import Link from 'next/link';
import { ResearchPipelineSketch } from '../trust/ResearchPipelineSketch';

void React;

/** v5 §6.5 — three concise points, evidence before assertion. */
const HOW_ITEMS = [
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
    <section className="ds-section ds-home-how" aria-labelledby="how-heading">
      <div className="ds-container">
        <header className="ds-home-how__intro">
          <p className="ds-section__kicker">How this works</p>
          <h2 className="ds-section__title ds-home-how__title" id="how-heading">
            Evidence before assertion.
          </h2>
          <p className="ds-section__lede ds-home-how__lede">
            Discovery finds candidates. People verify. The publish gate decides what reaches the
            public record — models never write it alone.
          </p>
        </header>

        <div className="ds-home-how__compose">
          <div className="ds-home-how__sketch">
            <ResearchPipelineSketch compact />
          </div>
          <ol className="ds-home-how__points">
            {HOW_ITEMS.map((item, index) => (
              <li key={item.title} className="ds-home-how__point">
                <span className="ds-home-how__point-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="ds-home-how__point-title">{item.title}</h3>
                <p className="ds-home-how__point-body">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <p className="ds-home-how__cta">
          <Link className="ds-cta ds-cta--solid" href="/methodology">
            Read the methodology
          </Link>
        </p>
      </div>
    </section>
  );
}
