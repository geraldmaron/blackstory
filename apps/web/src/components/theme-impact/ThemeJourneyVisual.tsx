/**
 * Ink-sketch chapter visuals for theme-impact journey beats. Flat matte line art
 * only; copper marks orientation. One sketch per beat question id.
 */
import React from 'react';

void React;

const SKETCH_SVG_STYLE = `
  .ds-journey-sketch__svg text { fill: currentColor; font-family: var(--ds-font-mono); }
  .ds-journey-sketch__label { font-size: 8.5px; letter-spacing: 0.04em; }
  .ds-journey-sketch__caption { font-size: 7.5px; fill: var(--ds-ink-muted); }
  .ds-journey-sketch__stroke {
    fill: none;
    stroke: var(--ds-ink);
    stroke-width: 1.65;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ds-journey-sketch__stroke--muted { stroke: var(--ds-ink-muted); stroke-width: 1.4; }
  .ds-journey-sketch__stroke--accent {
    stroke: var(--ds-accent-graphic);
    stroke-width: 1.85;
  }
  .ds-journey-sketch__fill {
    fill: var(--ds-surface-raised);
    stroke: var(--ds-ink);
    stroke-width: 1.65;
    stroke-linejoin: round;
  }
  .ds-journey-sketch__fill--accent {
    fill: color-mix(in srgb, var(--ds-accent-graphic) 16%, var(--ds-surface-raised));
    stroke: var(--ds-accent-graphic);
    stroke-width: 1.75;
  }
  .ds-journey-sketch__wash {
    fill: color-mix(in srgb, var(--ds-canvas) 55%, var(--ds-surface));
    stroke: var(--ds-rule);
    stroke-width: 1.2;
  }
`;

export type ThemeJourneyScene = {
  readonly person: string;
  readonly role: string;
  readonly place: string;
  readonly year: string;
};

export type ThemeJourneyVisualProps = {
  readonly questionId: string;
  readonly scene: ThemeJourneyScene;
  readonly headingId: string;
};

const REDLINING_SCENES: Readonly<Record<string, ThemeJourneyScene>> = {
  Q1: {
    person: 'Eugene Williams',
    role: 'teenager',
    place: '29th Street Beach, Chicago',
    year: '1919',
  },
  Q2: {
    person: 'HOLC surveyor',
    role: 'federal mapmaker',
    place: 'Chicago kitchen table',
    year: '1939',
  },
  Q3: {
    person: 'Cook County household',
    role: 'renter seeking ownership',
    place: 'South Side, Illinois',
    year: '1990–2024',
  },
  Q4: {
    person: 'Robert S. Abbott',
    role: 'publisher / Defender',
    place: 'State Street, Bronzeville',
    year: '1919–1945',
  },
};

export function themeJourneySceneForBeat(
  themeId: string,
  questionId: string,
): ThemeJourneyScene | undefined {
  if (themeId !== 'redlining') return undefined;
  return REDLINING_SCENES[questionId];
}

function SceneCaption({ scene }: { readonly scene: ThemeJourneyScene }) {
  return (
    <p className="ds-journey-sketch__scene-caption">
      <span className="ds-mono ds-journey-sketch__scene-kicker">Scene</span>
      <span className="ds-journey-sketch__scene-line">
        {scene.person} · {scene.role} · {scene.place} · {scene.year}
      </span>
    </p>
  );
}

function LakeMichigan1919Sketch() {
  return (
    <svg
      className="ds-journey-sketch__svg"
      viewBox="0 0 360 200"
      role="img"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{SKETCH_SVG_STYLE}</style>
      <title>Lake Michigan shoreline sketch, July 1919</title>
      <rect className="ds-journey-sketch__wash" x="12" y="12" width="336" height="176" rx="8" />
      <path
        className="ds-journey-sketch__stroke--muted"
        d="M24 118 Q90 98 156 112 T312 108"
      />
      <path className="ds-journey-sketch__stroke" d="M24 118 L312 108 L312 168 L24 168 Z" />
      <path
        className="ds-journey-sketch__stroke--accent"
        d="M148 112 C152 104 160 100 168 104 C176 108 174 118 166 122"
      />
      <circle className="ds-journey-sketch__stroke--accent" cx="166" cy="118" r="6" />
      <path className="ds-journey-sketch__stroke" d="M48 88 L58 68 L72 88 L88 62 L104 88" />
      <path className="ds-journey-sketch__stroke" d="M220 72 L228 52 L244 72 L260 48 L276 72 L292 58 L308 72" />
      <text className="ds-journey-sketch__label" x="28" y="36">
        29th Street Beach
      </text>
      <text className="ds-journey-sketch__caption" x="28" y="186">
        invisible color line in the water
      </text>
    </svg>
  );
}

function HolcMapSketch() {
  return (
    <svg
      className="ds-journey-sketch__svg"
      viewBox="0 0 360 200"
      role="img"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{SKETCH_SVG_STYLE}</style>
      <title>Home Owners Loan Corporation map unrolled on a table</title>
      <rect className="ds-journey-sketch__wash" x="12" y="12" width="336" height="176" rx="8" />
      <path className="ds-journey-sketch__stroke" d="M40 148 L320 148" />
      <path
        className="ds-journey-sketch__fill"
        d="M72 52 L288 44 L296 132 L64 140 Z"
      />
      <path className="ds-journey-sketch__stroke--accent" d="M88 68 L148 64 L152 108 L92 112 Z" />
      <path className="ds-journey-sketch__stroke--muted" d="M156 62 L208 58 L212 104 L160 108 Z" />
      <path className="ds-journey-sketch__stroke" d="M216 56 L272 52 L276 100 L220 104 Z" />
      <path className="ds-journey-sketch__stroke--muted" d="M96 116 L144 112 L148 132 L100 136 Z" />
      <text className="ds-journey-sketch__label" x="96" y="82">
        D
      </text>
      <text className="ds-journey-sketch__label" x="172" y="82">
        C
      </text>
      <text className="ds-journey-sketch__label" x="236" y="78">
        B
      </text>
      <text className="ds-journey-sketch__caption" x="28" y="186">
        683 graded areas · Chicago inventory
      </text>
    </svg>
  );
}

function CountyInstrumentsSketch() {
  return (
    <svg
      className="ds-journey-sketch__svg"
      viewBox="0 0 360 200"
      role="img"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{SKETCH_SVG_STYLE}</style>
      <title>Multi-year homeownership and credit instrument sketch</title>
      <rect className="ds-journey-sketch__wash" x="12" y="12" width="336" height="176" rx="8" />
      <path className="ds-journey-sketch__stroke--muted" d="M48 148 L312 148" />
      <rect className="ds-journey-sketch__fill--accent" x="56" y="96" width="28" height="52" />
      <rect className="ds-journey-sketch__fill" x="104" y="82" width="28" height="66" />
      <rect className="ds-journey-sketch__fill--accent" x="152" y="88" width="28" height="60" />
      <rect className="ds-journey-sketch__fill--accent" x="200" y="90" width="28" height="58" />
      <path className="ds-journey-sketch__stroke" d="M248 72 L296 72" />
      <path className="ds-journey-sketch__stroke--accent" d="M248 96 L280 96" />
      <path className="ds-journey-sketch__stroke--muted" d="M248 120 L272 120" />
      <text className="ds-journey-sketch__label" x="58" y="164">
        1990
      </text>
      <text className="ds-journey-sketch__label" x="106" y="164">
        2000
      </text>
      <text className="ds-journey-sketch__label" x="154" y="164">
        2010
      </text>
      <text className="ds-journey-sketch__label" x="198" y="164">
        ACS
      </text>
      <text className="ds-journey-sketch__caption" x="28" y="36">
        Cook County ownership spine
      </text>
    </svg>
  );
}

function BronzevilleStreetSketch() {
  return (
    <svg
      className="ds-journey-sketch__svg"
      viewBox="0 0 360 200"
      role="img"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{SKETCH_SVG_STYLE}</style>
      <title>State Street Bronzeville streetscape sketch</title>
      <rect className="ds-journey-sketch__wash" x="12" y="12" width="336" height="176" rx="8" />
      <path className="ds-journey-sketch__stroke--muted" d="M48 152 L312 152" />
      <rect className="ds-journey-sketch__fill" x="56" y="72" width="52" height="80" />
      <rect className="ds-journey-sketch__fill--accent" x="120" y="56" width="64" height="96" />
      <rect className="ds-journey-sketch__fill" x="196" y="68" width="48" height="84" />
      <rect className="ds-journey-sketch__fill" x="256" y="80" width="44" height="72" />
      <path className="ds-journey-sketch__stroke" d="M132 72 L132 56 M148 72 L148 56" />
      <text className="ds-journey-sketch__label" x="124" y="92">
        Defender
      </text>
      <text className="ds-journey-sketch__label" x="60" y="92">
        YMCA
      </text>
      <text className="ds-journey-sketch__caption" x="28" y="36">
        State Street · Black Metropolis
      </text>
    </svg>
  );
}

function sketchForQuestion(questionId: string): React.ReactNode {
  switch (questionId) {
    case 'Q1':
      return <LakeMichigan1919Sketch />;
    case 'Q2':
      return <HolcMapSketch />;
    case 'Q3':
      return <CountyInstrumentsSketch />;
    case 'Q4':
      return <BronzevilleStreetSketch />;
    default:
      return null;
  }
}

export function ThemeJourneyVisual({ questionId, scene, headingId }: ThemeJourneyVisualProps) {
  const sketch = sketchForQuestion(questionId);
  if (!sketch) return null;

  const descId = `${headingId}-visual-desc`;

  return (
    <figure className="ds-journey-sketch" aria-labelledby={headingId} aria-describedby={descId}>
      <figcaption className="ds-visually-hidden" id={headingId}>
        Journey visual for beat {questionId}
      </figcaption>
      <p className="ds-visually-hidden" id={descId}>
        Hand-drawn ink sketch placing the reader in {scene.place}, {scene.year}, with{' '}
        {scene.person} as {scene.role}.
      </p>
      {sketch}
      <SceneCaption scene={scene} />
    </figure>
  );
}
