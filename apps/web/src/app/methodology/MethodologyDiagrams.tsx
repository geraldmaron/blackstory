/**
 * Hand-drawn figures for `/methodology`: how a record gets in, why grades read as convergence
 * rather than a label, and why a map point stops narrowing before a street address.
 *
 * Every shape is a wobble path generated from fixed coordinates, not a scan or an imported
 * icon set: `sketchRect` perturbs each corner by a small deterministic offset (seeded, not
 * random, so server and client render the same path) and bows each edge with a cubic curve.
 * Text is always placed from the *unperturbed* box geometry with enough interior padding to
 * clear the largest possible wobble, so the hand-drawn jitter can never push a label into a
 * neighbour or outside its box.
 */
import React from 'react';

void React;

const SKETCH_STYLE = `
  .ds-mdiag__svg text { fill: currentColor; font-family: var(--ds-font-sans); }
  .ds-mdiag__step {
    font-family: var(--ds-font-mono);
    font-size: 9px;
    letter-spacing: 0.08em;
    fill: var(--ds-accent);
  }
  .ds-mdiag__title { font-size: 11.5px; font-weight: 600; }
  .ds-mdiag__body { font-size: 9.5px; fill: var(--room-ink-3); }
  .ds-mdiag__note {
    font-family: var(--ds-font-mono);
    font-size: 8.5px;
    letter-spacing: 0.04em;
    fill: var(--room-ink-4);
  }
  .ds-mdiag__box { fill: var(--ds-surface); stroke: var(--ds-ink); stroke-width: 1.5; stroke-linejoin: round; }
  .ds-mdiag__box--accent { stroke: var(--ds-accent-graphic); }
  .ds-mdiag__box--muted { fill: var(--room-sunk); stroke: var(--ds-ink-muted); }
  .ds-mdiag__box--dashed { fill: none; stroke-dasharray: 3 4; stroke: var(--ds-ink-muted); }
  .ds-mdiag__connector { fill: none; stroke: var(--room-ink-3); stroke-width: 1.4; stroke-linecap: round; }
  .ds-mdiag__connector--link { stroke-dasharray: 1 5; stroke-linecap: round; }
  .ds-mdiag__arrow { fill: var(--ds-accent-graphic); }
  .ds-mdiag__dot { fill: var(--ds-surface); stroke: var(--ds-ink); stroke-width: 1.4; }
  .ds-mdiag__dot--claim { fill: var(--ds-accent-graphic); stroke: var(--ds-accent-graphic); }
  .ds-mdiag__mark { fill: none; stroke: var(--ds-ink); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .ds-mdiag__mark--warn { stroke: var(--ds-warning-border); }
  .ds-mdiag__mark--stop { stroke: var(--ds-dispute-border); }
`;

/** Deterministic 0..1 hash of an integer seed. Same input, same output, every render. */
function hash(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function jitter(seed: number, amp: number): number {
  return (hash(seed) - 0.5) * 2 * amp;
}

/** A rounded rectangle redrawn as four bowed, slightly-off-true edges: the hand-drawn box. */
function sketchRect(x: number, y: number, w: number, h: number, seed: number, amp = 2.2): string {
  const j = (i: number) => jitter(seed + i, amp);
  const x0 = x + j(1);
  const y0 = y + j(2);
  const x1 = x + w + j(3);
  const y1 = y + j(4);
  const x2 = x + w + j(5);
  const y2 = y + h + j(6);
  const x3 = x + j(7);
  const y3 = y + h + j(8);
  return (
    `M ${x0} ${y0} ` +
    `C ${x0 + (x1 - x0) * 0.3} ${y0 + j(9)}, ${x0 + (x1 - x0) * 0.7} ${y0 + j(10)}, ${x1} ${y1} ` +
    `C ${x1 + j(11)} ${y1 + (y2 - y1) * 0.3}, ${x1 + j(12)} ${y1 + (y2 - y1) * 0.7}, ${x2} ${y2} ` +
    `C ${x2 - (x2 - x3) * 0.3} ${y2 + j(13)}, ${x2 - (x2 - x3) * 0.7} ${y2 + j(14)}, ${x3} ${y3} ` +
    `C ${x3 + j(15)} ${y3 - (y3 - y0) * 0.3}, ${x3 + j(16)} ${y3 - (y3 - y0) * 0.7}, ${x0} ${y0} Z`
  );
}

/** A hand-bowed connector between two points, with a filled arrowhead at the end. */
function SketchArrow({
  x1,
  y1,
  x2,
  y2,
  seed,
  accent = false,
}: {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly seed: number;
  readonly accent?: boolean;
}) {
  const bow = jitter(seed, 3);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 + bow;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const headX = x2 - nx * 7;
  const headY = y2 - ny * 7;
  const perpX = -ny * 3.4;
  const perpY = nx * 3.4;
  return (
    <>
      <path
        className="ds-mdiag__connector"
        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2 - nx * 6} ${y2 - ny * 6}`}
      />
      <path
        className={accent ? 'ds-mdiag__arrow' : 'ds-mdiag__arrow'}
        d={`M ${x2} ${y2} L ${headX + perpX} ${headY + perpY} L ${headX - perpX} ${headY - perpY} Z`}
      />
    </>
  );
}

/** A hand-bowed link between two points with a midpoint dot instead of an arrowhead: for
 * "these are the same thing, read two ways" rather than "this becomes that". */
function SketchLink({
  x1,
  y1,
  x2,
  y2,
  seed,
}: {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly seed: number;
}) {
  const bow = jitter(seed, 3);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 + bow;
  return (
    <>
      <path
        className="ds-mdiag__connector ds-mdiag__connector--link"
        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
      />
      <circle className="ds-mdiag__dot" cx={midX} cy={midY} r={3.4} />
    </>
  );
}

/** Wraps `label` onto short fixed lines so SVG text (which does not wrap) never overruns a box. */
function TextLines({
  x,
  y,
  lines,
  className,
  lineHeight = 13,
}: {
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  readonly className: string;
  readonly lineHeight?: number;
}) {
  return (
    <>
      {lines.map((line, index) => (
        <text key={line} className={className} x={x} y={y + index * lineHeight}>
          {line}
        </text>
      ))}
    </>
  );
}

/** Stage 1: how a record gets in, drawn as four hand-drawn stations left to right. */
export function RecordIntakeDiagram() {
  const titleId = 'methodology-intake-sketch-title';
  const descId = 'methodology-intake-sketch-desc';
  const boxY = 26;
  const boxH = 122;
  const boxW = 148;
  const gap = 20;
  const stride = boxW + gap;
  const xAt = (index: number) => 8 + index * stride;
  const stages = [
    { step: '01', title: 'Candidate', body: ['A research run', 'finds a claim'], seed: 11 },
    {
      step: '02',
      title: 'Pinned to place',
      body: ['State, city, campus', 'or documented site'],
      seed: 23,
    },
    {
      step: '03',
      title: 'A person reads it',
      body: ['Before anything', 'reaches a page'],
      seed: 37,
    },
    { step: '04', title: 'Published', body: ['Citations and a', 'grade attached'], seed: 51 },
  ] as const;

  return (
    <figure className="ds-mdiag" aria-labelledby={titleId} aria-describedby={descId}>
      <figcaption className="ds-mdiag__figcaption" id={titleId}>
        How a record gets in
      </figcaption>
      <p className="ds-visually-hidden" id={descId}>
        A candidate surfaces from a research run, is pinned to a real place, is read by a person
        before anything publishes, and reaches a public page only with citations and an evidence
        grade attached.
      </p>
      <div className="ds-mdiag__frame">
        <svg
          className="ds-mdiag__svg"
          viewBox="0 0 680 176"
          role="img"
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
        >
          <style>{SKETCH_STYLE}</style>
          <title>Sketch: candidate to published, four stations</title>
          {stages.map((stage, index) => {
            const x = xAt(index);
            return (
              <React.Fragment key={stage.step}>
                <path
                  className={index === 3 ? 'ds-mdiag__box ds-mdiag__box--accent' : 'ds-mdiag__box'}
                  d={sketchRect(x, boxY, boxW, boxH, stage.seed)}
                />
                <text className="ds-mdiag__step" x={x + 14} y={boxY + 20}>
                  {stage.step}
                </text>
                <text className="ds-mdiag__title" x={x + 14} y={boxY + 42}>
                  {stage.title}
                </text>
                <TextLines
                  x={x + 14}
                  y={boxY + 62}
                  lines={stage.body}
                  className="ds-mdiag__body"
                  lineHeight={18}
                />
              </React.Fragment>
            );
          })}
          {[0, 1, 2].map((index) => (
            <SketchArrow
              key={index}
              x1={xAt(index) + boxW}
              y1={boxY + boxH / 2}
              x2={xAt(index + 1)}
              y2={boxY + boxH / 2}
              seed={71 + index}
            />
          ))}
          <text className="ds-mdiag__note" x={8} y={168}>
            Nothing reaches a public page on a model&apos;s say-so
          </text>
        </svg>
      </div>
    </figure>
  );
}

/** Stage 2: what a grade actually measures, contrasted as convergence versus disagreement. */
export function EvidenceConvergenceDiagram() {
  const titleId = 'methodology-convergence-sketch-title';
  const descId = 'methodology-convergence-sketch-desc';

  return (
    <figure className="ds-mdiag" aria-labelledby={titleId} aria-describedby={descId}>
      <figcaption className="ds-mdiag__figcaption" id={titleId}>
        What moves a grade
      </figcaption>
      <p className="ds-visually-hidden" id={descId}>
        One source alone reads as single-source. Independent sources that agree read as
        corroborated, or established when several high-authority sources agree with no serious
        dispute. Sources that disagree read as contested, with both readings kept on the record.
      </p>
      <div className="ds-mdiag__frame">
        <svg
          className="ds-mdiag__svg"
          viewBox="0 0 680 214"
          role="img"
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
        >
          <style>{SKETCH_STYLE}</style>
          <title>Sketch: one source, independent sources agreeing, sources disagreeing</title>

          {/* Column A: one source */}
          <text className="ds-mdiag__note" x={20} y={18}>
            one source
          </text>
          <circle className="ds-mdiag__dot" cx={90} cy={50} r={9} />
          <SketchArrow x1={90} y1={59} x2={90} y2={104} seed={101} />
          <circle className="ds-mdiag__dot--claim ds-mdiag__dot" cx={90} cy={118} r={10} />
          <TextLines
            x={20}
            y={152}
            lines={['single-source', 'not yet checked']}
            className="ds-mdiag__body"
            lineHeight={16}
          />

          {/* Column B: independent sources agree */}
          <text className="ds-mdiag__note" x={280} y={18}>
            independent sources agree
          </text>
          <circle className="ds-mdiag__dot" cx={300} cy={44} r={8} />
          <circle className="ds-mdiag__dot" cx={350} cy={38} r={8} />
          <circle className="ds-mdiag__dot" cx={400} cy={44} r={8} />
          <SketchArrow x1={300} y1={52} x2={345} y2={104} seed={111} />
          <SketchArrow x1={350} y1={46} x2={350} y2={104} seed={112} />
          <SketchArrow x1={400} y1={52} x2={355} y2={104} seed={113} />
          <circle className="ds-mdiag__dot--claim ds-mdiag__dot" cx={350} cy={118} r={11} />
          <path className="ds-mdiag__mark" d="M 344 118 L 349 124 L 360 110" />
          <TextLines
            x={280}
            y={152}
            lines={['corroborated, or established', 'with no serious dispute']}
            className="ds-mdiag__body"
            lineHeight={16}
          />

          {/* Column C: sources disagree */}
          <text className="ds-mdiag__note" x={560} y={18}>
            sources disagree
          </text>
          <circle className="ds-mdiag__dot" cx={550} cy={42} r={8} />
          <circle className="ds-mdiag__dot" cx={610} cy={42} r={8} />
          <SketchArrow x1={550} y1={50} x2={598} y2={104} seed={121} />
          <SketchArrow x1={610} y1={50} x2={562} y2={104} seed={122} />
          <circle className="ds-mdiag__dot--claim ds-mdiag__dot" cx={580} cy={118} r={11} />
          <path className="ds-mdiag__mark ds-mdiag__mark--warn" d="M 580 108 L 580 116" />
          <circle className="ds-mdiag__mark ds-mdiag__mark--warn" cx={580} cy={121} r={0.8} />
          <TextLines
            x={520}
            y={152}
            lines={['contested: both readings', 'stay on the record']}
            className="ds-mdiag__body"
            lineHeight={16}
          />

          <line x1={230} y1={8} x2={230} y2={188} className="ds-mdiag__box--dashed" />
          <line x1={490} y1={8} x2={490} y2={188} className="ds-mdiag__box--dashed" />
        </svg>
      </div>
    </figure>
  );
}

/** Stage 3: precision narrows with the source, and stops before a street address. */
export function MapPrecisionDiagram() {
  const titleId = 'methodology-precision-sketch-title';
  const descId = 'methodology-precision-sketch-desc';
  const barX0 = 40;
  const barX1 = 640;
  const cx = (barX0 + barX1) / 2;
  const tiers = [
    { label: 'Country, state', y: 20, inset: 0, seed: 201 },
    { label: 'City', y: 62, inset: 80, seed: 213 },
    { label: 'Campus, institution', y: 104, inset: 160, seed: 227 },
  ] as const;
  const barH = 34;
  const stopY = 148;
  const stopInset = 200;

  return (
    <figure className="ds-mdiag" aria-labelledby={titleId} aria-describedby={descId}>
      <figcaption className="ds-mdiag__figcaption" id={titleId}>
        Where a map point stops narrowing
      </figcaption>
      <p className="ds-visually-hidden" id={descId}>
        Public precision runs from country and state through city to campus or institution. A street
        address or exact residence coordinate is never drawn, for anyone.
      </p>
      <div className="ds-mdiag__frame">
        <svg
          className="ds-mdiag__svg"
          viewBox="0 0 680 216"
          role="img"
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
        >
          <style>{SKETCH_STYLE}</style>
          <title>Sketch: precision narrows from country to campus, then stops</title>
          {tiers.map((tier) => {
            const x = barX0 + tier.inset;
            const w = barX1 - barX0 - tier.inset * 2;
            return (
              <React.Fragment key={tier.label}>
                <path className="ds-mdiag__box" d={sketchRect(x, tier.y, w, barH, tier.seed)} />
                <text
                  className="ds-mdiag__title"
                  x={cx}
                  y={tier.y + barH / 2 + 4}
                  textAnchor="middle"
                >
                  {tier.label}
                </text>
              </React.Fragment>
            );
          })}

          <rect
            x={barX0 + stopInset}
            y={stopY}
            width={barX1 - barX0 - stopInset * 2}
            height={barH}
            rx={6}
            className="ds-mdiag__box--dashed"
          />
          <path
            className="ds-mdiag__mark ds-mdiag__mark--stop"
            d={`M ${barX0 + stopInset + 14} ${stopY + 10} L ${barX1 - stopInset - 14} ${stopY + barH - 10}`}
          />
          <path
            className="ds-mdiag__mark ds-mdiag__mark--stop"
            d={`M ${barX1 - stopInset - 14} ${stopY + 10} L ${barX0 + stopInset + 14} ${stopY + barH - 10}`}
          />
          <text className="ds-mdiag__note" x={cx} y={stopY + barH + 22} textAnchor="middle">
            Street address, exact residence coordinate: never drawn
          </text>
        </svg>
      </div>
    </figure>
  );
}

/** How a record is built: a subject carries claims, each claim carries citations, and the
 * citations set the grade. Edits append to a separate log rather than overwriting the record. */
export function RecordDataModelDiagram() {
  const titleId = 'methodology-data-model-sketch-title';
  const descId = 'methodology-data-model-sketch-desc';
  const boxY = 26;
  const boxH = 110;
  const boxW = 148;
  const gap = 20;
  const stride = boxW + gap;
  const xAt = (index: number) => 8 + index * stride;
  const stages = [
    { kicker: 'subject', title: 'Entity', body: ["The record's", 'subject'], seed: 511 },
    { kicker: 'claim', title: 'Claim', body: ['One statement,', 'its own grade'], seed: 523 },
    { kicker: 'evidence', title: 'Citations', body: ['Sources you', 'can open'], seed: 537 },
    { kicker: 'grade', title: 'Grade', body: ['Set by how many', 'agree, how close'], seed: 551 },
  ] as const;
  const logY = 176;
  const logH = 64;
  const logW = 220;

  return (
    <figure className="ds-mdiag" aria-labelledby={titleId} aria-describedby={descId}>
      <figcaption className="ds-mdiag__figcaption" id={titleId}>
        How a record is built
      </figcaption>
      <p className="ds-visually-hidden" id={descId}>
        An entity carries claims. Each claim carries the citations behind it, and those citations
        set the claim's evidence grade. Every edit to the entity appends to a separate revision log
        rather than overwriting what was there before.
      </p>
      <div className="ds-mdiag__frame">
        <svg
          className="ds-mdiag__svg"
          viewBox="0 0 680 250"
          role="img"
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
        >
          <style>{SKETCH_STYLE}</style>
          <title>Sketch: entity, claim, citations, grade, with a separate revision log</title>
          {stages.map((stage, index) => {
            const x = xAt(index);
            return (
              <React.Fragment key={stage.title}>
                <path
                  className={index === 3 ? 'ds-mdiag__box ds-mdiag__box--accent' : 'ds-mdiag__box'}
                  d={sketchRect(x, boxY, boxW, boxH, stage.seed)}
                />
                <text className="ds-mdiag__step" x={x + 14} y={boxY + 20}>
                  {stage.kicker}
                </text>
                <text className="ds-mdiag__title" x={x + 14} y={boxY + 42}>
                  {stage.title}
                </text>
                <TextLines
                  x={x + 14}
                  y={boxY + 62}
                  lines={stage.body}
                  className="ds-mdiag__body"
                  lineHeight={18}
                />
              </React.Fragment>
            );
          })}
          {[0, 1, 2].map((index) => (
            <SketchArrow
              key={index}
              x1={xAt(index) + boxW}
              y1={boxY + boxH / 2}
              x2={xAt(index + 1)}
              y2={boxY + boxH / 2}
              seed={81 + index}
            />
          ))}

          <SketchArrow x1={xAt(0) + 74} y1={boxY + boxH} x2={8 + logW / 2} y2={logY} seed={571} />
          <path
            className="ds-mdiag__box ds-mdiag__box--muted"
            d={sketchRect(8, logY, logW, logH, 583)}
          />
          <text className="ds-mdiag__title" x={22} y={logY + 22}>
            Revision log
          </text>
          <TextLines
            x={22}
            y={logY + 40}
            lines={['Every edit appends,', 'nothing is overwritten']}
            className="ds-mdiag__body"
            lineHeight={16}
          />
        </svg>
      </div>
    </figure>
  );
}

/** The same catalog read three ways: a browsable list, a map, and a single record's own page. */
export function SiteStructureDiagram() {
  const titleId = 'methodology-site-structure-sketch-title';
  const descId = 'methodology-site-structure-sketch-desc';
  const boxY = 20;
  const boxH = 100;
  const boxW = 200;
  const gap = 32;
  const xAt = (index: number) => 8 + index * (boxW + gap);
  const mid = boxY + boxH / 2;
  const nodes = [
    { title: 'Records', body: ['The whole archive,', 'as a list'], seed: 611 },
    { title: 'Explore', body: ['The same records,', 'on the map'], seed: 623 },
    { title: "A record's page", body: ['Full citations', 'and history'], seed: 637 },
  ] as const;

  return (
    <figure className="ds-mdiag" aria-labelledby={titleId} aria-describedby={descId}>
      <figcaption className="ds-mdiag__figcaption" id={titleId}>
        The same catalog, three ways to reach it
      </figcaption>
      <p className="ds-visually-hidden" id={descId}>
        Records is the whole archive as a browsable list. Explore is the same records placed on the
        map. A record's own page carries the full citations and history behind it. All three read
        the same underlying catalog.
      </p>
      <div className="ds-mdiag__frame">
        <svg
          className="ds-mdiag__svg"
          viewBox="0 0 680 168"
          role="img"
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
        >
          <style>{SKETCH_STYLE}</style>
          <title>Sketch: Records, Explore, and a record's page, linked as one catalog</title>
          {nodes.map((node, index) => {
            const x = xAt(index);
            return (
              <React.Fragment key={node.title}>
                <path className="ds-mdiag__box" d={sketchRect(x, boxY, boxW, boxH, node.seed)} />
                <text className="ds-mdiag__title" x={x + 16} y={boxY + 30}>
                  {node.title}
                </text>
                <TextLines
                  x={x + 16}
                  y={boxY + 54}
                  lines={node.body}
                  className="ds-mdiag__body"
                  lineHeight={18}
                />
              </React.Fragment>
            );
          })}
          <SketchLink x1={xAt(0) + boxW} y1={mid} x2={xAt(1)} y2={mid} seed={651} />
          <SketchLink x1={xAt(1) + boxW} y1={mid} x2={xAt(2)} y2={mid} seed={663} />
          <text className="ds-mdiag__note" x={340} y={150} textAnchor="middle">
            Same catalog, read three ways
          </text>
        </svg>
      </div>
    </figure>
  );
}
