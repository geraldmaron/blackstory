/**
 * Methodology page sections: mission, research pipeline, trust pedagogy, definitions,
 * source hierarchy, verification, confidence, map dignity, limitations, and a compact
 * secondary band for cadence, corrections, funding, masthead, transparency, and IFCN.
 */
import React from 'react';
import Link from 'next/link';
import { Notice } from '@repo/ui';
import {
  FACT_CONFIDENCE_DEFINITIONS,
  type FactConfidenceGrade,
  type FactStatus,
} from '@repo/domain/facts';
import {
  CULTURAL_FIGURE_NOTABILITY_CALIBRATION_NOTE,
  NOTABILITY_CRITERIA,
  NOTABILITY_RUBRIC,
} from '@repo/domain/entity-status';
import {
  ENTITY_STATUS_VOCABULARY,
  FACT_STATUS_LIFECYCLE_DEFINITIONS,
  IFCN_COMMITMENTS,
  PREBUNK_TECHNIQUE_FRAMES,
  SOURCE_HIERARCHY_LEVELS,
  TRUST_PROJECT_INDICATORS,
} from '../../lib/trust/domain-trust';
import { humanizeToken, mapConfidenceToUiLevel } from '../../components/facts/format';
import { ConfidenceMark } from '../../components/map-experience/ConfidenceMark';
import {
  ResearchPipelineSketch,
  SourceTypesSketch,
} from '../../components/trust/ResearchPipelineSketch';
import { TrustSiteDisclaimer } from '../../components/trust/TrustSiteDisclaimer';
import '../../components/trust/research-pipeline-sketch.css';
import './methodology.css';

const PAGE_SECTIONS = [
  { id: 'mission', label: 'Mission' },
  { id: 'research-pipeline', label: 'Research flow' },
  { id: 'how-to-read', label: 'How to read' },
  { id: 'definitions', label: 'Definitions' },
  { id: 'sources', label: 'Sources' },
  { id: 'standards', label: 'Standards' },
  { id: 'operations', label: 'Operations' },
] as const;

const MISSION_BEATS = [
  {
    kicker: 'Not erased',
    body: 'Corrections append; disagreements stay visible; withdrawn records remain resolvable.',
  },
  {
    kicker: 'Not hidden',
    body: 'Every public claim carries citations and a path back to sources.',
  },
  {
    kicker: 'About you',
    body: 'History pinned to states, cities, campuses, and documented sites near where people live and learn.',
  },
] as const;

const VERIFICATION_STEPS = [
  'Identify primary sources closest to the event or record creation.',
  'Cross-check against independent secondary scholarship where primaries are sparse.',
  'Document contradictions in confidence notes and counter-claims rather than hiding them.',
  'Append every change to the revision log with a mandatory edit summary.',
] as const;

const DIGNITY_RULES = [
  'Public precision runs from country through campus or institution — never street addresses or exact residence coordinates for living people.',
  'Points render no sharper than stored public precision. A coarsened point is never labeled as an exact address.',
  'No red or alarm hues for violence-adjacent records; no crime-heat rendering. Color is never the only signal.',
  'Unknown living status is treated as living. Current residential addresses do not appear on public pages or hand-offs.',
  'Hard history is documented where the sources support it, but presence — people, institutions, places across time — is the default lens, not a trauma-first feed.',
] as const;

const LIMITATION_RULES = [
  'Coverage is uneven across places and eras. Absence on the map is not proof that nothing happened — it may mean sources have not cleared the publish gate yet.',
  'Single-source facts are published only with an explicit confidence note explaining why.',
  'External statistics (census, ACS, voluntary reporting series) carry their own coverage limits; participation and suppression are part of the reading, not optional footnotes.',
  'Link rot and missing archives happen. Where a web source was captured, the capture travels with the citation; where it was not, the gap is visible.',
] as const;

const INTERNAL_FACT_STATUSES = new Set<FactStatus>(['draft', 'under_review']);

function summarizeDefinition(text: string, maxLength = 128): { readonly summary: string; readonly hasMore: boolean } {
  const trimmed = text.trim();
  const sentenceMatch = trimmed.match(/^[^.!?]+[.!?]/);
  const firstSentence = sentenceMatch?.[0]?.trim() ?? trimmed;
  if (firstSentence.length <= maxLength && firstSentence === trimmed) {
    return { summary: trimmed, hasMore: false };
  }
  const summary =
    firstSentence.length <= maxLength
      ? firstSentence
      : `${trimmed.slice(0, maxLength - 1).trim()}…`;
  return { summary, hasMore: summary !== trimmed };
}

function TermChip({
  children,
  variant,
}: {
  readonly children: React.ReactNode;
  readonly variant?: 'default' | 'internal' | 'public';
}) {
  return (
    <span
      className={[
        'ds-methodology__chip',
        variant === 'internal' ? 'ds-methodology__chip--internal' : '',
        variant === 'public' ? 'ds-methodology__chip--public' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

function LedgerCard({
  term,
  definition,
  meta,
  termVariant,
}: {
  readonly term: string;
  readonly definition: string;
  readonly meta?: string;
  readonly termVariant?: 'default' | 'internal' | 'public';
}) {
  const { summary, hasMore } = summarizeDefinition(definition);

  return (
    <article className="ds-methodology__ledger-item">
      <div className="ds-methodology__ledger-head">
        <TermChip {...(termVariant ? { variant: termVariant } : {})}>{term}</TermChip>
        {meta ? <span className="ds-methodology__ledger-meta">{meta}</span> : null}
      </div>
      <p className="ds-methodology__ledger-summary">{summary}</p>
      {hasMore ? (
        <details className="ds-methodology__ledger-detail">
          <summary>Read full definition</summary>
          <p>{definition}</p>
        </details>
      ) : null}
    </article>
  );
}

function LedgerStack({
  items,
  className,
}: {
  readonly items: readonly {
    readonly id: string;
    readonly term: string;
    readonly definition: string;
    readonly meta?: string;
    readonly termVariant?: 'default' | 'internal' | 'public';
  }[];
  readonly className?: string;
}) {
  return (
    <div className={['ds-methodology__ledger', className ?? ''].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <LedgerCard
          key={item.id}
          term={item.term}
          definition={item.definition}
          {...(item.meta ? { meta: item.meta } : {})}
          {...(item.termVariant ? { termVariant: item.termVariant } : {})}
        />
      ))}
    </div>
  );
}

function ConfidenceGradeCard({
  grade,
  definition,
}: {
  readonly grade: FactConfidenceGrade;
  readonly definition: string;
}) {
  const uiLevel = mapConfidenceToUiLevel(grade);
  const label = humanizeToken(grade);
  const { summary, hasMore } = summarizeDefinition(definition);

  return (
    <article className="ds-methodology__grade-card">
      <div className="ds-methodology__grade-head">
        <ConfidenceMark tier={uiLevel} labeled />
        <span className="ds-methodology__grade-label">{label}</span>
      </div>
      <p className="ds-methodology__grade-summary">{summary}</p>
      {hasMore ? (
        <details className="ds-methodology__ledger-detail">
          <summary>Read full grade definition</summary>
          <p>{definition}</p>
        </details>
      ) : null}
    </article>
  );
}

function RuleStrip({
  rules,
  label,
}: {
  readonly rules: readonly string[];
  readonly label: string;
}) {
  return (
    <ol className="ds-methodology__rule-strip" aria-label={label}>
      {rules.map((rule) => (
        <li key={rule} className="ds-methodology__rule-row">
          <span className="ds-methodology__rule-text">{rule}</span>
        </li>
      ))}
    </ol>
  );
}

function SourceTierStack({
  entries,
}: {
  readonly entries: readonly { readonly term: string; readonly definition: string }[];
}) {
  return (
    <ol className="ds-methodology__tier-stack">
      {entries.map((entry, index) => {
        const { summary, hasMore } = summarizeDefinition(entry.definition);
        return (
          <li key={entry.term} className="ds-methodology__tier-item">
            <div className="ds-methodology__tier-head">
              <span className="ds-methodology__tier-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <TermChip>{entry.term}</TermChip>
            </div>
            <p className="ds-methodology__ledger-summary">{summary}</p>
            {hasMore ? (
              <details className="ds-methodology__ledger-detail">
                <summary>Read full tier definition</summary>
                <p>{entry.definition}</p>
              </details>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function MethodologySections() {
  const notabilityItems = NOTABILITY_CRITERIA.map((criterion) => ({
    id: criterion,
    term: humanizeToken(criterion),
    definition: NOTABILITY_RUBRIC[criterion],
  }));

  const lifecycleItems = Object.entries(FACT_STATUS_LIFECYCLE_DEFINITIONS).map(([status, definition]) => ({
    id: status,
    term: humanizeToken(status),
    definition,
    meta: INTERNAL_FACT_STATUSES.has(status as FactStatus) ? 'Off public surfaces' : 'Public projection',
    termVariant: INTERNAL_FACT_STATUSES.has(status as FactStatus) ? ('internal' as const) : ('public' as const),
  }));

  const entityStatusItems = [
    ...ENTITY_STATUS_VOCABULARY.place_like.map((entry) => ({
      id: `place-${entry.value}`,
      term: `Place · ${humanizeToken(entry.value)}`,
      definition: entry.definition,
    })),
    ...ENTITY_STATUS_VOCABULARY.law.map((entry) => ({
      id: `law-${entry.value}`,
      term: `Law · ${humanizeToken(entry.value)}`,
      definition: entry.definition,
    })),
    ...ENTITY_STATUS_VOCABULARY.movement.map((entry) => ({
      id: `movement-${entry.value}`,
      term: `Movement · ${humanizeToken(entry.value)}`,
      definition: entry.definition,
    })),
  ];

  const sourceEntries = SOURCE_HIERARCHY_LEVELS.map((level) => ({
    term: humanizeToken(level.tier),
    definition: level.definition,
  }));

  const confidenceGrades = Object.keys(FACT_CONFIDENCE_DEFINITIONS) as FactConfidenceGrade[];

  const trustIndicatorItems = TRUST_PROJECT_INDICATORS.map((indicator) => ({
    id: indicator.id,
    term: indicator.title,
    definition: indicator.summary,
    meta: indicator.schemaProperty,
  }));

  const ifcnItems = IFCN_COMMITMENTS.map((commitment, index) => ({
    id: `ifcn-${index}`,
    term: commitment.title,
    definition: commitment.body,
  }));

  return (
    <div className="ds-methodology">
      <TrustSiteDisclaimer />

      <nav className="ds-methodology__nav" aria-labelledby="methodology-toc-title">
        <p className="ds-methodology__nav-title" id="methodology-toc-title">
          On this page
        </p>
        <ul className="ds-methodology__nav-list">
          {PAGE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a className="ds-methodology__nav-link" href={`#${section.id}`}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ds-entity-sections">
        <section
          className="ds-section ds-record-section ds-section--flush"
          aria-labelledby="mission-method"
          id="mission"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Mission &amp; scope
          </p>
          <h2 className="ds-section__title" id="mission-method">
            Released projections with receipts
          </h2>
          <p className="ds-section__lede">
            BlackStory publishes place-connected Black history with provenance, confidence grades,
            and living-person protections. We document what primary and secondary sources support,
            state what they do not, and preserve disagreements instead of collapsing them into a
            single winner.
          </p>
          <ul className="ds-methodology__mission-grid">
            {MISSION_BEATS.map((beat) => (
              <li key={beat.kicker} className="ds-methodology__mission-item">
                <p className="ds-methodology__mission-kicker">{beat.kicker}</p>
                <p className="ds-methodology__mission-body">{beat.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="research-pipeline-method"
          id="research-pipeline"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            How research moves
          </p>
          <h2 className="ds-section__title" id="research-pipeline-method">
            From intake to publish gate
          </h2>
          <p className="ds-section__lede">
            Discovery tools find candidates; they never substitute for verification. Fragments
            aggregate, models assist research on private surfaces, and human review decides what
            reaches the public record.
          </p>
          <ResearchPipelineSketch />
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="how-to-read-method"
          id="how-to-read"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            How to read a record
          </p>
          <h2 className="ds-section__title" id="how-to-read-method">
            Check the evidence yourself
          </h2>
          <p className="ds-section__lede">
            Historical records get challenged in predictable ways — out-of-context quotes,
            impossible documentation demands, or attacks on the messenger instead of the evidence.
            Name the technique, then follow the citation chain.
          </p>
          <ul className="ds-methodology__technique-grid">
            {PREBUNK_TECHNIQUE_FRAMES.map((frame) => (
              <li key={frame.id} className="ds-methodology__technique">
                <p className="ds-methodology__technique-name">{frame.technique}</p>
                <p className="ds-methodology__technique-action">{frame.readerAction}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="definitions-method"
          id="definitions"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Definitions &amp; inclusion
          </p>
          <h2 className="ds-section__title" id="definitions-method">
            Shared vocabulary
          </h2>
          <p className="ds-section__lede">
            Precision in definitions lets a reader compare this archive to others without talking
            past each other. Inclusion is never a popularity contest — every entity needs at least
            one documented notability basis.
          </p>

          <h3 className="ds-methodology__subhead">Notability basis (per kind)</h3>
          <LedgerStack items={notabilityItems} />
          <Notice
            className="ds-methodology__callout"
            tone="warning"
            title="Cultural-figure calibration"
          >
            {CULTURAL_FIGURE_NOTABILITY_CALIBRATION_NOTE}
          </Notice>

          <h3 className="ds-methodology__subhead">Fact record status lifecycle</h3>
          <Notice className="ds-methodology__callout" tone="warning" title="Public projection gate">
            Only published (and later corrected, superseded, or deprecated) facts appear on public
            surfaces. Draft and under-review work stay off the public projection and search index.
          </Notice>
          <LedgerStack items={lifecycleItems} />

          <h3 className="ds-methodology__subhead">Entity status vocabularies</h3>
          <LedgerStack items={entityStatusItems} />
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="source-hierarchy-method"
          id="sources"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Source hierarchy
          </p>
          <h2 className="ds-section__title" id="source-hierarchy-method">
            Proximity to the event
          </h2>
          <p className="ds-section__lede">
            Sources are ranked by proximity to the event and by independence. Discovery tools help
            find candidates; they do not substitute for verification.
          </p>
          <div className="ds-methodology__split">
            <SourceTierStack entries={sourceEntries} />
            <SourceTypesSketch />
          </div>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="standards-method"
          id="standards"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Verification &amp; limits
          </p>
          <h2 className="ds-section__title" id="standards-method">
            Standards you can audit
          </h2>

          <div className="ds-methodology__policy-block" id="verification">
            <h3 className="ds-methodology__policy-title" id="verification-method">
              Verification &amp; triangulation
            </h3>
            <p className="ds-methodology__policy-lede">
              Every published fact passes an independent citation-completeness gate before release.
              Triangulation means at least two independent lineages before corroborated grade;
              syndicated copies do not inflate scores.
            </p>
            <RuleStrip label="Verification steps" rules={VERIFICATION_STEPS} />
          </div>

          <div className="ds-methodology__policy-block" id="confidence">
            <h3 className="ds-methodology__policy-title" id="confidence-method">
              Confidence grades
            </h3>
            <p className="ds-methodology__policy-lede">
              Confidence is never color alone — every grade carries a glyph, a text label, and a
              published definition. Crime statistics never enter the composite confidence score.
            </p>
            <div className="ds-methodology__grade-grid">
              {confidenceGrades.map((grade) => (
                <ConfidenceGradeCard
                  key={grade}
                  grade={grade}
                  definition={FACT_CONFIDENCE_DEFINITIONS[grade]}
                />
              ))}
            </div>
          </div>

          <div className="ds-methodology__policy-block" id="dignity">
            <h3 className="ds-methodology__policy-title" id="dignity-method">
              Geographic precision &amp; map dignity
            </h3>
            <p className="ds-methodology__policy-lede">
              Place is the product&apos;s organizing idea — and also where harm is easiest to cause.
              Public maps follow dignity rules that are load-bearing, not decorative.
            </p>
            <RuleStrip label="Map dignity rules" rules={DIGNITY_RULES} />
          </div>

          <div className="ds-methodology__policy-block" id="limitations">
            <h3 className="ds-methodology__policy-title" id="limitations-method">
              Known limitations &amp; gaps
            </h3>
            <p className="ds-methodology__policy-lede">
              An archive of sourced facts will contain errors. Every correction is logged publicly
              and preserved in the record&apos;s history — nothing is silently edited.
            </p>
            <RuleStrip label="Known limitations" rules={LIMITATION_RULES} />
          </div>
        </section>
      </div>

      <section
        className="ds-section ds-methodology__secondary"
        aria-labelledby="operations-method"
        id="operations"
      >
        <p className="ds-section__kicker">Operations &amp; accountability</p>
        <h2 className="ds-section__title" id="operations-method">
          How the archive stays current
        </h2>
        <p className="ds-section__lede">
          Corrections, funding disclosures, editorial roles, and external alignment frameworks —
          the operational layer behind the evidence bar.
        </p>

        <div className="ds-methodology__secondary-grid">
          <article className="ds-methodology__secondary-item" id="cadence">
            <p className="ds-methodology__secondary-kicker">Update cadence</p>
            <h3 className="ds-methodology__secondary-title" id="cadence-method">
              Corrections ship when verified
            </h3>
            <p className="ds-methodology__secondary-body">
              Routine content reviews run quarterly; present-day advisories carry their own review
              dates on each record. Major methodology changes receive an editor&apos;s note in the{' '}
              <Link href="/errata">errata log</Link>.
            </p>
          </article>

          <article className="ds-methodology__secondary-item" id="report-error">
            <p className="ds-methodology__secondary-kicker">Corrections lane</p>
            <h3 className="ds-methodology__secondary-title" id="report-error-method">
              How to report an error
            </h3>
            <p className="ds-methodology__secondary-body">
              Use the <Link href="/corrections">corrections lane</Link> to challenge a published
              record, suggest missing evidence, or report a precision issue. Submissions enter a
              restricted review queue; nothing changes publicly until it passes independent
              verification. You receive a receipt code to track status.
            </p>
          </article>

          <article className="ds-methodology__secondary-item" id="funding">
            <p className="ds-methodology__secondary-kicker">Independence</p>
            <h3 className="ds-methodology__secondary-title" id="funding-method">
              Funding &amp; editorial firewall
            </h3>
            <p className="ds-methodology__secondary-body" id="independence">
              BlackStory is an independent editorial project. Funding sources, when applicable, are
              listed here and updated when they change. No funder receives advance editorial review
              or veto over published records. When formal funding disclosures apply, they will
              appear in this section with dates.
            </p>
          </article>

          <article className="ds-methodology__secondary-item" id="masthead">
            <p className="ds-methodology__secondary-kicker">Masthead</p>
            <h3 className="ds-methodology__secondary-title" id="masthead-method">
              Named accountability
            </h3>
            <p className="ds-methodology__secondary-body">
              Editorial accountability is named by role, not hidden behind an anonymous brand
              voice. Public bios link here as the team publishes them.
            </p>
            <ul className="ds-methodology__secondary-list">
              <li>Editorial lead — methodology, corrections policy, and publish gate</li>
              <li>Research lead — source verification and citation completeness</li>
              <li>Platform lead — projection integrity and security posture</li>
            </ul>
          </article>

          <article className="ds-methodology__secondary-item" id="transparency">
            <p className="ds-methodology__secondary-kicker">Trust Project</p>
            <h3 className="ds-methodology__secondary-title" id="transparency-method">
              Transparency indicators
            </h3>
            <p className="ds-methodology__secondary-body">
              We adopt the eight transparency practices and their schema.org vocabulary (CC-BY-SA)
              without using any trademarked program name or badge. Each indicator maps to a
              published policy URL on this site.
            </p>
            <LedgerStack className="ds-methodology__secondary-ledger" items={trustIndicatorItems} />
          </article>

          <article className="ds-methodology__secondary-item" id="ifcn">
            <p className="ds-methodology__secondary-kicker">IFCN alignment</p>
            <h3 className="ds-methodology__secondary-title" id="ifcn-method">
              Fact-checking commitments
            </h3>
            <p className="ds-methodology__secondary-body">
              The five International Fact-Checking Network commitments below are reproduced as
              editorial alignment. BlackStory is not a paid IFCN signatory; the badge requires
              signatory status. The commitment language is public and guides our corrections and
              verification posture.
            </p>
            <LedgerStack className="ds-methodology__secondary-ledger" items={ifcnItems} />
          </article>
        </div>
      </section>

      <section className="ds-section ds-methodology__next" aria-labelledby="next-method" id="next">
        <h2 className="ds-section__title" id="next-method">
          Keep going
        </h2>
        <p className="ds-band__cta">
          <Link className="ds-cta-link" href="/about">
            About BlackStory
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/corrections">
            Corrections
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/errata">
            Errata
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/">
            Open the map
          </Link>
        </p>
      </section>
    </div>
  );
}
