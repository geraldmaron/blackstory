/**
 * Hand-sketch architecture diagrams for the public methodology page (and a
 * compact reuse on the homepage How-this-works band).
 *
 * Shows generalized research flow: curated + broad-net intake → fragment
 * aggregation → local home-server models and paid models → vector/data layer →
 * human verification and publish gate. Flat matte fills only; copper marks
 * orientation. Never used to imply AI publishes without review.
 */
import React from 'react';

void React;

export type ResearchPipelineSketchProps = {
  /** Homepage trust band: SVG + short caption, no stage legend (points live beside it). */
  readonly compact?: boolean;
};

/** Embedded so SVG shapes stay visible even if the page forgets the CSS side-effect import. */
const PIPELINE_SKETCH_SVG_STYLE = `
  .ds-pipeline-sketch__svg text { fill: currentColor; font-family: var(--ds-font-mono); }
  .ds-pipeline-sketch__label { font-size: 9px; letter-spacing: 0.01em; }
  .ds-pipeline-sketch__label--center { text-anchor: middle; }
  .ds-pipeline-sketch__title { font-size: 11px; font-weight: 600; letter-spacing: 0.01em; }
  .ds-pipeline-sketch__note { font-size: 8.5px; letter-spacing: 0.01em; fill: var(--ds-ink-muted); }
  .ds-pipeline-sketch__box {
    fill: var(--ds-surface-raised);
    stroke: var(--ds-ink);
    stroke-width: 1.75;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .ds-pipeline-sketch__box--accent { stroke: var(--ds-accent-graphic); stroke-width: 2; }
  .ds-pipeline-sketch__box--muted {
    fill: var(--ds-surface);
    stroke: var(--ds-ink-muted);
    stroke-width: 1.75;
  }
  .ds-pipeline-sketch__connector {
    fill: none;
    stroke: var(--ds-ink-muted);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ds-pipeline-sketch__connector--accent { stroke: var(--ds-accent-graphic); stroke-width: 1.85; }
  .ds-pipeline-sketch__dash { stroke-dasharray: 4 5; }
  .ds-pipeline-sketch__piece {
    fill: var(--ds-surface);
    stroke: var(--ds-ink);
    stroke-width: 1.65;
    stroke-linejoin: round;
  }
  .ds-pipeline-sketch__piece--fill {
    fill: color-mix(in srgb, var(--ds-accent-graphic) 18%, var(--ds-surface-raised));
    stroke: var(--ds-accent-graphic);
    stroke-width: 1.85;
  }
  .ds-pipeline-sketch__glyph {
    fill: none;
    stroke: var(--ds-ink);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ds-pipeline-sketch__glyph-dot {
    fill: var(--ds-ink);
    stroke: var(--ds-ink);
    stroke-width: 1.2;
  }
  .ds-pipeline-sketch__arrowhead { fill: var(--ds-accent-graphic); stroke: none; }
`;

function SketchArrowHead({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <path
      className="ds-pipeline-sketch__arrowhead"
      d={`M ${x - 5} ${y - 7} L ${x} ${y} L ${x + 5} ${y - 7} Z`}
    />
  );
}

const PIPELINE_DESC =
  'Two intake nets feed adapters: a curated net of government records, archives, museums, and ' +
  'scholarship, and a broad net of forums, Reddit, web search, and community feeds. Fragments ' +
  'aggregate like puzzle pieces, then run through a private local AI home server for a first ' +
  'pass and paid models for deeper research. Vectors and provenance sit in a data layer. Human ' +
  'verification and a publish gate decide what reaches the public record. Discovery tools never ' +
  'publish alone.';

/** Condensed horizontal sketch for the homepage — same stages, ~1/3 the height. */
function CompactResearchPipelineFigure() {
  const titleId = 'research-pipeline-sketch-home-title';
  const descId = 'research-pipeline-sketch-home-desc';

  return (
    <figure
      className="ds-pipeline-sketch ds-pipeline-sketch--compact"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <figcaption className="ds-pipeline-sketch__figcaption" id={titleId}>
        Research pipeline: intake to publish gate
      </figcaption>
      <p className="ds-visually-hidden" id={descId}>
        {PIPELINE_DESC}
      </p>
      <svg
        className="ds-pipeline-sketch__svg"
        viewBox="0 0 720 268"
        role="img"
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
      >
        <style>{PIPELINE_SKETCH_SVG_STYLE}</style>
        <title>Research pipeline sketch</title>

        <text className="ds-pipeline-sketch__note" x="24" y="22">
          01 · intake
        </text>
        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--accent"
          d="M 24 36 C 22 34, 28 32, 40 34 L 168 32 C 180 33, 184 38, 182 50 L 180 118 C 181 130, 174 136, 160 134 L 36 132 C 24 131, 18 124, 20 112 Z"
        />
        <text className="ds-pipeline-sketch__title" x="40" y="58">
          Curated net
        </text>
        <text className="ds-pipeline-sketch__label" x="40" y="78">
          Gov · Archives
        </text>
        <text className="ds-pipeline-sketch__label" x="40" y="96">
          Museums · Law
        </text>
        <path
          className="ds-pipeline-sketch__box"
          d="M 24 148 C 22 146, 28 144, 40 146 L 168 144 C 180 145, 184 150, 182 162 L 180 230 C 181 242, 174 248, 160 246 L 36 244 C 24 243, 18 236, 20 224 Z"
        />
        <text className="ds-pipeline-sketch__title" x="40" y="170">
          Broad net
        </text>
        <text className="ds-pipeline-sketch__label" x="40" y="190">
          Forums · Search
        </text>
        <text className="ds-pipeline-sketch__label" x="40" y="208">
          RSS · Community
        </text>

        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 186 90 C 198 90, 206 112, 218 134"
        />
        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 186 190 C 198 190, 206 168, 218 146"
        />
        <SketchArrowHead x={220} y={140} />

        <text className="ds-pipeline-sketch__note" x="236" y="22">
          02 · assemble
        </text>
        <path
          className="ds-pipeline-sketch__box"
          d="M 236 48 C 234 46, 240 44, 252 46 L 360 44 C 372 45, 376 52, 374 64 L 372 220 C 373 234, 366 240, 352 238 L 248 236 C 236 235, 230 228, 232 214 Z"
        />
        <text className="ds-pipeline-sketch__title" x="252" y="72">
          Puzzle pieces
        </text>
        <text className="ds-pipeline-sketch__label" x="252" y="92">
          Claims · Place
        </text>
        <text className="ds-pipeline-sketch__label" x="252" y="110">
          Citations · Dedup
        </text>
        <path className="ds-pipeline-sketch__piece" d="M 268 140 L 300 136 L 304 168 L 272 172 Z" />
        <path className="ds-pipeline-sketch__piece" d="M 296 148 L 328 144 L 332 176 L 300 180 Z" />
        <path
          className="ds-pipeline-sketch__piece ds-pipeline-sketch__piece--fill"
          d="M 280 176 L 312 172 L 316 204 L 284 208 Z"
        />
        <text className="ds-pipeline-sketch__note" x="252" y="228">
          quarantine · not a dump
        </text>

        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 380 140 L 408 140"
        />
        <SketchArrowHead x={412} y={140} />

        <text className="ds-pipeline-sketch__note" x="424" y="22">
          03 · models
        </text>
        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--accent"
          d="M 424 36 C 422 34, 428 32, 440 34 L 548 32 C 560 33, 564 38, 562 50 L 560 118 C 561 130, 554 136, 540 134 L 436 132 C 424 131, 418 124, 420 112 Z"
        />
        <text className="ds-pipeline-sketch__title" x="440" y="58">
          Local server
        </text>
        <text className="ds-pipeline-sketch__label" x="440" y="78">
          First pass · private
        </text>
        <text className="ds-pipeline-sketch__note" x="440" y="100">
          stages drafts only
        </text>
        <path
          className="ds-pipeline-sketch__box"
          d="M 424 148 C 422 146, 428 144, 440 146 L 548 144 C 560 145, 564 150, 562 162 L 560 230 C 561 242, 554 248, 540 246 L 436 244 C 424 243, 418 236, 420 224 Z"
        />
        <text className="ds-pipeline-sketch__title" x="440" y="170">
          Paid models
        </text>
        <text className="ds-pipeline-sketch__label" x="440" y="190">
          Deeper research
        </text>
        <text className="ds-pipeline-sketch__note" x="440" y="212">
          still human-gated
        </text>

        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 566 90 C 578 90, 586 112, 598 134"
        />
        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 566 190 C 578 190, 586 168, 598 146"
        />
        <SketchArrowHead x={600} y={140} />

        <text className="ds-pipeline-sketch__note" x="612" y="22">
          04 · gate
        </text>
        <path
          className="ds-pipeline-sketch__box"
          d="M 612 48 C 610 46, 616 44, 628 46 L 696 44 C 706 45, 710 52, 708 64 L 706 120 C 707 132, 700 138, 688 136 L 624 134 C 612 133, 606 126, 608 114 Z"
        />
        <text className="ds-pipeline-sketch__title" x="628" y="72">
          Verify
        </text>
        <text className="ds-pipeline-sketch__label" x="628" y="92">
          People review
        </text>
        <text className="ds-pipeline-sketch__note" x="628" y="112">
          provenance
        </text>
        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--accent"
          d="M 612 152 C 610 150, 616 148, 628 150 L 696 148 C 706 149, 710 156, 708 168 L 706 224 C 707 236, 700 242, 688 240 L 624 238 C 612 237, 606 230, 608 218 Z"
        />
        <text className="ds-pipeline-sketch__title" x="628" y="176">
          Publish gate
        </text>
        <text className="ds-pipeline-sketch__label" x="628" y="196">
          Human decision
        </text>
        <text className="ds-pipeline-sketch__note" x="628" y="216">
          public record
        </text>

        <text className="ds-pipeline-sketch__note" x="24" y="262">
          Discovery tools never publish alone
        </text>
      </svg>
    </figure>
  );
}

/** Full end-to-end research pipeline as a notebook-style sketch. */
export function ResearchPipelineSketch({ compact = false }: ResearchPipelineSketchProps) {
  if (compact) {
    return <CompactResearchPipelineFigure />;
  }

  const titleId = 'research-pipeline-sketch-title';
  const descId = 'research-pipeline-sketch-desc';

  return (
    <figure className="ds-pipeline-sketch" aria-labelledby={titleId} aria-describedby={descId}>
      <figcaption className="ds-pipeline-sketch__figcaption" id={titleId}>
        Research pipeline (sketch): how fragments become a published record
      </figcaption>
      <p className="ds-visually-hidden" id={descId}>
        {PIPELINE_DESC}
      </p>
      <svg
        className="ds-pipeline-sketch__svg"
        viewBox="0 0 720 824"
        role="img"
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
      >
        <style>{PIPELINE_SKETCH_SVG_STYLE}</style>
        <title>Research pipeline sketch</title>

        {/* Stage 1 — dual nets */}
        <text className="ds-pipeline-sketch__note" x="28" y="28">
          01 · intake
        </text>

        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--accent"
          d="M 36 44
             C 34 42, 38 40, 52 42
             L 318 38
             C 332 39, 338 44, 336 58
             L 332 198
             C 333 212, 326 218, 310 216
             L 48 212
             C 34 211, 28 204, 30 190
             Z"
        />
        <text className="ds-pipeline-sketch__title" x="52" y="68">
          Curated net
        </text>
        <text className="ds-pipeline-sketch__label" x="52" y="92">
          Government · Archives
        </text>
        <text className="ds-pipeline-sketch__label" x="52" y="112">
          Museums · Libraries
        </text>
        <text className="ds-pipeline-sketch__label" x="52" y="132">
          Scholarship · Legal
        </text>
        <text className="ds-pipeline-sketch__note" x="52" y="158">
          registered sources · bulk + API
        </text>
        {/* small building glyph */}
        <path
          className="ds-pipeline-sketch__glyph"
          d="M 268 96 L 268 148 L 308 148 L 308 96 M 268 96 L 288 78 L 308 96 M 280 128 h 8 v 20 M 292 118 h 8 v 30"
        />

        <path
          className="ds-pipeline-sketch__box"
          d="M 384 42
             C 382 40, 388 38, 402 40
             L 678 36
             C 694 38, 700 44, 698 58
             L 694 198
             C 695 214, 688 220, 672 218
             L 396 214
             C 380 212, 374 206, 376 190
             Z"
        />
        <text className="ds-pipeline-sketch__title" x="400" y="68">
          Broad net
        </text>
        <text className="ds-pipeline-sketch__label" x="400" y="92">
          Forums · Reddit
        </text>
        <text className="ds-pipeline-sketch__label" x="400" y="112">
          Web search · RSS
        </text>
        <text className="ds-pipeline-sketch__label" x="400" y="132">
          Community oral leads
        </text>
        <text className="ds-pipeline-sketch__note" x="400" y="158">
          discovery only · low-authority
        </text>
        {/* net / nodes glyph */}
        <circle className="ds-pipeline-sketch__glyph-dot" cx="640" cy="112" r="5" />
        <circle className="ds-pipeline-sketch__glyph-dot" cx="662" cy="128" r="4" />
        <circle className="ds-pipeline-sketch__glyph-dot" cx="622" cy="134" r="4" />
        <path
          className="ds-pipeline-sketch__glyph"
          d="M 640 112 L 662 128 M 640 112 L 622 134 M 622 134 L 662 128"
        />

        {/* converge connectors */}
        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__dash"
          d="M 186 218 C 190 236, 200 248, 240 258"
        />
        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__dash"
          d="M 540 218 C 520 236, 480 248, 440 258"
        />
        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 340 258 C 348 268, 352 278, 360 288"
        />
        <SketchArrowHead x={360} y={292} />

        {/* Stage 2 — puzzle aggregation */}
        <text className="ds-pipeline-sketch__note" x="28" y="318">
          02 · aggregation
        </text>
        <path
          className="ds-pipeline-sketch__box"
          d="M 120 328
             C 118 326, 124 324, 140 326
             L 600 322
             C 618 324, 624 330, 622 346
             L 618 458
             C 619 474, 612 480, 594 478
             L 136 474
             C 118 472, 112 466, 114 450
             Z"
        />
        <text className="ds-pipeline-sketch__title" x="148" y="352">
          Fragments → one case
        </text>
        <text className="ds-pipeline-sketch__label" x="148" y="374">
          Dedup · quarantine · authority
        </text>

        {/* puzzle pieces */}
        <path
          className="ds-pipeline-sketch__piece"
          d="M 180 400
             h 52
             c 0,-8 10,-12 14,-4
             c 4,8 14,4 14,-4
             h 40
             v 36
             c 8,0 12,10 4,14
             c -8,4 -4,14 4,14
             v 22
             h -52
             c 0,8 -10,12 -14,4
             c -4,-8 -14,-4 -14,4
             h -40
             v -22
             c -8,0 -12,-10 -4,-14
             c 8,-4 4,-14 -4,-14
             z"
        />
        <path
          className="ds-pipeline-sketch__piece"
          d="M 320 408
             h 48
             c 0,-7 9,-11 13,-3
             c 4,7 13,3 13,-3
             h 36
             v 32
             c 7,0 11,9 3,13
             c -7,3 -3,12 3,12
             v 20
             h -48
             c 0,7 -9,11 -13,3
             c -4,-7 -13,-3 -13,3
             h -36
             v -20
             c -7,0 -11,-9 -3,-13
             c 7,-3 3,-12 -3,-12
             z"
        />
        <path
          className="ds-pipeline-sketch__piece ds-pipeline-sketch__piece--fill"
          d="M 460 400
             h 50
             c 0,-8 10,-12 14,-4
             c 4,8 14,4 14,-4
             h 38
             v 34
             c 8,0 12,10 4,14
             c -8,4 -4,14 4,14
             v 24
             h -50
             c 0,8 -10,12 -14,4
             c -4,-8 -14,-4 -14,4
             h -38
             v -24
             c -8,0 -12,-10 -4,-14
             c 8,-4 4,-14 -4,-14
             z"
        />
        <text className="ds-pipeline-sketch__note" x="196" y="456">
          cite
        </text>
        <text className="ds-pipeline-sketch__note" x="348" y="456">
          place
        </text>
        <text className="ds-pipeline-sketch__note" x="498" y="456">
          claim
        </text>

        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 360 482 C 360 494, 360 504, 360 514"
        />
        <SketchArrowHead x={360} y={518} />

        {/* Stage 3 — dual AI */}
        <text className="ds-pipeline-sketch__note" x="28" y="538">
          03 · private review · no auto-publish
        </text>

        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--accent"
          d="M 48 550
             C 46 548, 52 546, 66 548
             L 330 544
             C 346 546, 352 552, 350 566
             L 346 640
             C 347 654, 340 660, 324 658
             L 62 654
             C 46 652, 40 646, 42 632
             Z"
        />
        <text className="ds-pipeline-sketch__title" x="66" y="574">
          Local home server
        </text>
        <text className="ds-pipeline-sketch__label" x="66" y="596">
          On-prem models · first pass
        </text>
        <text className="ds-pipeline-sketch__note" x="66" y="620">
          overnight · hybrid failover
        </text>
        {/* server rack glyph */}
        <path
          className="ds-pipeline-sketch__glyph"
          d="M 286 578 h 36 v 48 h -36 z M 292 588 h 24 M 292 598 h 24 M 292 608 h 24"
        />

        <path
          className="ds-pipeline-sketch__box"
          d="M 390 550
             C 388 548, 394 546, 408 548
             L 672 544
             C 688 546, 694 552, 692 566
             L 688 640
             C 689 654, 682 660, 666 658
             L 404 654
             C 388 652, 382 646, 384 632
             Z"
        />
        <text className="ds-pipeline-sketch__title" x="408" y="574">
          Paid cloud models
        </text>
        <text className="ds-pipeline-sketch__label" x="408" y="596">
          Deeper research · inference
        </text>
        <text className="ds-pipeline-sketch__note" x="408" y="620">
          editor drafts only
        </text>
        {/* cloud glyph */}
        <path
          className="ds-pipeline-sketch__glyph"
          d="M 628 600
             c -8,-14 4,-28 18,-22
             c 6,-14 28,-14 34,2
             c 14,0 22,14 12,24
             h -56
             c -10,0 -14,-8 -8,-14 z"
        />

        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__dash"
          d="M 190 662 C 200 676, 240 684, 300 688"
        />
        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__dash"
          d="M 540 662 C 520 676, 460 684, 420 688"
        />
        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 360 690 C 360 708, 360 722, 360 736"
        />
        <SketchArrowHead x={360} y={740} />

        {/* Stage 4 — data + gate */}
        <text className="ds-pipeline-sketch__note" x="28" y="734">
          04 · data layer → verify → publish
        </text>
        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--muted"
          d="M 70 744
             C 68 742, 74 740, 88 742
             L 250 740
             C 264 741, 270 746, 268 760
             L 266 792
             C 267 800, 260 804, 246 802
             L 86 800
             C 72 799, 66 794, 68 782
             Z"
        />
        <text className="ds-pipeline-sketch__label" x="90" y="768">
          Vectors
        </text>
        <text className="ds-pipeline-sketch__note" x="90" y="786">
          embeddings · dedup
        </text>

        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 274 774 L 292 774"
        />
        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 286 768 L 294 774 L 286 780"
        />

        <path
          className="ds-pipeline-sketch__box"
          d="M 300 744
             C 298 742, 304 740, 318 742
             L 480 740
             C 494 741, 500 746, 498 760
             L 496 792
             C 497 800, 490 804, 476 802
             L 316 800
             C 302 799, 296 794, 298 782
             Z"
        />
        <text className="ds-pipeline-sketch__label" x="320" y="768">
          Verify
        </text>
        <text className="ds-pipeline-sketch__note" x="320" y="786">
          triangulate · cite
        </text>

        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 504 774 L 522 774"
        />
        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent"
          d="M 516 768 L 524 774 L 516 780"
        />

        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--accent"
          d="M 530 744
             C 528 742, 534 740, 548 742
             L 680 740
             C 694 741, 700 746, 698 760
             L 696 792
             C 697 800, 690 804, 676 802
             L 546 800
             C 532 799, 526 794, 528 782
             Z"
        />
        <text className="ds-pipeline-sketch__label" x="552" y="768">
          Publish gate
        </text>
        <text className="ds-pipeline-sketch__note" x="552" y="786">
          human decision
        </text>
      </svg>

      <ol className="ds-pipeline-sketch__legend">
          <li>
            <span className="ds-pipeline-sketch__legend-mark">01</span>
            <span>
              Curated sources are registered and rights-checked; broad-net leads (including community
              forums) only surface candidates.
            </span>
          </li>
          <li>
            <span className="ds-pipeline-sketch__legend-mark">02</span>
            <span>
              Fragments assemble like puzzle pieces — citations, place, and claims — through dedup
              and quarantine, not a single scrape dump.
            </span>
          </li>
          <li>
            <span className="ds-pipeline-sketch__legend-mark">03</span>
            <span>
              Local models on a private home server run a first pass; paid models deepen research.
              Both stage drafts for people — they never write the public projection.
            </span>
          </li>
          <li>
            <span className="ds-pipeline-sketch__legend-mark">04</span>
            <span>
              Vectors help search and near-duplicate screening; provenance travels with every claim.
              Human verification and the publish gate decide what readers see.
            </span>
          </li>
        </ol>
    </figure>
  );
}

/** Source-type sketch: authority ladder vs discovery net, placed near source hierarchy copy. */
export function SourceTypesSketch() {
  const titleId = 'source-types-sketch-title';
  const descId = 'source-types-sketch-desc';

  return (
    <figure className="ds-pipeline-sketch" aria-labelledby={titleId} aria-describedby={descId}>
      <figcaption className="ds-pipeline-sketch__figcaption" id={titleId}>
        Source types (sketch) — proximity to the event, not volume
      </figcaption>
      <p className="ds-visually-hidden" id={descId}>
        Authority sources include government records, archives, museums, libraries, and peer-reviewed
        scholarship. Discovery sources include news reportage, encyclopedias, web search hits,
        Reddit and forums, and self-published community feeds. Discovery never outranks primary
        evidence on disputed facts.
      </p>
      <svg
        className="ds-pipeline-sketch__svg"
        viewBox="0 0 720 348"
        role="img"
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
      >
        <style>{PIPELINE_SKETCH_SVG_STYLE}</style>
        <title>Source types sketch</title>

        <text className="ds-pipeline-sketch__note" x="28" y="28">
          authority ladder
        </text>
        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--accent"
          d="M 40 44
             C 38 42, 44 40, 58 42
             L 340 38
             C 356 40, 362 46, 360 60
             L 356 308
             C 357 322, 350 328, 334 326
             L 54 322
             C 38 320, 32 314, 34 300
             Z"
        />

        {/* stacked tiers — slightly crooked for sketch feel */}
        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--accent"
          d="M 66 66 L 312 62 L 314 114 L 64 116 Z"
        />
        <text className="ds-pipeline-sketch__title" x="82" y="88">
          Primary
        </text>
        <text className="ds-pipeline-sketch__label" x="82" y="106">
          Gov · court · archival
        </text>

        <path className="ds-pipeline-sketch__box" d="M 64 128 L 314 124 L 316 176 L 62 178 Z" />
        <text className="ds-pipeline-sketch__title" x="82" y="150">
          Secondary
        </text>
        <text className="ds-pipeline-sketch__label" x="82" y="168">
          Scholarship · investigation
        </text>

        <path
          className="ds-pipeline-sketch__box ds-pipeline-sketch__box--muted"
          d="M 66 190 L 312 186 L 314 238 L 64 240 Z"
        />
        <text className="ds-pipeline-sketch__title" x="82" y="212">
          Tertiary
        </text>
        <text className="ds-pipeline-sketch__label" x="82" y="230">
          Encyclopedias · aggregates
        </text>

        <text className="ds-pipeline-sketch__note" x="82" y="264">
          Museums · libraries · RSS
        </text>
        <text className="ds-pipeline-sketch__note" x="82" y="282">
          ranked by proximity to the event
        </text>

        <text className="ds-pipeline-sketch__note" x="392" y="28">
          discovery net (find, then verify)
        </text>
        <path
          className="ds-pipeline-sketch__box"
          d="M 392 44
             C 390 42, 396 40, 410 42
             L 686 38
             C 702 40, 708 46, 706 60
             L 702 308
             C 703 322, 696 328, 680 326
             L 406 322
             C 390 320, 384 314, 386 300
             Z"
        />

        {/* loose bubbles */}
        <path
          className="ds-pipeline-sketch__piece"
          d="M 430 78
             C 424 70, 436 62, 450 66
             C 462 58, 484 62, 486 78
             C 502 80, 504 98, 490 106
             C 492 120, 472 126, 458 118
             C 444 126, 424 118, 428 104
             C 414 98, 418 82, 430 78 Z"
        />
        <text className="ds-pipeline-sketch__label ds-pipeline-sketch__label--center" x="458" y="96">
          Reddit
        </text>

        <path
          className="ds-pipeline-sketch__piece"
          d="M 540 70
             C 534 62, 548 54, 562 58
             C 576 50, 598 56, 598 72
             C 614 74, 616 92, 600 100
             C 602 114, 580 120, 566 112
             C 552 120, 532 112, 536 98
             C 522 92, 526 76, 540 70 Z"
        />
        <text className="ds-pipeline-sketch__label ds-pipeline-sketch__label--center" x="566" y="88">
          Forums
        </text>

        <path
          className="ds-pipeline-sketch__piece"
          d="M 430 150
             C 424 142, 438 134, 452 138
             C 466 130, 490 136, 490 152
             C 506 154, 508 172, 492 180
             C 494 194, 472 200, 458 192
             C 444 200, 424 192, 428 178
             C 414 172, 418 156, 430 150 Z"
        />
        <text className="ds-pipeline-sketch__label ds-pipeline-sketch__label--center" x="458" y="168">
          Web search
        </text>

        <path
          className="ds-pipeline-sketch__piece"
          d="M 540 142
             C 534 134, 548 126, 562 130
             C 576 122, 598 128, 598 144
             C 614 146, 616 164, 600 172
             C 602 186, 580 192, 566 184
             C 552 192, 532 184, 536 170
             C 522 164, 526 148, 540 142 Z"
        />
        <text className="ds-pipeline-sketch__label ds-pipeline-sketch__label--center" x="566" y="160">
          RSS · oral
        </text>

        <path
          className="ds-pipeline-sketch__connector ds-pipeline-sketch__connector--accent ds-pipeline-sketch__dash"
          d="M 560 218 C 560 240, 520 260, 470 272"
        />
        <SketchArrowHead x={468} y={276} />
        <text className="ds-pipeline-sketch__label" x="418" y="302">
          → harvest authority hosts
        </text>
      </svg>

      <ul className="ds-pipeline-sketch__legend">
        <li>
          <span className="ds-pipeline-sketch__legend-mark">gov</span>
          <span>
            Official records and archival manuscripts sit highest when they are contemporaneous with
            the event.
          </span>
        </li>
        <li>
          <span className="ds-pipeline-sketch__legend-mark">net</span>
          <span>
            Broad-net hits help us find leads; independent primary or secondary lineages still have
            to clear verification before publish.
          </span>
        </li>
      </ul>
    </figure>
  );
}
